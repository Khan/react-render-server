#!/usr/bin/env node

'use strict';

/**
 * Render an actual component on the Khan Academy site and profile that.
 *
 * You must have a webapp dev-server already running (this script does
 * not currently work against prod).  You must also have a
 * react-render-server running in 'profile' mode:
 *    npm run profile
 * You must pass in a .fixture.{js,jsx} file; we can only render
 * components that have an associated fixture.  We will figure out
 * everything else needed to render the relevant profile.
 *
 * For now, we can only handle .fixture files without any other
 * dependencies (since we're not running in a webapp context).
 */

/* eslint-disable no-console */

const path = require("path");

const argparse = require("argparse");
const superagent = require("superagent");

const packageInfo = require("../package.json");
const secret = require("../src/secret.js");


/**
 * Given a map from package-name to immediate dependencies, and a package
 * name of interest, return the transitive dependencies for the package
 * of interest.  The deps are topologically sorted, so no package in the
 * returned array depends on a package that comes earlier in the array.
 */
const getTransitiveDependencies = function(pkg, depmap) {
    const retval = [];
    const seenPkgs = {};

    const addDeps = function(currentPkg) {
        if (seenPkgs[currentPkg]) {
            return;
        }
        seenPkgs[currentPkg] = true;
        (depmap[currentPkg] || []).forEach(dep => addDeps(dep));
        retval.push(currentPkg);
    };

    addDeps(pkg);
    return retval;
};

/**
 * Given a package and a package-manifest.js file, return a list of
 * the urls of all the packages that the input package transitively
 * depends on (itself included).
 */
const getDependentPackageUrls = function(pkg, manifestContents,
                                         gaeHostPort) {
    const dependencyString = manifestContents.replace(
            /^.*"javascript": (\[.*\]), "stylesheets":.*/, '$1');
    const dependencyInfo = JSON.parse(dependencyString);

    const dependencyMap = {};    // for some value of "const"
    const pkgToUrl = {};
    dependencyInfo.forEach((packageInfo) => {
        dependencyMap[packageInfo.name] = packageInfo.dependencies;
        pkgToUrl[packageInfo.name] = gaeHostPort + packageInfo.url;
    });
    const packageDeps = getTransitiveDependencies(pkg, dependencyMap);
    return packageDeps.map(pkg => pkgToUrl[pkg]);
};


/**
 * Guess what package a component lives in from its filename.  Usually
 * the filename will have 'foo-package' in it.  That's not a guarantee
 * the component is in foo-package, but it's a good sign...
 * Calls resolve/reject, because that's easiest given how this is used.
 */
const guessPackage = function(componentPath, resolve, reject) {
    const result = /\/([^\/]*)-package\//.exec(componentPath);
    if (result) {
        resolve(result[1] + '.js');
    } else {
        reject(new Error('Could not guess package for ' + componentPath));
    }
};


/**
 * Return the package that a given component lives in.
 * On localhost, we can just ask the system to do this mapping.  But for
 * prod, we don't have access to the necessary information, so we just
 * guess.  TODO(csilvers): if guessing isn't good enough, we could also
 * talk to a local dev-server just for this mapping, and assume it's the
 * same for dev and prod.  But that's a lot of work for minimal gain.
 */
const getPackage = function(componentPath, gaeHostPort) {
    // For known prod servers, we don't even bother trying to talk to
    // them as if they're dev.
    if (gaeHostPort.indexOf('khanacademy.org') > -1 ||
           gaeHostPort.indexOf('appspot.com') > -1) {
        return new Promise((resolve, reject) => {
            guessPackage(componentPath, resolve, reject);
        });
    }
    // First try to talk to /_kake/ -- that will work on localhost.
    // If it fails, assume we're on prod and just guess the package.
    const pathToPackageMapUrl = (
        '/_kake/genfiles/js_path_to_pkgs/en/path_to_packages_prod.json');
    return new Promise((resolve, reject) => {
        superagent.get(gaeHostPort + pathToPackageMapUrl).end((err, res) => {
            if (err) {
                // Presumably we're on prod, let's just guess the package!
                guessPackage(componentPath, resolve, reject);
            } else {
                const pathToPackagesMap = res.body;
                const componentPackage = pathToPackagesMap[componentPath][0];
                resolve(componentPackage);
            }
        });
    });
};


// Convert superagent-style callbacks to promises.
const requestToPromise = function(req) {
    return new Promise((resolve, reject) => {
        req.buffer().end((err, res) => {
            if (err) {
                reject(err);
            } else {
                resolve(res);
            }
        });
    });
};


/**
 * Return the package-manifest contents.
 *
 * This is needed for figuring out package dependencies for render.
 */
const getPackageManifestContents = function(gaeHostPort) {
    // We need the transitive dependency map for the package
    // containing our component.  This is a bit annoying for 3
    // reasons:
    // 1) On prod, the file containing the map has a hard-to-guess
    //    filename, so we need to extract it from the homepage;
    // 2) The file containing the map is not json, so we have to
    //    extract out the info we want using regexps;
    // 3) We need to figure out the transitive deps ourselves.
    // We do (1) and (2), at least, here.
    // TODO(csilvers): compute (3) here as well too.
    return requestToPromise(superagent.get(gaeHostPort + '/')).then(res => {
        const re = /['"]([^"']*\/package-manifest[^'"]*)["']/;
        const results = re.exec(res.text);
        if (!results) {
            throw new Error("Can't find package-manifest in homepage");
        }
        let packageManifestUrl = results[1];
        if (packageManifestUrl.indexOf('://') === -1) {
            packageManifestUrl = gaeHostPort + packageManifestUrl;
        }
        return packageManifestUrl;
    }).then((packageManifestUrl) => {
        return requestToPromise(superagent.get(packageManifestUrl));
    }).then((packageManifestResult) => {
        return packageManifestResult.text;
    });
};


/**
 * Return profile information about rendering component with fixture.
 *
 * @param {string} componentPath - a path to the component,
 *     relative to webapp's ka-root.
 * @param {string} fixturePath - where the fixture file lives on
 *     the local filesystem.  Should be an absolute path.
 * @param {number} instanceSeed - a (preferably large) integer.
 *     When the props file has multiple instances that could be used
 *     to populate the fixture, we use the instanceSeed to decide which
 *     one to use.  The mapping from seed to instance is arbitrary but
 *     fixed -- using the same seed again will yield the same instance.
 * @param {string} gaeHostPort - actually a protocol-host-port, where
 *     the webapp server is running.
 * @param {string} renderHostPort - actually a protocol-host-port, where
 *      the react-render-server is running.
 * @param {string} packageManifestContents - the output of
 *      getPackageManifestContents().
 */
const render = function(componentPath, fixturePath, instanceSeed,
                        gaeHostPort, renderHostPort,
                        packageManifestContents) {
    const relativeFixturePath = path.relative(__dirname, fixturePath);
    const allProps = require(relativeFixturePath).instances;
    const props = allProps[instanceSeed % allProps.length];

    getPackage(componentPath, gaeHostPort).then((componentPackage) => {
        const depPackageUrls = getDependentPackageUrls(
            componentPackage, packageManifestContents, gaeHostPort);

        const reqBody = {
            secret: secret.get(),
            urls: depPackageUrls,
            path: "./" + componentPath,
            props: props,
        };

        return requestToPromise(
            superagent.post(renderHostPort + "/render").send(reqBody)
        );
    }).then(res => {
        console.log(`${componentPath}: ${res.text.length}`);
    }).catch(err => {
        console.log(`${componentPath}: ${err}`);
    });
};


const main = function(parseArgs) {
    let gaeHostPort;
    let rrsHostPort;

    if (parseArgs.dev || parseArgs.dev_webapp) {
        gaeHostPort = "http://localhost:8080";
    } else {
        gaeHostPort = "https://www.khanacademy.org";
    }

    if (parseArgs.dev || parseArgs.dev_render) {
        rrsHostPort = "http://localhost:8060";
    } else {
        rrsHostPort = "https://react-render-dot-khan-academy.appspot.com";
    }

    getPackageManifestContents(gaeHostPort).then((packageManifestContents) => {
        // To get the path to the component, we just remove the trailing
        // .fixture.js, and the leading ka-root prefix.  For now, we
        // assume that the fixture is at <ka_root>/javascript/...
        // TODO(csilvers): figure out ka-root better.
        parseArgs.fixtures.forEach((fixturePath) => {
            try {
                const fixtureAbspath = path.resolve(fixturePath);
                const re = /(javascript\/.*)\.fixture\./;
                const result = re.exec(fixtureAbspath);
                if (!result) {
                    throw new Error('cannot infer component from ' +
                                    fixtureAbspath);
                }
                const componentPath = result[1];
                for (let i = 0; i < parseArgs.num_trials_per_component; i++) {
                    // Let's do the work!
                    render(componentPath, fixtureAbspath, i,
                           gaeHostPort, rrsHostPort,
                           packageManifestContents);
                }
            } catch (err) {
                console.log(`Skipping ${fixturePath}: ${err}`);
            }
        });
    });
};


process.on('unhandledRejection', (reason, p) => {
    console.log("Unhandled Rejection at: Promise ", p,
                " reason: ", reason.stack);
});

const parser = new argparse.ArgumentParser({
    version: packageInfo.version,
    addHelp: true,
    description: "A load tester/benchmarker for the react-render-server",
});
parser.addArgument(['fixtures'],
                   {nargs: '*',
                    defaultValue: ["../webapp/javascript/content-library-package/components/concept-thumbnail.jsx.fixture.js"],  // @Nolint(long line)
                    help: "List of fixture files on the local filesystem"});
parser.addArgument(['--dev'],
                   {action: 'storeTrue',
                    help: "Connect to local gae and render-server"});
parser.addArgument(['--dev-webapp'],
                   {action: 'storeTrue',
                    help: "Use local webapp (on localhost:8080)"});
parser.addArgument(['--dev-render'],
                   {action: 'storeTrue',
                    help: "Use local render-server (on localhost:8060)"});
parser.addArgument(['-n', '--num-trials-per-component'],
                   {type: 'int', defaultValue: 1,
                    help: ("How many times we render a given component " +
                           "with a given fixture file (for load testing)")});

main(parser.parseArgs());


/* For manual testing, here's a curl command you can send to a server directly:

curl -H "Content-type: application/json" -d '{"secret":"'`cat ../secret`'", "urls":["https://www.khanacademy.org/genfiles/javascript/en/corelibs-package-31375e.js","https://www.khanacademy.org/genfiles/javascript/en/corelibs-legacy-package-fbfab0.js","https://www.khanacademy.org/genfiles/javascript/en/shared-package-1e468a.js","https://www.khanacademy.org/genfiles/javascript/en/shared-styles-package-32d405.js","https://www.khanacademy.org/genfiles/javascript/en/hover-card-package-de8d87.js","https://www.khanacademy.org/genfiles/javascript/en/react-package-9b7fb9.js","https://www.khanacademy.org/genfiles/javascript/en/react-components-package-a7e18c.js","https://www.khanacademy.org/genfiles/javascript/en/flux-package-838d8f.js","https://www.khanacademy.org/genfiles/javascript/en/tasks-package-43bf44.js","https://www.khanacademy.org/genfiles/javascript/en/tutorial-package-8e5302.js","https://www.khanacademy.org/genfiles/javascript/en/video-package-9b200b.js","https://www.khanacademy.org/genfiles/javascript/en/content-library-package-9ac69b.js"],"path":"./javascript/content-library-package/components/concept-thumbnail.jsx","props":{"domain":"math","kind":"concept","progressData":{"skillsCompleted":3,"skillsTotal":32},"url":"/images/topic-icons-large/linear_equations.png"}}' 127.0.0.1:8080/render
*/

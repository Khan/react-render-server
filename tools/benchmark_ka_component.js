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

const superagent = require("superagent");


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
 */
const render = function(componentPath, fixturePath, instanceSeed,
                        gaeHostPort, renderHostPort) {
    const relativeFixturePath = path.relative(__dirname, fixturePath);
    const allProps = require(relativeFixturePath).instances;
    const props = allProps[instanceSeed % allProps.length];


    const componentPackagePromise = getPackage(componentPath, gaeHostPort);

    // We need the transitive dependency map for the package
    // containing our component.  This is a bit annoying for 3
    // reasons:
    // 1) On prod, the file containing the map has a hard-to-guess
    //    filename, so we need to extract it from the homepage;
    // 2) The file containing the map is not json, so we have to
    //    extract out the info we want using regexps;
    // 3) We then need to compute the transitive closure ourself.
    const packageManifestPromise = requestToPromise(
        superagent.get(gaeHostPort + '/')
    ).then(res => {
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
    }).then(packageManifestUrl => {
        return requestToPromise(superagent.get(packageManifestUrl));
    });

    Promise.all([componentPackagePromise, packageManifestPromise]).then(v => {
        const componentPackage = v[0];
        const packageManifestResult = v[1];

        const depPackageUrls = getDependentPackageUrls(
            componentPackage, packageManifestResult.text, gaeHostPort);

        // We finally have what we need!
        const reqBody = {
            urls: depPackageUrls,
            path: "./" + componentPath,
            props: props,
        };

        return requestToPromise(
            superagent.post(renderHostPort + "/render").send(reqBody)
        );
    }).then(res => {
        console.log(`${componentPath}: ${res.text.length}`);
    }).catch(err => console.log(`${componentPath}: ${err}`));
};


render("javascript/content-library-package/components/concept-thumbnail.jsx",
       "../webapp/javascript/content-library-package/components/concept-thumbnail.jsx.fixture.js",  // @Nolint(long line)
       1,
       "http://localhost:8080",   // "https://www.khanacademy.org",
       "http://localhost:8060");


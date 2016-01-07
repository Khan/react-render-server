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

    // Talk to kake, via the webapp server, to get the package
    // information.  First, we need the package map.
    const pathToPackageMapUrl = (
        '/_kake/genfiles/js_path_to_pkgs/en/path_to_packages_prod.json');
    superagent.get(gaeHostPort + pathToPackageMapUrl).end((err, res) => {
        if (err) {
            throw err;
        }
        const pathToPackagesMap = res.body;
        const componentPackage = pathToPackagesMap[componentPath][0];

        // Now we need the transitive dependency map for that component.
        // This is a bit annoying because the data file is not json, so
        // we have to extract out the info we want using regexps.  Also,
        // we then need to compute the transitive closure ourself.
        const packageManifestUrl = (
            '/_kake/genfiles/readable_manifests_dev/en/package-manifest.js');
        superagent
            .get(gaeHostPort + packageManifestUrl)
            .buffer()
            .end((err, res) => {
                if (err) {
                    throw err;
                }
                const dependencyString = res.text.replace(
                        /^.*"javascript": (\[.*\]), "stylesheets":.*/, '$1');
                const dependencyInfo = JSON.parse(dependencyString);

                const dependencyMap = {};    // for some value of "const"
                const pkgToUrl = {};
                dependencyInfo.forEach((packageInfo) => {
                    dependencyMap[packageInfo.name] = packageInfo.dependencies;
                    pkgToUrl[packageInfo.name] = packageInfo.url;
                });
                const packageDeps = getTransitiveDependencies(
                    componentPackage,
                    dependencyMap);
                const depPackageUrls = packageDeps.map(pkg => pkgToUrl[pkg]);

                // We finally have what we need!
                const reqBody = {
                    files: depPackageUrls,
                    path: "./" + componentPath,
                    props: props,
                };

                superagent
                    .post(renderHostPort + "/render")
                    .send(reqBody)
                    .end((err, res) => {
                        if (err) {
                            throw err;
                        }
                    });
            });
    });
};

render("javascript/content-library-package/components/concept-thumbnail.jsx",
       "../webapp/javascript/content-library-package/components/concept-thumbnail.jsx.fixture.js",  // @Nolint(long line)
       1,
       "http://localhost:8080",
       "http://localhost:8060");


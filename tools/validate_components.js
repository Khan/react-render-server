#!/usr/bin/env node

'use strict';

/**
 * Validate that a given component can actually server-side render
 * with the given properties (specified via a fixture file).
 *
 * Not all react components can be server-side rendered: they may
 * use globals, or access the DOM, or what have you.  This script
 * can be used to validate that the component *can* be server-side
 * rendered.
 *
 * The input is a bit difficult to construct: it's a json-encoded
 * list of objects like so:
 *    {
 *      jsPackages: [[pkg_name, pkg_contents], [pkg_name, pkg_contents], ...],
 *      pathToReactComponent: "./in/require/format.js",
 *      fixtureFile: "/ideally/an/absolute/path",
 *    }
 * passed in via sttdin.
 *
 * We require() the fixture file and try to server-side render the
 * component using each fixture found therein.  jsPackages are the
 * packages needed to render the component (including the package
 * that defines the component!) topologically sorted so no package
 * require()s anything from a package that comes after it.
 */

/* eslint-disable no-console */

const path = require("path");

const render = require("../src/render.js");


// Returns the number of errors found trying to render the component.
const validate = function(jsPackages, pathToReactComponent, fixtureFile) {
    let allProps;
    try {
        const relativeFixturePath = path.relative(__dirname, fixtureFile);
        allProps = require(relativeFixturePath).instances;
    } catch (err) {
        console.log(`Error reading fixtures from ${fixtureFile}: ${err}`);
        return 1;
    }

    let numErrors = 0;
    allProps.forEach((props, i) => {
        try {
            render(jsPackages, pathToReactComponent, props, 'ignore');
            console.log(`${pathToReactComponent} #${i}: OK`);
        } catch (err) {
            console.log(`${pathToReactComponent} #${i}: ERROR: ${err}`);
            numErrors++;
        }
    });
    return numErrors;
};


const main = function(inputJson) {
    let numErrors = 0;
    inputJson.forEach((oneInput) => {
        numErrors += validate(oneInput.jsPackages,
                              oneInput.pathToReactComponent,
                              oneInput.fixtureFile);
    });
    return numErrors;
};


let inputText = '';
process.stdin.on('data', function(chunk) {
    inputText = inputText + chunk;
});
process.stdin.on('end', function() {
    const inputJson = JSON.parse(inputText);
    const numErrors = main(inputJson);
    console.log('DONE');
    process.exit(numErrors);
});

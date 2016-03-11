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

// Cribbed from
// https://github.com/facebook/react/blob/92530b4ddcc77be49a50ce4cbffb32ee38a98247/src/renderers/dom/client/ReactMount.js
function firstDifferenceIndex(string1, string2) {
    const minLen = Math.min(string1.length, string2.length);
    for (var i = 0; i < minLen; i++) {
        if (string1.charAt(i) !== string2.charAt(i)) {
            return i;
        }
    }
    return string1.length === string2.length ? -1 : minLen;
}

// Given some html, remove the reactid and react-checksum, which are
// auto-generated and not necessarily consistent between runs.
const normalizeReactOutput = function(html) {
    html = html.replace(/data-reactid="[^"]*"/g,
                        'data-reactid="..."');
    html = html.replace(/data-react-checksum="[^"]*"/g,
                        'data-react-checksum="..."');
    return html;
};

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
        // For each fixture file, we'll try rendering the component three
        // times:
        //
        //  1. Emulating a server-side render
        //  2. Emulating a mobile browser client-side render
        //  3. Emulating a desktop browser client-side render
        //
        // Then we compare the outputs from (1) and (2), and the outputs from
        // (1) and (3). If they differ, it suggests there the client and server
        // would render different things, causing a checksum difference. When
        // the React checksum differs, React will throw away everything in the
        // root container. This causes nasty reflows and would throw away any
        // user input in the server-rendered components.
        //
        // This also helps us find non-determinism in the rendering output
        // (e.g. using random numbers as IDs).
        try {
            const serverHtml = normalizeReactOutput(
                render(jsPackages, pathToReactComponent, props, {},
                       'ignore').html);

            const desktopHtml = normalizeReactOutput(
                render(jsPackages, pathToReactComponent, props, {
                    width: 2000,
                    height: 900,
                    innerWidth: 2000,
                    innerHeight: 900,
                    outerWidth: 2000,
                    outerHeight: 900,
                }, 'ignore').html);
            const mobileHtml = normalizeReactOutput(
                render(jsPackages, pathToReactComponent, props, {
                    width: 400,
                    height: 600,
                    innerWidth: 400,
                    innerHeight: 600,
                    outerWidth: 400,
                    outerHeight: 600,
                    ontouchstart: function() {},
                    onorientationchange: function() {},
                    orientation: 'portrait',
                }, 'ignore').html);

            const mismatchMsg = (
                "There was a mismatch between the server and client rendered" +
                " HTML. Server-side rendered components must not do feature" +
                " feature detection, because the features detected will be" +
                " different on the client and server!\n\n" +
                "Here's where the server and client may differ");

            if (serverHtml !== desktopHtml) {
                const diffIndex = firstDifferenceIndex(serverHtml,
                                                       desktopHtml);
                throw new Error(
                    mismatchMsg +
                    "\n(server) " + serverHtml.substring(diffIndex - 20,
                                                         diffIndex + 40) +
                    "\n(desktop) " + desktopHtml.substring(diffIndex - 20,
                                                           diffIndex + 40));
            } else if (serverHtml !== mobileHtml) {
                const diffIndex = firstDifferenceIndex(serverHtml,
                                                       mobileHtml);
                throw new Error(
                    mismatchMsg +
                    "\n(server) " + serverHtml.substring(diffIndex - 20,
                                                         diffIndex + 40) +
                    "\n(mobile) " + mobileHtml.substring(diffIndex - 20,
                                                         diffIndex + 40));
            }
            console.log(`${pathToReactComponent} #${i}: OK`);
        } catch (err) {
            console.log(`${pathToReactComponent} #${i}: ERROR ${err.stack}`);
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

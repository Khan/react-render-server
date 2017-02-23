#!/usr/bin/env node

'use strict';

/**
 * Given the necessary input for rendering a component,
 * writes html to stdout with the component text, or an error message.
 *
 * The input is a bit difficult to construct: it's a json-encoded
 * object like so:
 *    {
 *      jsPackages: [[pkg_name, pkg_contents], [pkg_name, pkg_contents], ...],
 *      pathToReactComponent: "./in/require/format.js",
 *      props: someJsonObject,
 *      globals: someJsonObject,
 *    }
 * passed in via sttdin.
 *
 * jsPackages are the packages needed to render the component
 * (including the package that defines the component!) topologically
 * sorted so no package require()s anything from a package that comes
 * after it.
 *
 * The output is the same as the render() command, something like:
 *   {
 *       "html": "<a href='http://www.google.com' class='link141'>Google</a>",
 *       "css": {
 *           content: ".link141{backgroundColor:transparent;}",
 *           renderedClassNames: ["link141"]
 *       }
 *   }
 */

/* eslint-disable no-console */

const render = require("../src/render.js");


let inputText = '';
process.stdin.on('data', function(chunk) {
    inputText = inputText + chunk;
});
process.stdin.on('end', function() {
    const inputJson = JSON.parse(inputText);
    render(
        inputJson.jsPackages,
        inputJson.pathToReactComponent,
        inputJson.props,
        inputJson.globals,
        'ignore'
    ).then((outputJson) => {
        console.log(JSON.stringify(outputJson));
    }).catch((err) => {
        console.log(JSON.stringify({
            html: `${inputJson.pathToReactComponent}: ERROR ${err.stack}`,
            css: {
                content: "",
                renderedClassNames: [],
            },
        }));
    });
});

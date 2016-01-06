/**
 * The core functionality of actually rendering a react component.
 *
 * This uses 'vm' to execute the javascript holding the react
 * component, and jsdom (plus a few other things) to provide the
 * necessary context for rendering it.
 */

const vm = require("vm");

// TODO(csilvers): try to get rid of the dependency on jsdom
const jsdom = require("jsdom");
const ReactDOMServer = require('react-dom/server');


const createVMContext = function() {
    const sandbox = {};

    // A minimal document, for parts of our code that assume there's a DOM.
    const doc = jsdom.jsdom(
        "<!DOCTYPE html><html><head></head><body></body></html>", {
            // Forward console logs from inside the VM to the real console
            virtualConsole: jsdom.createVirtualConsole().sendTo(console),
            // CKEditor, and maybe other things, check for
            // location.href, and expect it to be non-empty.
            url:  "http://www.khanacademy.org",
            features: {
                FetchExternalResources: false,
                ProcessExternalResources: false,
            },
        });

    // Copy everything from the jsdom object onto the sandbox.
    // TODO(jlfwong): For some reason, copying doc.defaultView works, but
    // using it directly as an arg to vm.createContext doesn't.
    Object.keys(doc.defaultView).forEach(function(key) {
        sandbox[key] = doc.defaultView[key];
    });
    sandbox.window = sandbox;
    sandbox.global = sandbox;
    sandbox.self = sandbox;
    sandbox.ReactDOMServer = ReactDOMServer;

    // Used by javascript/reports-package/reports-shared.jsx on boot in
    // isExerciseMapFresh().
    sandbox.localStorage = {};

    return vm.createContext(sandbox);
};

/**
 * Actually render a react component.
 *
 * @param {string[]} jsPackageSources - A list of source code for js
 *     packages that we need to include in order to render the given
 *     component.  These files are executed in the order specified.
 * @param {string} pathToReactComponent - What to require() in order
 *     to render the react component.
 * @param {object} props - the props object to pass in to the react
 *     renderer; the props used to render the react component.
 *
 * @returns an object like follows:
 *   {
 *       "html": "<a href='http://www.google.com' class='link141'>Google</a>",
 *       "css": {
 *           content: ".link141{backgroundColor:transparent;}",
 *           renderedClassNames: ["link141"]
 *       }
 *   }
 *
 * html is the rendered html of the react component.
 * css will only be returned if the component makes use of Aphrodite
 * (https://github.com/Khan/aphrodite).
 */

const render = function(jsPackageSources, pathToReactComponent, props) {
    const context = createVMContext();
    context.pathToReactComponent = pathToReactComponent;
    context.reactProps = props;

    jsPackageSources.forEach((contents) => {
        vm.runInContext(contents, context);
    });

    const runInContext = function(fn) {
        return vm.runInContext("(" + fn.toString() + ")()", context);
    };

    // KA code is transpiled via babel.  The resulting code can't run
    // unless we load these shims first.
    // TODO(csilvers): Automatically run the shims whenever corelibs.js
    // (or maybe shared.js) is loaded, then get rid of this.
    runInContext(() => {
        KAdefine.require("./third_party/javascript-khansrc/core-js/shim.min.js");
        KAdefine.require("./third_party/javascript-khansrc/babeljs/babel-external-helpers.js");
    });

    return runInContext(() => {
        // Get stuff out of the context and into local vars.
        const ReactDOMServer = global.ReactDOMServer;
        const pathToReactComponent = global.pathToReactComponent;
        const props = global.reactProps;

        const React = KAdefine.require("react");
        // TODO(csilvers): handle aphrodite

        // Verify we have the right version of react.  ReactDOMServer
        // holds the react version that we've installed here, for this
        // server, while React holds the react version that is
        // provided via the input js packages -- that is, the version
        // on webapp.  If they don't match, throw an exception.
        if (React.version !== ReactDOMServer.version) {
            throw new Error(`Server should be using React version ` +
                            `${React.version}, but is using React ` +
                            `version ${ReactDOMServer.version}`);
        }

        const Component = KAdefine.require(pathToReactComponent);
        const reactElement = React.createElement(Component, props);
        const html = ReactDOMServer.renderToString(reactElement);

        return {
            html: html,
            css: {
                content: "",   // TODO(csilvers): figure this out
                renderedClassNames: [],  // TODO(csilvers): figure this out
            },
        };
    });
};

module.exports = render;

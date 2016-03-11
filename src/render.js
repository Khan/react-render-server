/**
 * The core functionality of actually rendering a react component.
 *
 * This uses 'vm' to execute the javascript holding the react
 * component, and jsdom (plus a few other things) to provide the
 * necessary context for rendering it.
 */

'use strict';

const vm = require("vm");

// TODO(csilvers): try to get rid of the dependency on jsdom
const jsdom = require("jsdom");
const ReactDOMServer = require('react-dom/server');

const cache = require("./cache.js");
const profile = require("./profile.js");

// render takes a cacheBehavior property, which is one of these:
//    'yes': try to retrieve the object from the cache
//    'no': do not try to retrieve the object from the cache (but
//          still store it in the cache after retrieving it).
//    'ignore': do not try to retrieve the object from the cache,
//          nor try to store it in the cache.
// This variable controls the cache behavior that is used if the
// user does not pass in a value for cacheBehavior for render().
let defaultCacheBehavior;

const resetGlobals = function() {
    defaultCacheBehavior = 'yes';
};

resetGlobals();


const runInContext = function(context, fn) {
    return vm.runInContext("(" + fn.toString() + ")()", context);
};

/**
 * Retrieve a vm context object that's been preloaded by having all of
 * the jsPackages executed and the react environment initialized.
 * If requestStats is non-empty, set requestStats.createdVmContext to
 * whether we got the context from the cache or not.
 */
const getVMContext = function(jsPackages, pathToReactComponent,
                              cacheBehavior, requestStats) {
    if (cacheBehavior == null) {
        cacheBehavior = defaultCacheBehavior;
    }

    // (We expect props to vary between requests for the same
    // component, so we don't make the props part of the cache key.)
    const cacheKey = (jsPackages.map(pkg => pkg[0]).join(",") +
                      ":" + pathToReactComponent);

    if (cacheBehavior === 'yes') {
        const cachedValue = cache.get(cacheKey);
        if (cachedValue) {
            if (requestStats) {
                requestStats.createdVmContext = false;
            }
            return cachedValue;
        }
    }

    const vmConstructionProfile = profile.start("building VM for " +
                                                pathToReactComponent);

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

    // This makes sure that qTip2 doesn't try to use the canvas.
    sandbox.HTMLCanvasElement.prototype.getContext = undefined;

    let cumulativePackageSize = 0;

    const context = vm.createContext(sandbox);

    jsPackages.forEach((pkg) => {
        vm.runInContext(pkg[1], context);   // pkg is [url path, contents]
        cumulativePackageSize += pkg[1].length;
    });

    context.pathToReactComponent = pathToReactComponent;
    runInContext(context, () => {
        // Get stuff out of the context and into local vars.
        const ReactDOMServer = global.ReactDOMServer;

        const React = KAdefine.require("react");

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

        try {
            global.StyleSheetServer = KAdefine.require("aphrodite").StyleSheetServer;

            // Make sure we're using a new enough version of Aphrodite
            global.StyleSheetServer.renderStatic;
        } catch (e) {
            // If we're here, it should mean that the component being rendered
            // does not depend on Aphrodite. We'll make a stub instead ot make
            // the code below simpler.
            global.StyleSheetServer = {
                renderStatic: (cb) => {
                    return {
                        html: cb(),
                        css: {
                            content: "",
                            renderedClassNames: [],
                        },
                    };
                },
            };
        }
    });

    if (cacheBehavior !== 'ignore') {
        // As a rough heuristic, we say that the size of the context is double
        // the size of the JS source files.
        const cachedSize = jsPackages.reduce((sum, pkg) => sum + pkg[0].length,
                                             0) * 2;
        cache.set(cacheKey, context, cachedSize);
    }

    vmConstructionProfile.end();

    if (requestStats) {
        requestStats.createdVmContext = true;
        requestStats.vmContextSize = cumulativePackageSize;
    }

    return context;
};

/**
 * Actually render a React component.
 *
 * @param {string[][]} jsPackages - A list of [filename, source code]
 *     pairs for js packages that we need to include in order to render the
 *     given component.  These files are executed in the order specified.
 * @param {string} pathToReactComponent - What to require() in order
 *     to render the react component.
 * @param {object} props - the props object to pass in to the react
 *     renderer; the props used to render the React component.
 * @param {object} globals - the map of global variable name to their values to
 *     be set before the React component is require()'d.
 * @param {string} cacheBehaviour - One of 'yes', 'no', or 'ignore'. Used to
 *     determine caching behaviour. See comment on defaultCacheBehaviour.
 * @param {object} requestStats -- If defined, should be a dict. Used to
 *     store stats about the current request.  In this case, we set
 *     requestStats.createdVmContext based on whether we had to create a
 *     new vm context or could get an existing one from the cache.

 * @returns an object like follows:
 *   {
 *       "html": "<a href='http://www.google.com' class='link141'>Google</a>",
 *       "css": {
 *           content: ".link141{backgroundColor:transparent;}",
 *           renderedClassNames: ["link141"]
 *       }
 *   }
 *
 * html is the rendered html of the React component.
 * css will only be returned if the component makes use of Aphrodite
 * (https://github.com/Khan/aphrodite).
 */
const render = function(jsPackages, pathToReactComponent, props,
                        globals, cacheBehavior, requestStats) {
    const context = getVMContext(jsPackages, pathToReactComponent,
                                 cacheBehavior, requestStats);

    context.reactProps = props;

    const renderProfile = profile.start("rendering " + pathToReactComponent);

    if (globals) {
        Object.keys(globals).forEach(key => {
            // Location is a special case.
            if (key === 'location') {
                context.location.replace(globals[key]);
            } else {
                context[key] = globals[key];
            }
        });
    }

    // getVMContext sets up the sandbox to have React installed, as
    // well as everything else needed to load the React component, so
    // our work here is easy.
    const ret = runInContext(context, () => {
        const Component = KAdefine.require(global.pathToReactComponent);
        const reactElement = React.createElement(Component,
                                                 global.reactProps);
        return global.StyleSheetServer.renderStatic(
            () => ReactDOMServer.renderToString(reactElement));
    });

    renderProfile.end();

    return ret;
};

render.setDefaultCacheBehavior = function(cacheBehavior) {
    defaultCacheBehavior = cacheBehavior;
};

// Used by tests.
render.resetGlobals = resetGlobals;

module.exports = render;

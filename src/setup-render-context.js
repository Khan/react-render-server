/**
 * Retrieve a vm context object that's been preloaded by having all of
 * the jsPackages executed and the react environment initialized.
 * If requestStats is non-empty, set requestStats.createdVmContext to
 * whether we got the context from the cache or not.
 */

const vm = require("vm");
const ReactDOMServer = require('react-dom/server');
// TODO(csilvers): try to get rid of the dependency on jsdom
const jsdom = require("jsdom");
const raf = require("raf");
const cache = require("./cache.js");
const profile = require("./profile.js");

const runInContext = function(context, fn) {
    return vm.runInContext("(" + fn.toString() + ")()", context);
};

const setupRenderContext = function(
    jsPackages,
    pathToReactComponent,
    cacheBehavior,
    requestStats,
) {
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

    // Polyfill `requestAnimationFrame` to appease React.
    raf.polyfill(doc.defaultView);

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
            global.StyleSheetServer.renderStatic; // eslint-disable-line no-unused-expressions
        } catch (e) {
            // If we're here, it should mean that the component being rendered
            // does not depend on Aphrodite. We'll make a stub instead to make
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

module.exports = setupRenderContext;

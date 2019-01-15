/**
 * Retrieve a vm context object or create it if it isn't cached.
 * If requestStats is non-empty, set requestStats.createdVmContext to
 * whether we got the context from the cache or not.
 */

const vm = require("vm");
// TODO(csilvers): try to get rid of the dependency on jsdom
const jsdom = require("jsdom");
const raf = require("raf");
const cache = require("./cache.js");
const profile = require("./profile.js");

const runInContext = function(context, fn) {
    return vm.runInContext("(" + fn.toString() + ")()", context);
};

const createRenderContext = function(jsPackages, pathToClientEntryPoint) {
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

    // Used by javascript/reports-package/reports-shared.jsx on boot in
    // isExerciseMapFresh().
    sandbox.localStorage = {};

    // This makes sure that qTip2 doesn't try to use the canvas.
    sandbox.HTMLCanvasElement.prototype.getContext = undefined;

    const context = vm.createContext(sandbox);

    // Setup callback.
    // This indicates to the rendering code that it is involved in SSR
    // and provides it the means to register for SSR to occur.
    // This has to happen before we import the entry point, so it can
    // invoke this method.
    //
    // The callback provided by the rendering code must return a promise that
    // will perform the render, including data fetch calls using
    // getDataFromTree.
    //    getRenderPromiseCallback:
    //          (props, maybeApolloClient) => Promise.resolve({html, css})
    runInContext(context, () => {
        window.__registerForSSR__ = getRenderPromiseCallback => {
            window.__rrs = {
                getRenderPromiseCallback,
            };
        };
    });

    let cumulativePackageSize = 0;
    jsPackages.forEach(({content}) => {
        vm.runInContext(content, context);   // pkg is [url path, contents]
        cumulativePackageSize += content.length;
    });
    context.pathToClientEntryPoint = pathToClientEntryPoint;

    return {
        context,
        cumulativePackageSize,
    };
};

const getOrCreateRenderContext = function(
    jsPackages,
    pathToClientEntryPoint,
    cacheBehavior,
    requestStats,
) {
    if (cacheBehavior == null) {
        throw new Error("Must provide a value for cacheBehavior");
    }

    // (We expect props to vary between requests for the same
    // component, so we don't make the props part of the cache key.)
    const cacheKey = jsPackages.map(({url}) => url).join(",");

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
        pathToClientEntryPoint);

    const {context, cumulativePackageSize} =
        createRenderContext(jsPackages, pathToClientEntryPoint);

    if (cacheBehavior !== 'ignore') {
        // As a rough heuristic, we say that the size of the context is double
        // the size of the JS source files.
        const cachedSize = cumulativePackageSize * 2;
        cache.set(cacheKey, context, cachedSize);
    }

    vmConstructionProfile.end();

    if (requestStats) {
        requestStats.createdVmContext = true;
        requestStats.vmContextSize = cumulativePackageSize;
    }

    return context;
};

module.exports = getOrCreateRenderContext;

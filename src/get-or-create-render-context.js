/**
 * Retrieve a vm context object or create it if it isn't cached.
 * If requestStats is non-empty, set requestStats.createdVmContext to
 * whether we got the context from the cache or not.
 */

const vm = require("vm");
// TODO(csilvers): try to get rid of the dependency on jsdom
const jsdom = require("jsdom");
const cache = require("./cache.js");
const profile = require("./profile.js");

class CustomResourceLoader extends jsdom.ResourceLoader {
    fetch(url, options) {
        // eslint-disable-next-line no-console
        console.log("FETCHING: " + url);
        return super.fetch(url, options);
    }
}

const runInContext = function(jsdomContext, fnOrText) {
    const script = typeof fnOrText === "function"
        ? "(" + fnOrText.toString() + ")()"
        : fnOrText;

    if (typeof script !== "string") {
        throw new Error("Must be a function or text");
    }
    return jsdomContext.runVMScript(new vm.Script(script));
};

const createRenderContext = function(locationUrl, jsPackages, pathToClientEntryPoint) {
    // A minimal document, for parts of our code that assume there's a DOM.
    const context = new jsdom.JSDOM(
        "<!DOCTYPE html><html><head></head><body></body></html>", {
            // The base location. We can't modify window.location directly
            // but this allows us to provide one.
            url:  locationUrl,
            // We want to run scripts that would normally run in a web browser
            // so we give them as much leeway as we can. Obviously, this is a
            // security risk if access to this service is not properly secured.
            // Make sure to use a secret!
            runScripts: "dangerously",
            // We use a custom loader for our scripts and other resource
            // requests so that we can output them to the log. Helps us debug
            // that what we think is happening is happening.
            resources: new CustomResourceLoader(),
            // There are certain things that a browser provides because it is
            // actually rendering things. While JSDOM does not render, we can
            // have it pretend that it is (it still isn't).
            pretendToBeVisual: true,
        });

    // This means we can run scripts inside the jsdom context.
    context.run = fnOrText => runInContext(context, fnOrText);

    // Let's make sure our sandbox window is how we want.
    const sandbox = context.window;
    sandbox.global = sandbox;
    sandbox.self = sandbox;

    // This makes sure that qTip2 doesn't try to use the canvas.
    sandbox.HTMLCanvasElement.prototype.getContext = undefined;

    // Setup callback.
    // This indicates to the rendering code that it is involved in SSR
    // and provides it the means to register for SSR to occur.
    // This has to happen before we import the entry point, so it can
    // invoke this method.
    //
    // The callback provided by the rendering code must return a promise that
    // will perform the render, including data fetch calls using
    // getDataFromTree or whatever call is appropriate.
    //
    // The getRenderPromiseCallback takes the props and an ApolloClient
    // instance (or null, if Apollo is not needed), and returns a promise of
    // the rendered content.
    //
    // An entrypoint example for invoking __registerForSSR__:
    //
    //     const renderElement = (props, maybeApolloClient) =>
    //         Promise.resolve({html, css});
    //     window.__registerForSSR__(renderElement);
    //
    context.run(() => {
        window.__registerForSSR__ = getRenderPromiseCallback => {
            window.__rrs = {
                getRenderPromiseCallback,
            };
        };
    });

    // Now we execute inside the sandbox context each script package.
    let cumulativePackageSize = 0;
    jsPackages.forEach(({content}) => {
        // pkg is [url path, contents]
        context.run(content);
        cumulativePackageSize += content.length;
    });

    return {
        context,
        cumulativePackageSize,
    };
};

const getOrCreateRenderContext = function(
    locationUrl,
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
        createRenderContext(locationUrl, jsPackages, pathToClientEntryPoint);

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

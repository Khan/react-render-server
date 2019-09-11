/**
 * Create a render context object.
 */

const vm = require("vm");
// TODO(csilvers): try to get rid of the dependency on jsdom
const jsdom = require("jsdom");
const profile = require("./profile.js");
const fetchPackage = require("./fetch_package.js");

class CustomResourceLoader extends jsdom.ResourceLoader {
    constructor() {
        super();
        this._active = true;
        this.EMPTY = Buffer.from("");
    }

    setScriptRunner(callback) {
        this._runScript = callback;
    }

    close() {
        this._active = false;
    }

    _executeFromCache(url) {
        const requestStats = {};

        return fetchPackage(url, requestStats)
            .then(script => {
                const source = requestStats.fromCache != null ? "CACHE" : "FETCH";
                const message = `${source}: ${url}`;

                if (this._active) {
                    // eslint-disable-next-line no-console
                    console.log(`${message}`);
                    this._runScript(script);
                } else {
                    // eslint-disable-next-line no-console
                    console.warn(`File requested but never used (${message})`);
                }
            }).then(() => {
                // Our JS queue will handle executing the code, so we just
                // resolve with a dummy script.
                return this.EMPTY;
            });
    }

    fetch(url, options) {
        if (!this._active) {
            // Let's head off any fetches that occur after we're inactive.
            // Not sure if we get any, but now we'll know.
            // eslint-disable-next-line no-console
            console.warn(`File fetch tried by JSDOM after render (BLOCK: ${url})`);

            // We just resolve with an empty string.
            return Promise.resolve(this.EMPTY);
        }

        // If this is not a JavaScript request or the JSDOM context has been
        // closed by our rendering, then return an empty result as we don't
        // need them for SSR-ing
        const JSFileRegex = /^.*\.js(?:\?.*)?/g;
        if (!JSFileRegex.test(url) || !this._active) {
            // eslint-disable-next-line no-console
            console.log("EMPTY: " + url);
            // We just resolve with an empty string.
            return Promise.resolve(this.EMPTY);
        }

        // If this is a JavaScript request, then we want to direct it through
        // our cache. We check for js file urls with and without query params.
        return this._executeFromCache(url);
    }
}

const getScript = function(fnOrText, options) {
    switch (typeof fnOrText) {
        case "function":
            const script = "(\n" + fnOrText.toString() + "\n)()";
            const _options = Object.assign({}, options);
            _options.lineOffset = -1;
            return new vm.Script(script, _options);

        case "string":
            return new vm.Script(fnOrText, options);

        default:
            throw new Error("Must be a function or string");
    }
};

const runInContext = function(jsdomContext, fnOrText, options = {}) {
    return jsdomContext.runVMScript(
        getScript(fnOrText, options),
    );
};

const patchTimers = () => {
    let warned = false;
    const patchCallbackFnWithGate = (obj, fnName, gateName) => {
        const old = obj[fnName];
        delete obj[fnName];
        obj[fnName] = (callback, ...args) => {
            const gatedCallback = () => {
                if (obj[gateName]) {
                    callback();
                    return;
                }
                if (!warned) {
                    warned = true;
                    // eslint-disable-next-line no-console
                    console.warn("Dangling timer(s) encountered");
                }
            };
            return old(gatedCallback, ...args);
        };
    };

    // Patch the timer functions on window so that dangling timers don't kill
    // us when we close the window.
    patchCallbackFnWithGate(window, "setTimeout", "__SSR_ACTIVE__");
    patchCallbackFnWithGate(window, "setInterval", "__SSR_ACTIVE__");
    patchCallbackFnWithGate(window, "requestAnimationFrame", "__SSR_ACTIVE__");
};

const createRenderContext = function(locationUrl, globals, jsPackages) {
    const resourceLoader = new CustomResourceLoader();

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
            resources: resourceLoader,
            // There are certain things that a browser provides because it is
            // actually rendering things. While JSDOM does not render, we can
            // have it pretend that it is (it still isn't).
            pretendToBeVisual: true,
        });

    // Our resource loader needs to execute any JS it loads, so let's tell it
    // how to do that.
    resourceLoader.setScriptRunner(script => context.runVMScript(script));

    // This means we can run scripts inside the jsdom context.
    context.run =
        (fnOrText, options) => runInContext(context, fnOrText, options);

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
        window.__SSR_ACTIVE__ = true;
    });
    context.run(patchTimers);

    // Set up a close handler to be called after rendering is done.
    context.close = () => {
        context.run(() => { window.__SSR_ACTIVE__ = false; });
        resourceLoader.close();
        context.window.close();
    };

    // Now, before we load any code, we make sure any globals we've been asked
    // to set are made available to the VM context.
    if (globals) {
        Object.keys(globals).forEach(key => {
            // Location is a special case, so we want to block changing that.
            if (key !== 'location') {
                context.window[key] = globals[key];
            }
        });
    }

    // Now we execute inside the sandbox context each script package.
    let cumulativePackageSize = 0;
    jsPackages.forEach(script => {
        context.runVMScript(script);
        cumulativePackageSize += script.size;
    });

    return {
        context,
        cumulativePackageSize,
    };
};

const createRenderContextWithStats = function(
    locationUrl,
    globals,
    jsPackages,
    pathToClientEntryPoint,
    requestStats,
) {
    const vmConstructionProfile = profile.start(
        `building VM for ${pathToClientEntryPoint}`,
    );

    const {context, cumulativePackageSize} =
        createRenderContext(locationUrl, globals, jsPackages);

    vmConstructionProfile.end();

    if (requestStats) {
        requestStats.createdVmContext = true;
        requestStats.vmContextSize = cumulativePackageSize;
    }

    return context;
};

module.exports = createRenderContextWithStats;

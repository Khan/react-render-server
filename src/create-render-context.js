// @flow

/**
 * Create a render context object.
 */

import vm from "vm";

import {JSDOM, ResourceLoader} from "jsdom";

import logging from "./logging.js";
import profile from "./profile.js";
import fetchPackage from "./fetch_package.js";

import type {FetchOptions} from "jsdom";
import type {
    Globals,
    JavaScriptPackage,
    RenderContext,
    RequestStats,
} from "./types.js";

type RenderContextWithSize = {
    context: RenderContext,
    cumulativePackageSize: number,
};

class CustomResourceLoader extends ResourceLoader {
    _active: boolean;
    _requestStats: ?RequestStats;

    /**
     * We will return EMPTY in cases where we just don't care about the file
     * loading. Let's just reuse a promise for that.
     */
    static EMPTY = Promise.resolve(Buffer.from(""));

    constructor(requestStats?: RequestStats) {
        super();

        (CustomResourceLoader.EMPTY: any).abort =
            (CustomResourceLoader.EMPTY: any).abort || (() => {});
        this._active = true;
        this._requestStats = requestStats;
    }

    close(): void {
        this._active = false;
    }

    _fetchJavaScript(url: string): Promise<Buffer> {
        const abortableFetch = fetchPackage(url, "JSDOM", this._requestStats);
        const promiseToBuffer = abortableFetch.then(({content}) => {
            if (!this._active) {
                logging.silly(`File requested but never used (${url})`);

                /**
                 * We can return an empty buffer here without caching the
                 * empty result because the actual file is already cached
                 * by our package fetching. So this does not impact future
                 * renders.
                 */
                return Buffer.from("");
            }
            return Buffer.from(content);
        });
        /**
         * We have to turn this back into an abortable promise so that JSDOM
         * can abort it when closing, if it needs to.
         */
        (promiseToBuffer: any).abort = abortableFetch.abort;
        return promiseToBuffer;
    }

    _getFakeData(url: string, options: FetchOptions): ?Promise<Buffer> {
        const ImageRegex = /^.*\.(jpe?g|png|gif)(?:\?.*)?/g;
        const isImage = url.startsWith("data:image") || ImageRegex.test(url);
        if (isImage) {
            const imagePromise = super.fetch(
                /**
                 * Shortest valid image:
                 * https://stackoverflow.com/a/13139830/23234
                 */
                "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
                options,
            );
            /**
             * JSDOM has a bug where it calls abort on pending promises when
             * it gets closed, but it also creates Promises without abort calls.
             * So, let's make sure it has one.
             */
            (imagePromise: any).abort = (imagePromise: any).abort || (() => {});
            return imagePromise;
        }

        return CustomResourceLoader.EMPTY;
    }

    fetch(url: string, options: FetchOptions): ?Promise<Buffer> {
        const isInlineData = url.startsWith("data:");
        const loggableUrl = isInlineData ? "inline data" : url;
        if (!this._active) {
            // Let's head off any fetches that occur after we're inactive.
            // Not sure if we get any, but now we'll know.
            logging.warn(
                `File fetch tried by JSDOM after render (${loggableUrl})`,
            );

            /**
             * Though we intentionally don't want to load this file, we can't
             * just return null per the spec as this can break promise
             * resolutions that are relying on this file. Instead, we resolve
             * as an empty string so things can tidy up properly.
             */
            return CustomResourceLoader.EMPTY;
        }

        // If this is not a JavaScript request or the JSDOM context has been
        // closed by our rendering, then return an empty result as we don't
        // need them for SSR-ing
        const JSFileRegex = /^.*\.js(?:\?.*)?/g;
        if (!JSFileRegex.test(url) || !this._active) {
            logging.silly("EMPTY: %s", loggableUrl);

            /**
             * Though we intentionally don't want to load this file, we can't
             * just return null per the spec as this can break promise
             * resolutions that are relying on this file. Instead, we resolve
             * as an empty string.
             */
            return this._getFakeData(url, options);
        }

        // If this is a JavaScript request, then we want to do some things to
        // request it ourselves, before we let JSDOM handle the result.
        return this._fetchJavaScript(url);
    }
}

const getScript = function(
    fnOrText: Function | string,
    options: vm$ScriptOptions,
): any {
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

const runInContext = function(
    jsdomContext: RenderContext,
    fnOrText: Function | string,
    options: vm$ScriptOptions = {},
): any {
    return jsdomContext.runVMScript(getScript(fnOrText, options));
};

const patchTimers = (): void => {
    let warned = false;
    const patchCallbackFnWithGate = (
        obj: any,
        fnName: string,
        gateName: string,
    ) => {
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
                    /**
                     * This has to use console because it runs in the VM
                     * and so it doesn't have access to our winston logging.
                     */
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

/**
 * Create the VM context in which to render.
 *
 * @param {string} locationUrl
 * @param {any} globals
 * @param {[{content: string, url: string}]} jsPackages
 * @returns {{context: JSDOM, cumulativePackageSize: number}}
 */
const createRenderContext = function(
    locationUrl: string,
    globals: Globals,
    jsPackages: Array<JavaScriptPackage>,
    requestStats?: RequestStats,
): RenderContextWithSize {
    const resourceLoader = new CustomResourceLoader(requestStats);

    // A minimal document, for parts of our code that assume there's a DOM.
    const context: RenderContext = (new JSDOM(
        "<!DOCTYPE html><html><head></head><body></body></html>",
        {
            // The base location. We can't modify window.location directly
            // but this allows us to provide one.
            url: locationUrl,
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
        },
    ): any);

    // This means we can run scripts inside the jsdom context.
    context.run = (fnOrText, options) =>
        runInContext(context, fnOrText, options);

    // Let's make sure our sandbox window is how we want.
    const sandbox = context.window;
    sandbox.global = sandbox;
    sandbox.self = sandbox;

    /**
     * This makes sure that qTip2 doesn't try to use the canvas.
     *
     * TODO(somewhatabstact): Do we need this hack still? Is there are better
     * way? $FlowFixMe
     */
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
        window.__registerForSSR__ = (getRenderPromiseCallback) => {
            window.__rrs = {
                getRenderPromiseCallback,
            };
        };
        window.__SSR_ACTIVE__ = true;
    });
    context.run(patchTimers);

    // Set up a close handler to be called after rendering is done.
    context.close = () => {
        context.run(() => {
            window.__SSR_ACTIVE__ = false;
        });
        resourceLoader.close();
        context.window.close();
    };

    // Now, before we load any code, we make sure any globals we've been asked
    // to set are made available to the VM context.
    if (globals) {
        Object.keys(globals).forEach((key) => {
            // Location is a special case, so we want to block changing that.
            if (key !== "location") {
                context.window[key] = globals[key];
            }
        });
    }

    // Now we execute inside the sandbox context each script package.
    let cumulativePackageSize = 0;
    jsPackages.forEach(({content, url}) => {
        context.run(content, {filename: url});

        // A size estimate; it's really just an estimate
        // though as we don't consider anything but the script text.
        // Since we're running in node, we assume 2 bytes
        // per character in the text. We aren't accounting for
        // other info associated with that, though.
        // This is used in our request stats when determining how "big"
        // the code was to perform the current render.
        cumulativePackageSize += content.length * 2;
    });

    return {
        context,
        cumulativePackageSize,
    };
};

/**
 *
 * @param {string} locationUrl
 * @param {any} globals
 * @param {[{content: string, url: string}]} jsPackages
 * @param {any} requestStats
 * @returns {JSDOM}
 */
export default function createRenderContextWithStats(
    locationUrl: string,
    globals: Globals,
    jsPackages: Array<any>,
    requestStats?: RequestStats,
): RenderContext {
    const vmConstructionProfile = profile.start(
        `building VM ${(globals && `for ${globals["location"]}`) || ""}`,
    );

    const {context, cumulativePackageSize} = createRenderContext(
        locationUrl,
        globals,
        jsPackages,
        requestStats,
    );

    vmConstructionProfile.end();

    if (requestStats) {
        requestStats.createdVmContext = true;
        requestStats.vmContextSize = cumulativePackageSize;
    }

    return context;
}

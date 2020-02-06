// @flow

import {applyAbortPatch} from "./patch-promise.js";

import {ResourceLoader} from "jsdom";

import {getScopedLogger} from "./logging.js";
import fetchPackage from "./fetch_package.js";

import type {FetchOptions} from "jsdom";
import type {RequestStats} from "./types.js";

/**
 * Make sure any promises that get made have an abort.
 */
applyAbortPatch();

export class CustomResourceLoader extends ResourceLoader {
    _active: boolean;
    _requestStats: ?RequestStats;

    /**
     * We will return EMPTY in cases where we just don't care about the file
     * loading. Let's just reuse a promise for that.
     */
    static EMPTY = Promise.resolve(Buffer.from(""));

    constructor(requestStats?: RequestStats) {
        super();

        this._active = true;
        this._requestStats = requestStats;
    }

    get isActive(): boolean {
        return this._active;
    }

    close(): void {
        this._active = false;
    }

    _fetchJavaScript(url: string): Promise<Buffer> {
        const logging = getScopedLogger();
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

    fetch(url: string, options: FetchOptions): ?Promise<Buffer> {
        const logging = getScopedLogger();
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
            return CustomResourceLoader.EMPTY;
        }

        // If this is a JavaScript request, then we want to do some things to
        // request it ourselves, before we let JSDOM handle the result.
        return this._fetchJavaScript(url);
    }
}

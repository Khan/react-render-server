// @flow

/**
 * Fetch a package from the place that has packages.
 *
 * The server-side renderer takes, as input, a list of js packages, in
 * addition to the name of the react component to render.  This module
 * provides the function for taking the url of a package and
 * actually retrieving the package.
 *
 * The server that holds the package information is hard-coded in this
 * file, to avoid letting this server execute arbitrary code.
 */

import superagent from "superagent";
import superagentCachePlugin from "superagent-cache-plugin";
import cacheModule from "cache-service-cache-module";
import {gutResponse} from "superagent-cache-plugin/utils.js";

import args from "./arguments.js";
import profile from "./profile.js";
import logging from "./logging.js";

import type {JavaScriptPackage, RequestStats} from "./types.js";
import type {SuperAgentRequest} from "superagent";

type InflightRequests = {
    [url: string]: Promise<JavaScriptPackage>,
    ...,
};

// How many times we retry on 5xx error or similar, before giving up.
const DEFAULT_NUM_RETRIES: number = 2; // so 3 tries total

// What requests are currently in flight?
const inFlightRequests: InflightRequests = {};

/**
 * Setup caching stuff. We may not use it if caching isn't enabled
 * but it won't do any harm just sitting there.
 */
const cache = new cacheModule();
const superagentCache = superagentCachePlugin(cache);

/**
 * Flush the cache.
 */
export function flushCache() {
    /**
     * Guard this in case we never enabled caching.
     */
    if (args.useCache) {
        cache.flush();
    }
}

/**
 * Given a full url, e.g. http://kastatic.org/javascript/foo-package.js,
 * return a promise holding the package contents.  If requestStats is
 * defined, we update it with how many fetches we had to do.
 *
 * @returns {Promise<JavaScriptPackage>} A promise of an object
 * containing the content and the url from which it came.
 */
export default async function fetchPackage(
    url: string,
    requester: "JSDOM" | "SERVER" | "TEST",
    requestStats?: RequestStats,
    triesLeftAfterThisOne?: number = DEFAULT_NUM_RETRIES,
): Promise<JavaScriptPackage> {
    // If a different request has already asked for this url, just
    // tag along with it rather than making our own request.
    if (inFlightRequests[url]) {
        return inFlightRequests[url];
    }

    const getFetcher = (url: string, token: number): SuperAgentRequest => {
        // We give the fetcher 60 seconds to get a response.
        const fetcher = superagent.get(url).timeout(60000);

        if (!args.useCache) {
            return fetcher;
        }

        /**
         * We're caching.
         *
         * Set the expiration of the cache at 900 seconds (15 minutes).
         * This feels reasonable for now.
         */
        return fetcher
            .use(superagentCache)
            .expiration(900)
            .prune((response) => {
                /**
                 * We want to use our own `prune` method so that we can track
                 * what comes from cache versus what doesn't.
                 *
                 * But we still do the same thing that superagent-cache would
                 * do, for now.
                 */
                const guttedResponse = gutResponse(response);
                guttedResponse._token = token;
                return guttedResponse;
            });
    };

    const doFetch = async (token: number): Promise<JavaScriptPackage> => {
        // Let's profile this activity.
        // We start the profiling when the promise is executed.
        const isRetry = triesLeftAfterThisOne < DEFAULT_NUM_RETRIES;
        const retryText = isRetry
            ? ` RETRY#: ${DEFAULT_NUM_RETRIES - triesLeftAfterThisOne}`
            : "";
        const fetchProfile = profile.start(
            `FETCH(${requester}): ${url}${retryText}`,
        );

        // This is a helper function to terminate the profiling with a suitable
        // message.
        const reportFetchTime = (success: boolean): void => {
            fetchProfile.end(
                `${
                    success ? "FETCH_PASS" : "FETCH_FAIL"
                }(${requester}): ${url}${retryText}`,
                success ? "debug" : "error",
            );
        };

        // Now create the request.
        const fetcher = getFetcher(url, token);

        let success = false;
        try {
            // Now we handle when the request ends, either successfully or
            // otherwise.
            const result = await fetcher.buffer();
            success = true;

            // (Note: when running tests, our key may not be in
            // inFlightRequests, if this promise resolves after the
            // termination of the test.  In that case, we can just bail,
            // since the test isn't running anymore anyway.)
            if (!inFlightRequests[url]) {
                throw new Error("We've moved on to other tests, my friend");
            }

            if (result._token == null || result._token === token) {
                logging.silly(`From request: ${url}`);
                requestStats && requestStats.packageFetches++;
            } else {
                logging.silly(`From cache: ${url}`);
                requestStats && requestStats.fromCache++;
            }

            return {
                content: result.text,
                url,
            };
        } finally {
            reportFetchTime(success);
            // The request is done: don't say it's inflight anymore!
            delete inFlightRequests[url];
        }
    };

    /**
     * We pass a token to `doFetch` so we can track cache usage.
     */
    const fetchPromise = doFetch(Date.now()).catch((err) => {
        if (
            err.response &&
            err.response.status >= 400 &&
            err.response.status < 500
        ) {
            // One could imagine adding a 'negative' cache
            // entry for 4xx errors, maybe with a maxAge of 1
            // minute, but unless we see this being a problem
            // in practice it's not worth the code complexity.
            throw err;
        }

        // If we get here, we have a 5xx error or similar
        // (socket timeout, maybe).  Let's retry a few times.
        if (triesLeftAfterThisOne > 0) {
            return fetchPackage(
                url,
                requester,
                requestStats,
                triesLeftAfterThisOne - 1,
            );
        }

        // OK, I give up.
        throw err;
    });

    // Let other concurrent requests know that we're fetching this
    // url, so they don't try to do it too.
    inFlightRequests[url] = fetchPromise;
    return fetchPromise;
}

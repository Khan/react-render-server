/* eslint-disable */
/** TODO(jeff): Re-enable eslint and fix issues once PR #17 lands */
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

"use strict";

const request = require("superagent");

const profile = require("./profile.js");

// How many times we retry on 5xx error or similar, before giving up.
const numRetries = 2; // so 3 tries total

// What requests are currently in flight?
const inFlightRequests = {};

/**
 * Given a full url, e.g. http://kastatic.org/javascript/foo-package.js,
 * return a promise holding the package contents.  If requestStats is
 * defined, we update it with how many fetches we had to do.
 *
 * @returns {Promise<{content: string, url: string}>} A promise of an object
 * containing the content and the url from which it came.
 */
const fetchPackage = function(url, requestStats, triesLeftAfterThisOne) {
    if (triesLeftAfterThisOne == null) {
        triesLeftAfterThisOne = numRetries;
    }

    // If a different request has already asked for this url, just
    // tag along with it rather than making our own request.
    if (inFlightRequests[url]) {
        return inFlightRequests[url];
    }

    // Let's profile this activity.
    const fetchProfile = profile.start(`FETCH: ${url}`);

    // This is a helper function to terminate the profiling with a suitable
    // message.
    const reportFetchTime = (success) => {
        fetchProfile.end(
            `${success ? "FETCH_PASS" : "FETCH_FAIL"} ${url}`,
            success ? "debug" : "error",
        );
    };

    const fetchPromise = new Promise((resolve, reject) => {
        // Now create the request.
        const fetcher = request.get(url);

        // We give the fetcher 60 seconds to get a response.
        fetcher.timeout(60000);

        // Now we handle when the request ends, either successfully or
        // otherwise.
        fetcher.buffer().end((err, res) => {
            // The request is done: don't say it's inflight anymore!
            // (Note: when running tests, our key may not be in
            // inFlightRequests, if this promise resolves after the
            // termination of the test.  In that case, we can just bail,
            // since the test isn't running anymore anyway.)
            if (!inFlightRequests[url]) {
                reject("We've moved on to other tests, my friend");
                return;
            }
            delete inFlightRequests[url];

            if (err) {
                if (
                    err.response &&
                    err.response.status >= 400 &&
                    err.response.status < 500
                ) {
                    // One could imagine adding a 'negative' cache
                    // entry for 4xx errors, maybe with a maxAge of 1
                    // minute, but unless we see this being a problem
                    // in practice it's not worth the code complexity.
                    reject(err);
                    return;
                }
                // If we get here, we have a 5xx error or similar
                // (socket timeout, maybe).  Let's retry a few times.
                if (triesLeftAfterThisOne > 0) {
                    fetchPackage(
                        url,
                        requestStats,
                        triesLeftAfterThisOne - 1,
                    ).then(resolve, reject);
                    return;
                }

                // OK, I give up.
                reject(err);
            } else {
                if (requestStats) {
                    requestStats.packageFetches++;
                }
                resolve({
                    content: res.text,
                    url,
                });
            }
        });
    });

    // Terminate the profiling.
    fetchPromise.then(
        () => reportFetchTime(true),
        () => reportFetchTime(false),
    );

    const retval = fetchPromise;

    // Let other concurrent requests know that we're fetching this
    // url, so they don't try to do it too.
    inFlightRequests[url] = retval;
    return retval;
};

module.exports = fetchPackage;

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

'use strict';

const vm = require("vm");

const request = require('superagent');
const logging = require("./logging.js");

const profile = require("./profile.js");

// How many times we retry on 5xx error or similar, before giving up.
const numRetries = 2; // so 3 tries total

// What requests are currently in flight?
const inFlightRequests = {};

/**
 * Given a full url, e.g. http://kastatic.org/javascript/foo-package.js,
 * return a promise holding the package contents.  If requestStats is
 * defined, we update it with how many fetches we had to do.
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

    // TODO(jeff): Do we still need this profiling now that we're using
    // stackdriver profiler and our other logging?
    const fetchProfile = profile.start("fetching " + url);

    const fetchPromise = new Promise((realResolve, realReject) => {
        // Log the time before we make the URL request.
        const startStamp = Date.now();

        // Now create the request.
        const fetcher = request.get(url);

        // We give the fetcher 60 seconds to get a response.
        // (Note the final promise returned by fetchPackage
        // will probably time out sooner, due to the race() below.)
        fetcher.timeout(60000);

        // This is a helper function for logging data about the fetch request.
        const reportFetchTime = (success) => {
            const duration = Date.now() - startStamp;
            logging.info(
                `${success ? "FETCH_PASS" : "FETCH_FAIL"}: ${duration} ${url}`,
            );
        };

        // We wrap the resolve and reject so that we can capture the timings,
        // allowing us to use logs to make decisions about timeout and caching
        // strategies.
        const resolve = (...args) => {
            reportFetchTime(true);
            return realResolve(...args);
        };

        const reject = (...args) => {
            reportFetchTime(false);
            return realReject(...args);
        };

        // Now we handle when the request ends, etiher successfully or
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
                if (err.response && err.response.status >= 400 &&
                        err.response.status < 500) {
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
                    fetchPackage(url, requestStats, triesLeftAfterThisOne - 1)
                        .then(resolve, reject);
                    return;
                }

                // OK, I give up.
                reject(err);
            } else {
                const script = new vm.Script(res.text, {filename: url})
                // Pass in a size estimate; it's really just an estimate
                // though as we don't consider anything but the script text.
                // Since we're running in node, we assume 2 bytes
                // per character in the text. We aren't accounting for
                // other info associated with that, though.
                // This is used in our request stats when determining how "big"
                // the code was to perform the current render.
                script.size = res.text.length * 2;
                if (requestStats) {
                    requestStats.packageFetches++;
                }
                resolve(script);
            }
        });
    });

    fetchPromise.then(function() {
        fetchProfile.end();
    });

    // This resolves to whichever promise finishes first.
    const retval = fetchPromise;

    // Let other concurrent requests know that we're fetching this
    // url, so they don't try to do it too.
    inFlightRequests[url] = retval;
    return retval;
};

module.exports = fetchPackage;

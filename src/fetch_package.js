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

const request = require('superagent');
const logging = require("winston");

const cache = require("./cache.js");
const profile = require("./profile.js");
const graphiteUtil = require("./graphite_util.js");

// fetchPackage takes a cacheBehavior property, which is one of these:
//    'yes': try to retrieve the object from the cache
//    'no': do not try to retrieve the object from the cache (but
//          still store it in the cache after retrieving it).
//    'ignore': do not try to retrieve the object from the cache,
//          nor try to store it in the cache.
//    'ims': retrieve the object from the cache, but use the
//          last-modified date on the result in order to do an
//          if-modified-since query.
// This variable controls the cache behavior that is used if the
// user does not pass in a value for cacheBehavior for fetchPackage().
let defaultCacheBehavior;

// How many times we retry on 5xx error or similar, before giving up.
let numRetries;

// What requests are currently in flight?
let inFlightRequests;


const resetGlobals = function() {
    defaultCacheBehavior = 'yes';
    numRetries = 2;     // so 3 tries total
    inFlightRequests = {};
};

resetGlobals();


/**
 * Given a full url, e.g. http://kastatic.org/javascript/foo-package.js,
 * return a promise holding the package contents.  If requestStats is
 * defined, we update it with how many fetches we had to do and in the case of
 * cacheBehavior==="yes", a `fromCache` count.
 */
const fetchPackage = function(url, cacheBehavior, requestStats,
                              triesLeftAfterThisOne) {
    if (cacheBehavior == null) {
        cacheBehavior = defaultCacheBehavior;
    }
    if (triesLeftAfterThisOne == null) {
        triesLeftAfterThisOne = numRetries;
    }

    // If a different request has already asked for this url, just
    // tag along with it rather than making our own request.
    const inFlightCacheKey = cacheBehavior + "." + url;
    if (inFlightRequests[inFlightCacheKey]) {
        return inFlightRequests[inFlightCacheKey];
    }

    let cachedValue;

    if (cacheBehavior === 'ims') {
        cachedValue = cache.get(url);
        // We'll save this for making the if-modified-since query later.
    } else if (cacheBehavior === 'yes') {
        cachedValue = cache.get(url);
        if (cachedValue != null) {
            if (requestStats) {
                requestStats.fromCache++;
            }
            return Promise.resolve(cachedValue.text);
        }
    }

    // TODO(jeff): Do we still need this profiling now that we're using
    // stackdriver profiler and our other logging?
    const fetchProfile = profile.start("fetching " + url);

    const fetchPromise = new Promise((realResolve, realReject) => {
        // Log the time before we make the URL request.
        const startStamp = Date.now();

        // Now create the request.
        const fetcher = request.get(url);

        // We give the fetcher 60 seconds to get a response that we
        // can cache.  (Note the final promise returned by fetchPackage
        // will probably time out sooner, due to the race() below.)
        fetcher.timeout(60000);
        if (cachedValue && cachedValue.header['last-modified']) {
            fetcher.set('if-modified-since',
                        cachedValue.header['last-modified']);
        }

        // This is a helper function for logging data about the fetch request.
        const reportFetchTime = (success) => {
            const duration = Date.now() - startStamp;

            graphiteUtil.log(
                success
                    ? "react_render_server.stats.fetch_time_ms"
                    : "react_render_server.stats.failed_fetch_time_ms",
                duration,
            );

            logging.info(
                `${success ? "FETCH_PASS" : "FETCH_FAIL"}: ${duration} ${url}`,
            );
        };

        // We wrap the resolve and reject so that we can capture the timings,
        // allowing us to use logs and graphite data to make decisions about
        // timeout and caching strategies.
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
            if (!inFlightRequests[inFlightCacheKey]) {
                reject("We've moved on to other tests, my friend");
                return;
            }
            delete inFlightRequests[inFlightCacheKey];

            if (err) {
                // Due to a superagent bug(?), 304 "Not modified" ends up here.
                if (err.response && err.response.status === 304) {
                    if (requestStats) {
                        requestStats.packageFetches++;
                    }
                    resolve(cachedValue.text);
                    return;
                }
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
                    fetchPackage(url, cacheBehavior, requestStats,
                                 triesLeftAfterThisOne - 1)
                        .then(resolve, reject);
                    return;
                }

                // OK, I give up.
                reject(err);
            } else {
                // Estimate the size of `res` to just be the size of the
                // response body (we ignore headers and struct overhead).
                if (cacheBehavior !== 'ignore') {
                    cache.set(url, res, res.text.length);
                }
                if (requestStats) {
                    requestStats.packageFetches++;
                }
                resolve(res.text);
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
    inFlightRequests[inFlightCacheKey] = retval;
    return retval;
};

fetchPackage.setDefaultCacheBehavior = function(cacheBehavior) {
    defaultCacheBehavior = cacheBehavior;
};

// Used by tests.
fetchPackage.resetGlobals = resetGlobals;

module.exports = fetchPackage;

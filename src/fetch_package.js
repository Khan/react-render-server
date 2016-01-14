'use strict';

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

const request = require('superagent');

const cache = require("./cache");

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

// How long we wait on a single http request before giving up.  Note
// that due to retries, a single fetchPackage() call can take 3 times
// as long as this.
let defaultTimeoutInMs;

// How many times we retry on 5xx error or similar, before giving up.
let numRetries;

// What requests are currently in flight?
let inFlightRequests;


const resetGlobals = function() {
    defaultCacheBehavior = 'yes';
    defaultTimeoutInMs = 1000;
    numRetries = 2;     // so 3 tries total
    inFlightRequests = {};
};

resetGlobals();


/**
 * Given a full url, e.g. http://kastatic.org/javascript/foo-package.js,
 * return a promise holding the package contents.
 */
const fetchPackage = function(url, cacheBehavior, triesLeftAfterThisOne) {
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
            return Promise.resolve(cachedValue.text);
        }
    }

    const retval = new Promise((resolve, reject) => {
        const fetcher = request.get(url);
        // TODO(csilvers): always take 60 seconds here, and have the caller
        // abort after defaultTimeoutInMs (so we can still populate the cache).
        if (defaultTimeoutInMs != null) {
            fetcher.timeout(defaultTimeoutInMs);
        }
        if (cachedValue && cachedValue.header['last-modified']) {
            fetcher.set('if-modified-since',
                        cachedValue.header['last-modified']);
        }
        fetcher.buffer().end((err, res) => {
            // The request is done: don't say it's inflight anymore!
            delete inFlightRequests[inFlightCacheKey];
            if (err) {
                // Due to a superagent bug(?), 304 "Not modified" ends up here.
                if (err.response && err.response.status === 304) {
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
                    fetchPackage(url, cacheBehavior,
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
                resolve(res.text);
            }
        });
    });

    // Let other concurrent requests know that we're fetching this
    // url, so they don't try to do it too.
    inFlightRequests[inFlightCacheKey] = retval;
    return retval;
};

fetchPackage.setDefaultCacheBehavior = function(cacheBehavior) {
    defaultCacheBehavior = cacheBehavior;
};

// Can set the timeout to null to turn off timeouts.
fetchPackage.setTimeout = function(timeout) {
    defaultTimeoutInMs = timeout;
};

// Used by tests.
fetchPackage.resetGlobals = resetGlobals;

module.exports = fetchPackage;

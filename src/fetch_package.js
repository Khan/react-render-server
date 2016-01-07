'use strict';

/**
 * Fetch a package from the place that has packages.
 *
 * The server-side renderer takes, as input, a list of js packages, in
 * addition to the name of the react component to render.  This module
 * provides the function for taking the url-path of a package and
 * actually retrieving the package.
 *
 * The server that holds the package information is hard-coded in this
 * file, to avoid letting this server execute arbitrary code.
 */

const request = require('superagent');

const cache = require("./cache");


// All files requested via /render are fetched via this hostname.
let serverHostname = 'https://www.khanacademy.org';

/**
 * Given an absolute path, e.g. /javascript/foo-package.js, return a
 * promise holding the package contents.
 */
const fetchPackage = function(path, bustCache) {
    const url = serverHostname + path;
    if (!bustCache) {
        const cachedValue = cache.get(url);
        if (cachedValue != null) {
            // TODO(csilvers): in dev, don't just return here, instead
            // make the request below but with an if-modified-since
            // equal to last-modified on this cache value.
            return Promise.resolve(cachedValue.text);
        }
    }

    return new Promise((resolve, reject) => {
        // TODO(csilvers): add fetch timeouts
        request.get(url).buffer().end((err, res) => {
            if (err) {
                // TODO(csilvers): add retrying.
                if (err.response && err.response.status >= 400 &&
                        err.response.status < 500) {
                    // TODO(csilvers): if it's a 4xx error, do a negative cache
                }
                reject(err);
            } else {
                // Estimate the size of `res` to just be the size of the
                // response body (we ignore headers and struct overhead).
                cache.set(url, res, res.text.length);
                resolve(res.text);
            }
        });
    });
};

fetchPackage.setServerHostname = function(newHostname) {
    serverHostname = newHostname;
};

module.exports = fetchPackage;





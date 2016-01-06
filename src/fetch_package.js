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


// All files requested via /render are fetched via this hostname.
let serverHostname = 'https://www.khanacademy.org';

/**
 * Given an absolute path, e.g. /javascript/foo-package.js, return a
 * promise holding the package contents.
 */
const fetchPackage = function(path, bustCache) {
    // TODO(csilvers): implement a cache

    return new Promise((resolve, reject) => {
        request.get(serverHostname + path).end((err, res) => {
            if (err) {
                // TODO(csilvers): add retrying.
                reject(err);
            } else {
                // TODO(csilvers): return a vm-compiled version of res
                resolve(res);
            }
        });
    });
};

fetchPackage.setServerHostname = function(newHostname) {
    serverHostname = newHostname;
};

module.exports = fetchPackage;





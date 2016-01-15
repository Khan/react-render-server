/**
 * A singleton LRU cache implementation.
 *
 * We cache the bejeezus out of our inputs for efficiency.
 * Unfortunately, bejeezuses take up a lot of memory, so we use a
 * cache to control that.
 */

'use strict';

const lruCache = require("lru-cache");

let gCache;

// cacheSize is in bytes.
const init = function(cacheSize) {
    if (gCache) {
        throw new Error("Only call cache.init once!");
    }
    // In order to figure out the size of cached items easily, we
    // require every item that you insert into the cache to be a pair:
    // [object, size].
    gCache = lruCache({
        max: cacheSize,
        length: obj => obj[1],
    });
};

const set = function(key, object, size) {
    if (size == null) {
        throw new Error("Size must be a specified and a number.");
    }
    gCache.set(key, [object, size]);
};

const get = function(key) {
    const val = gCache.get(key);
    if (val) {
        return val[0];
    }
    return undefined;
};

const reset = function() {
    if (gCache) {
        gCache.reset();
    }
};

// Use this only for tests!
const destroy = function() {
    gCache = undefined;
};

module.exports = {init: init, get: get, set: set, reset: reset,
                  destroy: destroy};

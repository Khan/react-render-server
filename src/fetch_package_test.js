'use strict';
/* global describe, it, before, beforeEach, afterEach, after */

const assert = require("chai").assert;
const nock = require("nock");

const cache = require("./cache.js");
const fetchPackage = require("./fetch_package.js");


describe('fetchPackage', () => {
    let mockScope;

    before(() => {
        nock.disableNetConnect();
        nock.enableNetConnect('127.0.0.1');
    });

    beforeEach(() => {
        mockScope = nock('https://www.khanacademy.org');
        cache.init(10000);
    });

    afterEach(() => {
        nock.cleanAll();
        cache.destroy();
    });

    it("should fetch files", () => {
        mockScope.get("/ok.js").reply(200, "'yay!'");

        return fetchPackage("/ok.js").then(res => {
            assert.equal(res, "'yay!'");
            mockScope.done();
        });
    });

    it("should use the cache", () => {
        // What we return for the first call and the second call.
        mockScope.get("/ok.js").reply(200, "'yay!'");
        mockScope.get("/ok.js").reply(200, "new");
        return fetchPackage("/ok.js").then((res) => {
            return fetchPackage("/ok.js");
        }).then((res) => {
            // Should still have the cached value.
            assert.equal(res, "'yay!'");
            // We shouldn't have even fetched /ok.js the second time.
            assert.equal(1, mockScope.pendingMocks().length);
        });
    });

    it("should be able to bust the cache", () => {
        // What we return for the first call and the second call.
        mockScope.get("/ok.js").reply(200, "'yay!'");
        mockScope.get("/ok.js").reply(200, "new");
        return fetchPackage("/ok.js").then((res) => {
            return fetchPackage("/ok.js", true);
        }).then((res) => {
            // Should have the new value due to the 'true' above.
            assert.equal(res, "new");
            mockScope.done();
        });
    });

    it("should not be cached if it's too big", () => {
        cache.destroy();
        cache.init(3);     // only allow 3 bytes in the cache
        // What we return for the first call and the second call.
        mockScope.get("/ok.js").reply(200, "'yay!'");
        mockScope.get("/ok.js").reply(200, "new");
        return fetchPackage("/ok.js").then((res) => {
            return fetchPackage("/ok.js");
        }).then((res) => {
            // Should have the new value due to being too big for the cache.
            assert.equal(res, "new");
            mockScope.done();
        });
    });

    it("should remove old things but not new ones", () => {
        cache.destroy();
        // Allow 30 bytes in the cache; enough for 'early to the
        // party' and 'late to the party' but not both.  (And room for
        // 'boo!' with either.)
        cache.init(30);
        // What we return for the first call and the second call.
        mockScope.get("/ok.js").reply(200, "'early to the party'");
        mockScope.get("/ok2.js").reply(200, "'late to the party'");
        mockScope.get("/ok.js").reply(200, "'boo!'");
        mockScope.get("/ok2.js").reply(200, "'ignored: cached'");
        return fetchPackage("/ok.js").then((res) => {
            assert.equal(res, "'early to the party'");
            return fetchPackage("/ok2.js");
        }).then((res) => {
            assert.equal(res, "'late to the party'");
            return fetchPackage("/ok.js");
        }).then((res) => {
            // This value should be fetched anew because ok.js should
            // have been evicted from the cache.
            assert.equal(res, "'boo!'");
            return fetchPackage("/ok2.js");
        }).then((res) => {
            // This should still be in the cache.
            assert.equal(res, "'late to the party'");
            // We shouldn't have fetched /ok2.js the second time.
            assert.equal(1, mockScope.pendingMocks().length);
        });
    });
});

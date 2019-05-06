'use strict';
/* global describe, it, before, beforeEach, afterEach, after */

const assert = require("chai").assert;
const nock = require("nock");

const cache = require("./cache.js");
const fetchPackage = require("./fetch_package.js");


// Return a function that can be used in nock.reply(), that
// automatically gives a 304 if the request header indicates.
// (Pretending that this resource was last modified at the given
// lastModified time).  Otherwise, it gives back a 200 with the
// specified reply.
const maybe304 = function(lastModified, reply) {
    return function() {
        // We have acces to nock's 'this'.
        if (this.req.headers['if-modified-since']) {
            const ims = Date.parse(this.req.headers['if-modified-since']);
            const lm = Date.parse(lastModified);
            if (lm <= ims) {
                return [304, null];
            }
        }
        return [200, reply];
    };
};


describe('fetchPackage', () => {
    let mockScope;

    before(() => {
        nock.disableNetConnect();
        nock.enableNetConnect('127.0.0.1');
    });

    beforeEach(() => {
        global._fetched = undefined;
        mockScope = nock('https://www.ka.org');
        cache.init(10000);
        fetchPackage.resetGlobals();
    });

    afterEach(() => {
        global._fetched = undefined;
        nock.cleanAll();
        cache.destroy();
    });

    it("should fetch files", () => {
        mockScope.get("/ok.js").reply(200, "global._fetched = 'yay!';");

        return fetchPackage("https://www.ka.org/ok.js").then(res => {
            assert.isDefined(res);

            // Let's run the loaded script to verify it worked.
            res.runInThisContext();
            assert.equal(global._fetched, "yay!");
            mockScope.done();
        });
    });

    it("should fail on 4xx", (done) => {
        mockScope.get("/ok.js").reply(404, "global._fetched = 'boo';");

        fetchPackage("https://www.ka.org/ok.js").then(
            (res) => done(new Error("Should have failed on 4xx")),
            (err) => {
                assert.equal(404, err.response.status);
                done();
            });
    });

    it("should use the cache", () => {
        // What we return for the first call and the second call.
        mockScope.get("/ok.js").reply(200, "global._fetched = 'yay!';");
        mockScope.get("/ok.js").reply(200, "global._fetched = 'new';");
        return fetchPackage("https://www.ka.org/ok.js").then((res) => {
            return fetchPackage("https://www.ka.org/ok.js");
        }).then((res) => {
            assert.isDefined(res);
            // Let's run the loaded script to verify it worked.
            res.runInThisContext();

            // Should still have the cached value.
            assert.equal(global._fetched, "yay!");

            // We shouldn't have even fetched /ok.js the second time.
            assert.equal(1, mockScope.pendingMocks().length);
        });
    });

    it("should be able to bust the cache", () => {
        // What we return for the first call and the second call.
        mockScope.get("/ok.js").reply(200, "global._fetched = 'yay!';");
        mockScope.get("/ok.js").reply(200, "global._fetched = 'new';");
        return fetchPackage("https://www.ka.org/ok.js").then((res) => {
            return fetchPackage("https://www.ka.org/ok.js", 'no');
        }).then((res) => {
            assert.isDefined(res);
            // Let's run the loaded script to verify it worked.
            res.runInThisContext();

            // Should have the new value due to the 'true' above.
            assert.equal(global._fetched, "new");
            mockScope.done();
        });
    });

    it("should not be cached if it's too big", () => {
        cache.destroy();
        cache.init(3);     // only allow 3 bytes in the cache
        // What we return for the first call and the second call.
        mockScope.get("/ok.js").reply(200, "global._fetched = 'yay!';");
        mockScope.get("/ok.js").reply(200, "global._fetched = 'new';");
        return fetchPackage("https://www.ka.org/ok.js").then((res) => {
            return fetchPackage("https://www.ka.org/ok.js");
        }).then((res) => {
            assert.isDefined(res);
            // Let's run the loaded script to verify it worked.
            res.runInThisContext();

            // Should have the most recent value due to all results being too
            // big for the cache.
            assert.equal(global._fetched, "new");
            mockScope.done();
        });
    });

    it("should remove old things but not new ones", () => {
        cache.destroy();
        // Allow 150 bytes in the cache; enough for 'early to the
        // party' and 'late to the party' but not both.  (And room for
        // 'boo!' with either.)
        // NOTE(jeff): Given we now cache Script objects, I found a value that
        // worked for this test through trial and error.
        // The text for the scripts only needs about 80 bytes, but there's
        // overhead for being in a Script.
        cache.init(150);
        // What we return for the first call and the second call.
        mockScope.get("/ok.js").reply(200, "global._fetched = 'early to the party';");
        mockScope.get("/ok2.js").reply(200, "global._fetched = 'late to the party';");
        mockScope.get("/ok.js").reply(200, "global._fetched = 'boo!';");
        mockScope.get("/ok2.js").reply(200, "global._fetched = 'ignored: cached';");
        return fetchPackage("https://www.ka.org/ok.js").then((res) => {
            res.runInThisContext();
            assert.equal(global._fetched, "early to the party");
            return fetchPackage("https://www.ka.org/ok2.js");
        }).then((res) => {
            res.runInThisContext();
            assert.equal(global._fetched, "late to the party");
            return fetchPackage("https://www.ka.org/ok.js");
        }).then((res) => {
            // This value should be fetched anew because ok.js should
            // have been evicted from the cache.
            res.runInThisContext();
            assert.equal(global._fetched, "boo!");
            return fetchPackage("https://www.ka.org/ok2.js");
        }).then((res) => {
            // This should still be in the cache.
            res.runInThisContext();
            assert.equal(global._fetched, "late to the party");
            // We shouldn't have fetched /ok2.js the second time.
            assert.equal(1, mockScope.pendingMocks().length);
        });
    });

    it("should use the cache when appropriate in ims mode", () => {
        // 'lm' == 'last-modified'
        const lmDate = 'Thu, 07 Jan 2016 23:47:52 GMT';
        const lmBefore = 'Thu, 07 Jan 2016 23:47:50 GMT';
        const lmAfter = 'Thu, 07 Jan 2016 23:47:55 GMT';

        mockScope.get("/ok.js").reply(200, "global._fetched = 'hi';",
                                      {'Last-modified': lmDate});
        mockScope.get("/ok.js").reply(maybe304(lmDate, "global._fetched = 'no-see-um';"));
        mockScope.get("/ok.js").reply(maybe304(lmBefore, "global._fetched = 'no-see-um 2';"));
        mockScope.get("/ok.js").reply(maybe304(lmAfter, "global._fetched = 'new content';"));
        return fetchPackage("https://www.ka.org/ok.js", 'ims').then((res) => {
            // Original fetch
            res.runInThisContext();
            assert.equal(global._fetched, "hi");
            return fetchPackage("https://www.ka.org/ok.js", 'ims');
        }).then((res) => {
            // lmDate
            res.runInThisContext();
            assert.equal(global._fetched, "hi");
            return fetchPackage("https://www.ka.org/ok.js", 'ims');
        }).then((res) => {
            // lmAfter
            res.runInThisContext();
            assert.equal(global._fetched, "hi");
            return fetchPackage("https://www.ka.org/ok.js", 'ims');
        }).then((res) => {
            // lmBefore
            res.runInThisContext();
            assert.equal(global._fetched, "new content");
            mockScope.done();
        });
    });

    it("should ignore last-modified in 'yes' mode", () => {
        const lmDate = 'Thu, 07 Jan 2016 23:47:52 GMT';
        const lmBefore = 'Thu, 07 Jan 2016 23:47:50 GMT';
        const lmAfter = 'Thu, 07 Jan 2016 23:47:55 GMT';

        mockScope.get("/ok.js").reply(200, "global._fetched = 'hi';",
                                      {'Last-modified': lmDate});
        mockScope.get("/ok.js").reply(maybe304(lmDate, "global._fetched = 'no-see-um';"));
        mockScope.get("/ok.js").reply(maybe304(lmBefore, "global._fetched = 'no-see-um 2';"));
        mockScope.get("/ok.js").reply(maybe304(lmAfter, "global._fetched = 'new content';"));
        return fetchPackage("https://www.ka.org/ok.js", 'yes').then((res) => {
            res.runInThisContext();
            assert.equal(global._fetched, "hi");
            return fetchPackage("https://www.ka.org/ok.js", 'yes');
        }).then((res) => {
            res.runInThisContext();
            assert.equal(global._fetched, "hi");
            return fetchPackage("https://www.ka.org/ok.js", 'yes');
        }).then((res) => {
            res.runInThisContext();
            assert.equal(global._fetched, "hi");
            return fetchPackage("https://www.ka.org/ok.js", 'yes');
        }).then((res) => {
            res.runInThisContext();
            assert.equal(global._fetched, "hi");
            // We should still have pending mocks; in 'yes' mode we
            // don't even hit the server when there's a cache hit.
            assert.notEqual(0, mockScope.pendingMocks().length);
        });
    });

    it("should only fetch once for concurrent requests", () => {
        mockScope.get("/ok.js").reply(200, "global._fetched = 'yay!';");
        mockScope.get("/ok.js").reply(200, "global._fetched = 'ignored';");

        return Promise.all(
            [fetchPackage("https://www.ka.org/ok.js"),
             fetchPackage("https://www.ka.org/ok.js")]
        ).then(e => {
            assert.equal(e[0], e[1]);
            // We should still have pending mocks; the second request
            // should never have gotten sent.
            assert.notEqual(0, mockScope.pendingMocks().length);
        });
    });

    it("should fetch twice with different cache modes", () => {
        mockScope.get("/ok.js").reply(200, "global._fetched = 'yay!';");
        mockScope.get("/ok.js").reply(200, "global._fetched = 'not ignored';");

        return Promise.all(
            [fetchPackage("https://www.ka.org/ok.js", "yes"),
             fetchPackage("https://www.ka.org/ok.js", "no")]
        ).then(e => {
            assert.notEqual(e[0], e[1]);
            mockScope.done();
        });
    });

    it("should retry on 5xx", (done) => {
        mockScope.get("/ok.js").reply(500, "global._fetched = 'boo';");
        mockScope.get("/ok.js").reply(500, "global._fetched = 'boo';");
        mockScope.get("/ok.js").reply(500, "global._fetched = 'boo';");

        fetchPackage("https://www.ka.org/ok.js").then(
            (res) => done(new Error("Should have failed on 4xx")),
            (err) => {
                assert.equal(500, err.response.status);
                mockScope.done();
                done();
            }).catch(done);
    });

    it("should succeed on 5xx followed by 200", () => {
        mockScope.get("/ok.js").reply(500, "global._fetched = 'boo';");
        mockScope.get("/ok.js").reply(200, "global._fetched = 'yay!';");

        return fetchPackage("https://www.ka.org/ok.js").then((res) => {
            res.runInThisContext();
            assert.equal(global._fetched, "yay!");
            mockScope.done();
        });
    });
});



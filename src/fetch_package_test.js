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
        mockScope = nock('https://www.ka.org');
        cache.init(10000);
        fetchPackage.resetGlobals();
    });

    afterEach(() => {
        nock.cleanAll();
        cache.destroy();
    });

    it("should fetch files", () => {
        mockScope.get("/ok.js").reply(200, "'yay!'");

        return fetchPackage("https://www.ka.org/ok.js").then(res => {
            assert.equal(res, "'yay!'");
            mockScope.done();
        });
    });

    it("should fail on 4xx", (done) => {
        mockScope.get("/ok.js").reply(404, "boo");

        fetchPackage("https://www.ka.org/ok.js").then(
            (res) => done(new Error("Should have failed on 4xx")),
            (err) => {
                assert.equal(404, err.response.status);
                done();
            });
    });

    it("should use the cache", () => {
        // What we return for the first call and the second call.
        mockScope.get("/ok.js").reply(200, "'yay!'");
        mockScope.get("/ok.js").reply(200, "new");
        return fetchPackage("https://www.ka.org/ok.js").then((res) => {
            return fetchPackage("https://www.ka.org/ok.js");
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
        return fetchPackage("https://www.ka.org/ok.js").then((res) => {
            return fetchPackage("https://www.ka.org/ok.js", 'no');
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
        return fetchPackage("https://www.ka.org/ok.js").then((res) => {
            return fetchPackage("https://www.ka.org/ok.js");
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
        return fetchPackage("https://www.ka.org/ok.js").then((res) => {
            assert.equal(res, "'early to the party'");
            return fetchPackage("https://www.ka.org/ok2.js");
        }).then((res) => {
            assert.equal(res, "'late to the party'");
            return fetchPackage("https://www.ka.org/ok.js");
        }).then((res) => {
            // This value should be fetched anew because ok.js should
            // have been evicted from the cache.
            assert.equal(res, "'boo!'");
            return fetchPackage("https://www.ka.org/ok2.js");
        }).then((res) => {
            // This should still be in the cache.
            assert.equal(res, "'late to the party'");
            // We shouldn't have fetched /ok2.js the second time.
            assert.equal(1, mockScope.pendingMocks().length);
        });
    });

    it("should use the cache when appropriate in ims mode", () => {
        // 'lm' == 'last-modified'
        const lmDate = 'Thu, 07 Jan 2016 23:47:52 GMT';
        const lmBefore = 'Thu, 07 Jan 2016 23:47:50 GMT';
        const lmAfter = 'Thu, 07 Jan 2016 23:47:55 GMT';

        mockScope.get("/ok.js").reply(200, "'hi'",
                                      {'Last-modified': lmDate});
        mockScope.get("/ok.js").reply(maybe304(lmDate, "'no-see-um'"));
        mockScope.get("/ok.js").reply(maybe304(lmBefore, "'no-see-um 2'"));
        mockScope.get("/ok.js").reply(maybe304(lmAfter, "'new content'"));
        return fetchPackage("https://www.ka.org/ok.js", 'ims').then((res) => {
            // Original fetch
            assert.equal(res, "'hi'");
            return fetchPackage("https://www.ka.org/ok.js", 'ims');
        }).then((res) => {
            // lmDate
            assert.equal(res, "'hi'");
            return fetchPackage("https://www.ka.org/ok.js", 'ims');
        }).then((res) => {
            // lmAfter
            assert.equal(res, "'hi'");
            return fetchPackage("https://www.ka.org/ok.js", 'ims');
        }).then((res) => {
            // lmBefore
            assert.equal(res, "'new content'");
            mockScope.done();
        });
    });

    it("should ignore last-modified in 'yes' mode", () => {
        const lmDate = 'Thu, 07 Jan 2016 23:47:52 GMT';
        const lmBefore = 'Thu, 07 Jan 2016 23:47:50 GMT';
        const lmAfter = 'Thu, 07 Jan 2016 23:47:55 GMT';

        mockScope.get("/ok.js").reply(200, "'hi'",
                                      {'Last-modified': lmDate});
        mockScope.get("/ok.js").reply(maybe304(lmDate, "'no-see-um'"));
        mockScope.get("/ok.js").reply(maybe304(lmBefore, "'no-see-um 2'"));
        mockScope.get("/ok.js").reply(maybe304(lmAfter, "'new content'"));
        return fetchPackage("https://www.ka.org/ok.js", 'yes').then((res) => {
            assert.equal(res, "'hi'");
            return fetchPackage("https://www.ka.org/ok.js", 'yes');
        }).then((res) => {
            assert.equal(res, "'hi'");
            return fetchPackage("https://www.ka.org/ok.js", 'yes');
        }).then((res) => {
            assert.equal(res, "'hi'");
            return fetchPackage("https://www.ka.org/ok.js", 'yes');
        }).then((res) => {
            assert.equal(res, "'hi'");
            // We should still have pending mocks; in 'yes' mode we
            // don't even hit the server when there's a cache hit.
            assert.notEqual(0, mockScope.pendingMocks().length);
        });
    });

    it("should only fetch once for concurrent requests", () => {
        mockScope.get("/ok.js").reply(200, "'yay!'");
        mockScope.get("/ok.js").reply(200, "'ignored'");

        return Promise.all(
            [fetchPackage("https://www.ka.org/ok.js"),
             fetchPackage("https://www.ka.org/ok.js")]
        ).then(e => {
            assert.equal(e[0], "'yay!'");
            assert.equal(e[1], "'yay!'");
            // We should still have pending mocks; the second request
            // should never have gotten sent.
            assert.notEqual(0, mockScope.pendingMocks().length);
        });
    });

    it("should fetch twice with different cache modes", () => {
        mockScope.get("/ok.js").reply(200, "'yay!'");
        mockScope.get("/ok.js").reply(200, "'not ignored'");

        return Promise.all(
            [fetchPackage("https://www.ka.org/ok.js", "yes"),
             fetchPackage("https://www.ka.org/ok.js", "no")]
        ).then(e => {
            assert.equal(e[0], "'yay!'");
            assert.equal(e[1], "'not ignored'");
            mockScope.done();
        });
    });

    it("should fail on response timeout", (done) => {
        // The important thing is that the timeout trigger in the
        // fetch code; we shouldn't wait so long it hits the
        // test-runner timeout.
        fetchPackage.setTimeout(20);

        mockScope.get("/ok.js").delay(500).reply(200, "'hi'");
        fetchPackage("https://www.ka.org/ok.js").then(
            (res) => done(new Error("Should have timed out")),
            (err) => {
                assert.equal(20, err.timeout);
                mockScope.done();
                done();
            }).catch(done);
    });

    it("should fail on connection timeout", (done) => {
        fetchPackage.setTimeout(20);

        // Due to retries, we'll try to fetch this thing 3 times.
        mockScope.get("/ok.js").delayConnection(500).reply(200, "'hi'");
        fetchPackage("https://www.ka.org/ok.js").then(
            (res) => done(new Error("Should have timed out")),
            (err) => {
                assert.equal(20, err.timeout);
                mockScope.done();
                done();
            }).catch(done);
    });

    it("should retry on 5xx", (done) => {
        mockScope.get("/ok.js").reply(500, "boo");
        mockScope.get("/ok.js").reply(500, "boo");
        mockScope.get("/ok.js").reply(500, "boo");

        fetchPackage("https://www.ka.org/ok.js").then(
            (res) => done(new Error("Should have failed on 4xx")),
            (err) => {
                assert.equal(500, err.response.status);
                mockScope.done();
                done();
            }).catch(done);
    });

    it("should succeed on 5xx followed by 200", () => {
        mockScope.get("/ok.js").reply(500, "boo");
        mockScope.get("/ok.js").reply(200, "'yay!'");

        return fetchPackage("https://www.ka.org/ok.js").then((res) => {
            assert.equal(res, "'yay!'");
            mockScope.done();
        });
    });
});



'use strict';
/* global describe, it, before, beforeEach, afterEach, after */

const assert = require("chai").assert;
const nock = require("nock");

const fetchPackage = require("./fetch_package.js");


describe('fetchPackage', () => {
    let mockScope;

    before(() => {
        nock.disableNetConnect();
        nock.enableNetConnect('127.0.0.1');
    });

    beforeEach(() => {
        global._fetched = undefined;
        mockScope = nock('https://www.ka.org');
    });

    afterEach(() => {
        global._fetched = undefined;
        nock.cleanAll();
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



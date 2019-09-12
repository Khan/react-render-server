"use strict";
/* global describe, it, before, beforeEach, afterEach, after */

const fs = require("fs");

const assert = require("chai").assert;
const logging = require("./logging.js");
const nock = require("nock");
const sinon = require("sinon");
const supertest = require("supertest");

const renderSecret = require("./secret.js");
const server = require("./server.js");

describe("API endpoint /_api/ping", () => {
    const agent = supertest.agent(server);

    it("should return pong", done => {
        agent.get("/_api/ping").expect("pong!\n", done);
    });
});

describe("API endpoint /_api/version", () => {
    const agent = supertest.agent(server);
    afterEach(function() {
        delete process.env["GAE_VERSION"];
    });

    it("should return the module version in production", done => {
        process.env["GAE_VERSION"] = "foo-version";
        agent.get("/_api/version").expect("foo-version\n", done);
    });

    it("should return the 'dev' in dev", done => {
        agent.get("/_api/version").expect("dev\n", done);
    });
});

describe("API endpoint /_ah/health", () => {
    const agent = supertest.agent(server);

    it("should return ok!", done => {
        agent.get("/_ah/health").expect("ok!\n", done);
    });
});

describe("API endpoint /_ah/start", () => {
    const agent = supertest.agent(server);

    it("should return ok!", done => {
        agent.get("/_ah/start").expect("ok!\n", done);
    });
});

describe("API endpoint /_ah/stop", () => {
    const agent = supertest.agent(server);

    it("should return ok!", done => {
        agent.get("/_ah/stop").expect("ok!\n", done);
    });
});

describe("API endpoint /render", function() {
    const agent = supertest.agent(server);

    let mockScope;
    let debugLoggingSpy;
    let errorLoggingSpy;

    before(() => {
        nock.disableNetConnect();
        nock.enableNetConnect("127.0.0.1");
    });

    beforeEach(() => {
        mockScope = nock("https://www.khanacademy.org");
        sinon
            .stub(renderSecret, "matches")
            .callsFake((secret, callback) =>
                callback(null, secret === "sekret"),
            );
        debugLoggingSpy = sinon.spy(logging, "debug");
        errorLoggingSpy = sinon.spy(logging, "error");
    });

    afterEach(() => {
        nock.cleanAll();
        renderSecret.matches.restore();
        logging.debug.restore();
        logging.error.restore();
    });

    it("should render a simple react component", async () => {
        // Arrange
        const testProps = {
            name: "number!",
        };
        const testJson = {
            urls: [
                "https://www.khanacademy.org/webpacked/common/1.js",
                "https://www.khanacademy.org/webpacked/common/2.js",
                "https://www.khanacademy.org/webpacked/common/3.js",
                "https://www.khanacademy.org/webpacked/common/style.css",
                "https://www.khanacademy.org/webpacked/simple/entry.js",
            ],
            props: testProps,
            secret: "sekret",
        };
        testJson.urls.forEach(url => {
            const path = url.substr("https://www.khanacademy.org".length);
            if (path.endsWith(".css")) {
                mockScope
                    .get(path)
                    .optionally()
                    .reply(404);
                return;
            }
            const contents = fs.readFileSync(
                `${__dirname}/testdata${path}`,
                "utf-8",
            );
            mockScope.get(path).reply(200, contents);
        });

        // Act
        // We test the actual rendered contents in render_test.js.  Here
        // we just test that we get *some* output.
        const result = await agent.post("/render").send(testJson);

        // Assert
        assert.ok(result.body.html);
        assert.include(result.body.html, "number!");
        assert.ok(result.body.css);
        mockScope.done();
    });

    it("should fail on invalid inputs", done => {
        const url = "https://www.khanacademy.org/foo";
        const invalidInputs = [
            {},
            {props: {bar: 4}, secret: "sekret"},
            {urls: [], props: {bar: 4}, secret: "sekret"},
            {urls: [1, 2], props: {bar: 4}, secret: "sekret"},
            {urls: ["foo"], props: {bar: 4}, secret: "sekret"},
            {urls: ["/foo"], props: {bar: 4}, secret: "sekret"},
            {urls: [url], props: {bar: 4}, secret: "sekret"},
            {urls: [url], props: "foo", secret: "sekret"},
            {urls: [url], props: [{}, {}], secret: "sekret"},
            {urls: [url], props: {bar: 4}},
            {urls: [url], props: {bar: 4}, secret: "bad"},
            {urls: [`${url}.css`], props: {bar: 4}, secret: "bad"},
        ];
        let remainingTests = invalidInputs.length;

        invalidInputs.forEach(testJson => {
            agent
                .post("/render")
                .send(testJson)
                .expect(res => assert.equal(400, res.status))
                .end(() => {
                    if (--remainingTests === 0) {
                        done();
                    }
                });
        });
    });

    it("should log render-stats", async () => {
        // Arrange
        const doneFake = sinon.fake();
        sinon.stub(logging, "startTimer").returns(
            {done: doneFake},
        );
        const testProps = {
            name: "number!",
        };
        const testJson = {
            urls: [
                "https://www.khanacademy.org/webpacked/common/1.js",
                "https://www.khanacademy.org/webpacked/common/2.js",
                "https://www.khanacademy.org/webpacked/common/3.js",
                "https://www.khanacademy.org/webpacked/common/style.css",
                "https://www.khanacademy.org/webpacked/simple/entry.js",
            ],
            props: testProps,
            secret: "sekret",
        };

        testJson.urls.forEach(url => {
            const path = url.substr("https://www.khanacademy.org".length);
            if (path.endsWith(".css")) {
                mockScope
                    .get(path)
                    .optionally()
                    .reply(404);
                return;
            }
            const contents = fs.readFileSync(
                `${__dirname}/testdata${path}`,
                "utf-8",
            );
            mockScope.get(path).reply(200, contents);
        });

        const expectedEntry =
            "PROFILE(end): render-stats for " +
            "https://www.khanacademy.org/webpacked/simple/entry.js";

        const expectedEntryWithStats =
            expectedEntry + ": {" +
            '"pendingRenderRequests":0,' +
            '"packageFetches":4,' +
            '"fromCache":0,' +
            '"vmContextSize":843478,' +
            '"createdVmContext":true' +
            "}";

        // Act
        await agent.post("/render").send(testJson);

        // Assert
        // We just make sure one of the logging.debug args has
        // the information we expect to be logged.
        let foundEntry = false;
        let matchedStats = undefined;
        doneFake.args.forEach(arglist => {
            arglist.forEach(({message}) => {
                if (typeof message === "string" && message.startsWith(expectedEntry)) {
                    foundEntry = true;
                    matchedStats = message;
                }
            });
        });
        assert.isTrue(
            foundEntry,
            `No stats entry like ${expectedEntry}.\n\n${JSON.stringify(doneFake.args)}`,
        );
        assert.equal(
            matchedStats,
            expectedEntryWithStats,
        );
        mockScope.done();
    });

    it("should log an error on fetching failure", async () => {
        // Arrange
        const testProps = {
            name: "number!",
        };
        const testJson = {
            urls: [
                "https://www.khanacademy.org/webpacked/common/1.js",
                "https://www.khanacademy.org/webpacked/common/2.js",
                "https://www.khanacademy.org/webpacked/common/3.js",
                "https://www.khanacademy.org/webpacked/common/style.css",
                "https://www.khanacademy.org/webpacked/simple/entry.js",
            ],
            path: "./javascript/server-package/test-component.jsx",
            props: testProps,
            secret: "sekret",
        };

        testJson.urls.forEach(url => {
            const path = url.substr("https://www.khanacademy.org".length);
            if (path.endsWith(".css")) {
                mockScope
                    .get(path)
                    .optionally()
                    .reply(404);
                return;
            }
            mockScope.get(path).reply(404);
        });

        const expected =
            "Fetching failure: Error: " +
            "cannot undefined /webpacked/common/1.js (404): ";

        // Act
        await agent.post("/render").send(testJson);

        // Assert
        let foundLogMessage = false;
        errorLoggingSpy.args.forEach(arglist => {
            arglist.forEach(arg => {
                if (arg === expected) {
                    foundLogMessage = true;
                }
            });
        });

        assert.equal(
            foundLogMessage,
            true,
            JSON.stringify(errorLoggingSpy.args),
        );
        mockScope.done();
    });
});

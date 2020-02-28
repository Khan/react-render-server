// @flow
import {rootLogger} from "./logging.js";
import fetchPackage, {flushCache, pruneKey} from "./fetch_package.js";
import args from "./arguments.js";
import {assert} from "chai";
import nock from "nock";
import sinon from "sinon";

describe("fetchPackage", () => {
    let mockScope;

    before(() => {
        nock.disableNetConnect();
        nock.enableNetConnect("127.0.0.1");
    });

    beforeEach(() => {
        global._fetched = undefined;
        mockScope = nock("https://www.ka.org");
    });

    afterEach(() => {
        global._fetched = undefined;
        nock.cleanAll();
    });

    it("should fetch files", async () => {
        // Arrange
        mockScope.get("/ok.js").reply(200, "global._fetched = 'yay!';");

        // Act
        const result = await fetchPackage(
            rootLogger,
            "https://www.ka.org/ok.js",
            "TEST",
        );

        // Assert
        assert.isDefined(result);
        assert.equal(result.url, "https://www.ka.org/ok.js");
        assert.equal(result.content, "global._fetched = 'yay!';");
        mockScope.done();
    });

    it("should retry on 4xx", async () => {
        // Arrange
        mockScope.get("/ok.js").reply(404, "global._fetched = 'boo';");
        mockScope.get("/ok.js").reply(404, "global._fetched = 'boo';");
        mockScope.get("/ok.js").reply(404, "global._fetched = 'boo';");

        // Act
        try {
            await fetchPackage(rootLogger, "https://www.ka.org/ok.js", "TEST");
        } catch (e) {
            // Assert
            assert.equal(404, e.response.status);
            mockScope.done();
            return;
        }
        throw new Error("Should have failed on 4xx");
    });

    it("should only fetch once for concurrent requests", async () => {
        // Arrange
        mockScope.get("/ok.js").reply(200, "global._fetched = 'yay!';");
        mockScope.get("/ok.js").reply(200, "global._fetched = 'ignored';");

        // Act
        const result = await Promise.all([
            fetchPackage(rootLogger, "https://www.ka.org/ok.js", "TEST"),
            fetchPackage(rootLogger, "https://www.ka.org/ok.js", "TEST"),
        ]);

        // Assert
        assert.equal(result[0], result[1]);
        // We should still have pending mocks; the second request
        // should never have gotten sent.
        assert.notEqual(0, mockScope.pendingMocks().length);
    });

    it("should retry on 5xx", async () => {
        // Arrange
        mockScope.get("/ok.js").reply(500, "global._fetched = 'boo';");
        mockScope.get("/ok.js").reply(500, "global._fetched = 'boo';");
        mockScope.get("/ok.js").reply(500, "global._fetched = 'boo';");

        // Act
        try {
            await fetchPackage(rootLogger, "https://www.ka.org/ok.js", "TEST");
        } catch (e) {
            // Assert
            assert.equal(500, e.response.status);
            mockScope.done();
            return;
        }

        throw new Error("Should have failed on 5xx");
    });

    it("should succeed on 4xx followed by 200", async () => {
        // Arrange
        mockScope.get("/ok.js").reply(404, "global._fetched = 'boo';");
        mockScope.get("/ok.js").reply(200, "global._fetched = 'yay!';");

        // Act
        const result = await fetchPackage(
            rootLogger,
            "https://www.ka.org/ok.js",
            "TEST",
        );

        // Assert
        assert.equal(result.url, "https://www.ka.org/ok.js");
        assert.equal(result.content, "global._fetched = 'yay!';");
        mockScope.done();
    });

    it("should succeed on 5xx followed by 200", async () => {
        // Arrange
        mockScope.get("/ok.js").reply(500, "global._fetched = 'boo';");
        mockScope.get("/ok.js").reply(200, "global._fetched = 'yay!';");

        // Act
        const result = await fetchPackage(
            rootLogger,
            "https://www.ka.org/ok.js",
            "TEST",
        );

        // Assert
        assert.equal(result.url, "https://www.ka.org/ok.js");
        assert.equal(result.content, "global._fetched = 'yay!';");
        mockScope.done();
    });
});

describe("fetchPackage with cache", () => {
    let mockScope;

    before(() => {
        nock.disableNetConnect();
        nock.enableNetConnect("127.0.0.1");
    });

    beforeEach(() => {
        global._fetched = undefined;
        mockScope = nock("https://www.ka.org");
        sinon.stub(args, "useCache").get(() => true);
    });

    afterEach(() => {
        flushCache();
        global._fetched = undefined;
        nock.cleanAll();
        sinon.restore();
    });

    it("should only fetch once for multiple requests", async () => {
        // Arrange
        mockScope.get("/ok.js").reply(200, "global._fetched = 'yay!';");
        mockScope.get("/ok.js").reply(200, "global._fetched = 'ignored';");

        // Act
        const result0 = await fetchPackage(
            rootLogger,
            "https://www.ka.org/ok.js",
            "TEST",
        );
        const result1 = await fetchPackage(
            rootLogger,
            "https://www.ka.org/ok.js",
            "TEST",
        );

        // Assert
        assert.equal(result0.content, result1.content);
        // We should still have pending mocks; the second request
        // should never have gotten sent.
        assert.notEqual(0, mockScope.pendingMocks().length);
    });

    it("should only fetch once for multiple requests even if URL is different", async () => {
        // Arrange
        mockScope
            .get("/genwebpack/prod/en/ok.js")
            .reply(200, "global._fetched = 'yay!';");
        mockScope
            .get("/genwebpack/prod/es/ok.js")
            .reply(200, "global._fetched = 'ignored';");

        // Act
        const result0 = await fetchPackage(
            rootLogger,
            "https://www.ka.org/genwebpack/prod/en/ok.js",
            "TEST",
        );
        const result1 = await fetchPackage(
            rootLogger,
            "https://www.ka.org/genwebpack/prod/es/ok.js",
            "TEST",
        );

        // Assert
        assert.equal(result0.content, result1.content);
        // We should still have pending mocks; the second request
        // should never have gotten sent.
        assert.notEqual(0, mockScope.pendingMocks().length);
    });

    it("should retry on 4xx even with cache", async () => {
        // Arrange
        mockScope.get("/ok.js").reply(404, "global._fetched = 'boo';");
        mockScope.get("/ok.js").reply(404, "global._fetched = 'boo';");
        mockScope.get("/ok.js").reply(404, "global._fetched = 'boo';");

        // Act
        try {
            await fetchPackage(rootLogger, "https://www.ka.org/ok.js", "TEST");
        } catch (e) {
            // Assert
            assert.equal(404, e.response.status);
            assert.equal(0, mockScope.pendingMocks().length);
            mockScope.done();
            return;
        }
        throw new Error("Should have failed on 4xx");
    });

    it("should retry on 5xx", async () => {
        // Arrange
        mockScope.get("/ok.js").reply(500, "global._fetched = 'boo';");
        mockScope.get("/ok.js").reply(500, "global._fetched = 'boo';");
        mockScope.get("/ok.js").reply(500, "global._fetched = 'boo';");

        // Act
        try {
            await fetchPackage(rootLogger, "https://www.ka.org/ok.js", "TEST");
        } catch (e) {
            // Assert
            assert.equal(500, e.response.status);
            assert.equal(0, mockScope.pendingMocks().length);
            mockScope.done();
            return;
        }

        throw new Error("Should have failed on 5xx");
    });

    it("should succeed on 4xx followed by 200", async () => {
        // Arrange
        mockScope.get("/ok.js").reply(404, "global._fetched = 'boo';");
        mockScope.get("/ok.js").reply(200, "global._fetched = 'yay!';");

        // Act
        const result = await fetchPackage(
            rootLogger,
            "https://www.ka.org/ok.js",
            "TEST",
        );

        // Assert
        assert.equal(result.url, "https://www.ka.org/ok.js");
        assert.equal(result.content, "global._fetched = 'yay!';");
        mockScope.done();
    });

    it("should succeed on 5xx followed by 200", async () => {
        // Arrange
        mockScope.get("/ok.js").reply(500, "global._fetched = 'boo';");
        mockScope.get("/ok.js").reply(200, "global._fetched = 'yay!';");

        // Act
        const result = await fetchPackage(
            rootLogger,
            "https://www.ka.org/ok.js",
            "TEST",
        );

        // Assert
        assert.equal(result.url, "https://www.ka.org/ok.js");
        assert.equal(result.content, "global._fetched = 'yay!';");
        mockScope.done();
    });
});

describe("pruneKey", () => {
    it("should not modify the URL for en", () => {
        // Arrange
        const key = {other: true, uri: "/genwebpack/prod/en/foo.js"};

        // Act
        const result = pruneKey(key);

        // Assert
        assert.deepEqual(result, key);
    });

    it("should not modify the URL for some other URL", () => {
        // Arrange
        const key = {other: true, uri: "/foo.js"};

        // Act
        const result = pruneKey(key);

        // Assert
        assert.deepEqual(result, key);
    });

    it("should modify the URL for non-en", () => {
        // Arrange
        const key = {other: true, uri: "/genwebpack/prod/es/foo.js"};

        // Act
        const result = pruneKey(key);

        // Assert
        assert.deepEqual(result, {
            other: true,
            uri: "/genwebpack/prod/en/foo.js",
        });
    });
});

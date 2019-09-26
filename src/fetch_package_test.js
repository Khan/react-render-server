// @flow

import fetchPackage from "./fetch_package.js";
import {assert} from "chai";
import nock from "nock";

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
        const result = await fetchPackage("https://www.ka.org/ok.js");

        // Assert
        assert.isDefined(result);
        assert.equal(result.url, "https://www.ka.org/ok.js");
        assert.equal(result.content, "global._fetched = 'yay!';");
        mockScope.done();
    });

    it("should fail on 4xx", async () => {
        // Arrange
        mockScope.get("/ok.js").reply(404, "global._fetched = 'boo';");

        // Act
        try {
            await fetchPackage("https://www.ka.org/ok.js");
        } catch (e) {
            // Assert
            assert.equal(404, e.response.status);
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
            fetchPackage("https://www.ka.org/ok.js"),
            fetchPackage("https://www.ka.org/ok.js"),
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
            await fetchPackage("https://www.ka.org/ok.js");
        } catch (e) {
            // Assert
            assert.equal(500, e.response.status);
            mockScope.done();
            return;
        }

        throw new Error("Should have failed on 5xx");
    });

    it("should succeed on 5xx followed by 200", async () => {
        // Arrange
        mockScope.get("/ok.js").reply(500, "global._fetched = 'boo';");
        mockScope.get("/ok.js").reply(200, "global._fetched = 'yay!';");

        // Act
        const result = await fetchPackage("https://www.ka.org/ok.js");

        // Assert
        assert.equal(result.url, "https://www.ka.org/ok.js");
        assert.equal(result.content, "global._fetched = 'yay!';");
        mockScope.done();
    });
});

// @flow
import * as sinon from "sinon";
import {assert} from "chai";
import {ResourceLoader} from "jsdom";
import {rootLogger as logging} from "./logging.js";
import * as FetchPackageModule from "./fetch_package.js";
import {CustomResourceLoader} from "./custom-resource-loader.js";

import type {RequestStats} from "./types.js";

describe("CustomResourceLoader", () => {
    afterEach(() => {
        sinon.restore();
    });

    describe("EMPTY", () => {
        it("should be a resolved promise of an empty Buffer", async () => {
            // Arrange
            const underTest = CustomResourceLoader.EMPTY;

            // Act
            const result = await underTest;

            // Assert
            assert.instanceOf(result, Buffer);
            assert.equal(result.toString(), "");
        });

        it("should have an abort function", () => {
            // Arrange
            // Cast to any so we can use abort method without flow complaints
            const underTest: any = CustomResourceLoader.EMPTY;

            // Act
            const result = underTest.abort;

            // Assert
            assert.typeOf(result, "function");
        });
    });

    describe("#constructor", () => {
        it("should set isActive to true", () => {
            // Arrange

            // Act
            const underTest = new CustomResourceLoader(logging);
            const result = underTest.isActive;

            // Assert
            assert.isTrue(result);
        });

        it("should derive from JSDOM ResourceLoader", () => {
            // Arrange

            // Act
            const underTest = new CustomResourceLoader(logging);

            // Assert
            assert.instanceOf(underTest, ResourceLoader);
        });
    });

    describe("#close", () => {
        it("should set isActive to false", () => {
            // Arrange
            const underTest = new CustomResourceLoader(logging);

            // Act
            underTest.close();
            const result = underTest.isActive;

            // Assert
            assert.isFalse(result);
        });
    });

    describe("#fetch", () => {
        describe("when not a JavaScript file", () => {
            it("should return EMPTY promise", () => {
                // Arrange
                const underTest = new CustomResourceLoader(logging);

                // Act
                const result = underTest.fetch(
                    "http://example.com/test.png",
                    {},
                );

                // Assert
                assert.equal(result, CustomResourceLoader.EMPTY);
            });
        });

        describe("when a JavaScript file", () => {
            it("should invoke fetchPackage", () => {
                // Arrange
                const fetchPackageSpy = sinon
                    .stub(FetchPackageModule, "default")
                    .returns(new Promise((resolve, reject) => {}));
                const underTest = new CustomResourceLoader(logging);

                // Act
                underTest.fetch("http://example.com/test.js", {});

                // Assert
                sinon.assert.calledWith(
                    fetchPackageSpy,
                    logging,
                    "http://example.com/test.js",
                    "JSDOM",
                );
            });

            it("should invoke fetchPackage with requestStats", () => {
                // Arrange
                const fetchPackageSpy = sinon
                    .stub(FetchPackageModule, "default")
                    .returns(new Promise((resolve, reject) => {}));
                const requestStats: RequestStats = {
                    pendingRenderRequests: 0,
                    packageFetches: 0,
                    fromCache: 0,
                    vmContextSize: 0,
                    createdVmContext: true,
                };
                const underTest = new CustomResourceLoader(
                    logging,
                    requestStats,
                );

                // Act
                underTest.fetch("http://example.com/test.js", {});

                // Assert
                sinon.assert.calledWith(
                    fetchPackageSpy,
                    logging,
                    "http://example.com/test.js",
                    "JSDOM",
                    requestStats,
                );
            });

            it("should resolve with buffer of content", async () => {
                // Arrange
                const content = "THIS IS CONTENT!";
                sinon
                    .stub(FetchPackageModule, "default")
                    .returns(Promise.resolve({content}));
                const underTest = new CustomResourceLoader(logging);

                // Act
                // It will not be null $FlowIgnore
                const result = await underTest.fetch(
                    "http://example.com/test.js",
                    {},
                );

                // Assert
                assert.instanceOf(result, Buffer);
                assert.equal(result.toString(), content);
            });

            it("should have abort that will invoke abort on underlying fetch", () => {
                // Arrange
                const fetchPromise = Promise.resolve({content: "CONTENT"});
                const abortSpy = sinon.spy(fetchPromise, "abort");
                sinon.stub(FetchPackageModule, "default").returns(fetchPromise);
                const underTest = new CustomResourceLoader(logging);

                // Act
                const result = underTest.fetch(
                    "http://example.com/test.js",
                    {},
                );
                // We know that this really exists because we patch it
                // to be there $FlowIgnore
                result.abort();

                // Assert
                sinon.assert.calledOnce(abortSpy);
            });

            it("should resolve to empty buffer if resolved after close()", async () => {
                // Arrange
                const clock = sinon.useFakeTimers();
                sinon.stub(FetchPackageModule, "default").returns(
                    new Promise((resolve, reject) => {
                        setTimeout(() => resolve({content: ""}), 0);
                    }),
                );
                const underTest = new CustomResourceLoader(logging);

                // Act
                const fetchPromise = underTest.fetch(
                    "http://example.com/test.js",
                    {},
                );
                underTest.close();
                clock.tick(1);
                // It will not be null $FlowIgnore
                const result = await fetchPromise;

                // Assert
                assert.instanceOf(result, Buffer);
                assert.equal(result.toString(), "");
            });

            it("should log silly if resolved after close()", async () => {
                // Arrange
                const clock = sinon.useFakeTimers();
                const sillySpy = sinon.spy(logging, "silly");
                sinon.stub(FetchPackageModule, "default").returns(
                    new Promise((resolve, reject) => {
                        setTimeout(() => resolve({content: ""}), 0);
                    }),
                );
                const underTest = new CustomResourceLoader(logging);

                // Act
                const fetchPromise = underTest.fetch(
                    "http://example.com/test.js",
                    {},
                );
                underTest.close();
                clock.tick(1);
                await fetchPromise;

                // Assert
                sinon.assert.calledWith(
                    sillySpy,
                    "File requested but never used (http://example.com/test.js)",
                );
            });
        });

        describe("when called after close(); isActive = false", () => {
            it("should log warning", () => {
                // Arrange
                const warnSpy = sinon.spy(logging, "warn");
                const underTest = new CustomResourceLoader(logging);
                underTest.close();

                // Act
                underTest.fetch("http://example.com", {});

                // Assert
                sinon.assert.calledWith(
                    warnSpy,
                    "File fetch tried by JSDOM after render (http://example.com)",
                );
            });

            it("should return EMPTY", () => {
                // Arrange
                const underTest = new CustomResourceLoader(logging);
                underTest.close();

                // Act
                const result = underTest.fetch("http://example.com", {});

                // Assert
                assert.equal(result, CustomResourceLoader.EMPTY);
            });
        });
    });
});

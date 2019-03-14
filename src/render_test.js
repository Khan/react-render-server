'use strict';
/* global describe, it, before, beforeEach, afterEach, after */

const fs = require("fs");
const jsdom = require("jsdom");

const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);
const {assert} = chai;

const sinon = require("sinon");

const cache = require("./cache.js");
const render = require("./render.js");

describe("render", () => {
    const loadPackages = packageNames => packageNames.map(filename => {
        const filepath = `${__dirname}/testdata/${filename}`;
        return {
            url: filename,
            content: fs.readFileSync(filepath, "utf-8"),
        };
    });

    beforeEach(() => {
        render.resetGlobals();
        cache.init(1000000);

        sinon.spy(jsdom, "JSDOM");
        sinon.spy(cache, "get");
        sinon.spy(cache, "set");
    });

    afterEach(() => {
        render.resetGlobals();
        cache.destroy();

        jsdom.JSDOM.restore();
        cache.get.restore();
        cache.set.restore();
    });

    it("should perform basic render flow", async () => {
        // Arrange
        const packages = loadPackages(["basic/entry.js"]);
        const props = {
            name: "NAME",
            date: "DATE",
        };
        const expectation = {
            html: 'HTML: {"name":"NAME","date":"DATE"}',
            css: 'CSS: {"name":"NAME","date":"DATE"}',
        };

        // Act
        const result = await render(packages, props);

        // Assert
        assert.deepEqual(result, expectation);
    });

    it("should render a simple webpacked react component", async () => {
        // Arrange
        const packages = loadPackages([
            "webpacked/common/1.js",
            "webpacked/common/2.js",
            "webpacked/common/3.js",
            "webpacked/simple/entry.js",
        ]);
        const props = {
            name: "NAME",
        };
        const expectation = {
            css: {
                content: "",
                renderedClassNames: [],
            },
            html: "<div data-reactroot=\"\">This is an amazing <!-- -->NAME<!-- --> Test Component!</div>",
        };

        // Act
        const result = await render(packages, props);

        // Assert
        assert.deepEqual(result, expectation);
    });

    it("should render a simple react component including aphrodite", async () => {
        // Arrange
        const packages = loadPackages([
            "webpacked/common/1.js",
            "webpacked/common/2.js",
            "webpacked/common/3.js",
            "webpacked/with-aphrodite/entry.js",
        ]);
        const props = {
            name: "APHRODITE!",
        };
        const expectation = {
            css: {
                content: ".sostyle_1nxhvta{background:blue !important;}",
                renderedClassNames: [
                    "sostyle_1nxhvta"
                ],
            },
            html: "<div class=\"sostyle_1nxhvta\" data-reactroot=\"\">This is an amazing <!-- -->APHRODITE!<!-- --> Test Component!</div>",
        };

        // Act
        const result = await render(packages, props);

        // Assert
        assert.deepEqual(result, expectation);
    });

    it('should pull context from cache, even with different props', async () => {
        // Arrange
        const packages = loadPackages(["basic/entry.js"]);

        // Act
        await render(packages, {name: "NAME"});
        await render(packages, {name: "NAME"});
        await render(packages, {name: "DIFFERENT NAME"});

        // Assert
        assert.equal(
            jsdom.JSDOM.callCount,
            1,
            "This test can fail if the cache is not big enough",
        );
    });

    it('should render the same thing for the same parameters', async () => {
         // Arrange
         const packages = loadPackages(["basic/entry.js"]);
         const expectation = await render(packages, {name: "A NAME"});

         // Act
         const result = await render(packages, {name: "A NAME"});

         // Assert
         assert.deepEqual(result, expectation);
    });

    it("should render the same thing differently with different props", async () => {
         // Arrange
         const packages = loadPackages(["basic/entry.js"]);
         const expectation = await render(packages, {name: "A NAME"});

         // Act
         const result = await render(packages, {name: "A DIFFERENT NAME"});

         // Assert
         assert.notDeepEqual(result, expectation);
    });

    it('should not pull context from cache when asked not to', async () => {
        // Arrange
         const packages = loadPackages(["basic/entry.js"]);

         // Act
         await render(packages, {name: "A NAME"});
         await render(packages, {name: "A NAME"}, {}, "no");

         // Assert
         assert.equal(jsdom.JSDOM.callCount, 2);
    });

    it('should still fill the cache when cacheBehavior is "no"', async () => {
        // Arrange
         const packages = loadPackages(["basic/entry.js"]);

         // Act
         await render(packages, {name: "A NAME"}, {}, "no");

         // Assert
         assert.equal(1, cache.set.callCount);
    });

    it('should not use cache at all when asked not to', async () => {
        // Arrange
         const packages = loadPackages(["basic/entry.js"]);
         render.setDefaultCacheBehavior('ignore');

         // Act
         await render(packages, {name: "A NAME"});

         // Assert
         assert.equal(0, cache.get.callCount);
         assert.equal(0, cache.set.callCount);
    });

    it('should use different cache keys for different package lists', async () => {
        // Arrange
         const package1 = loadPackages([
             "webpacked/common/1.js",
             "webpacked/common/2.js",
             "webpacked/common/3.js",
             "webpacked/simple/entry.js",
         ]);
         const package2 = loadPackages([
             "webpacked/common/1.js",
             "webpacked/common/2.js",
             "webpacked/common/3.js",
             "webpacked/with-aphrodite/entry.js",
         ]);

         // Act
         await render(package1, {name: "A NAME"});
         await render(package2, {name: "A NAME"});

         // Assert
        assert.equal(jsdom.JSDOM.callCount, 2);
    });

    it('should not require canvas to run', async () => {
        // Arrange
         const packages = loadPackages([
             "webpacked/common/1.js",
             "webpacked/common/2.js",
             "webpacked/common/3.js",
             "webpacked/canvas/entry.js",
         ]);

         // Act
         // All we're testing for here is that this renders without crashing.
         const underTest = async () => await render(packages, {name: "A NAME"});

         // Assert
         assert.doesNotThrow(underTest);
         await assert.isFulfilled(underTest());
    });

    it('can reference manually set global variables', async () => {
        // Arrange
         const packages = loadPackages([
             "globals/entry.js",
         ]);
        const globals = {
            "location":  "http://www.khanacademy.org/science/physics",
            "KA": {
                "language": "es",
            },
        };
        const expectation = {
            html: "HTML: LOC:http://www.khanacademy.org/science/physics LANG:es",
            css: "CSS: LOC:http://www.khanacademy.org/science/physics LANG:es",
        };

        // Act
        const result = await render(packages, {}, globals);

        // Assert
        assert.deepEqual(result, expectation);
    });

    it('should polyfill methods on props', async () => {
        // Arrange
        const packages = loadPackages(["polyfill/entry.js"]);
        // Remove the Array.prototype.includes method to ensure that it gets
        // polyfilled.
        const oldIncludes = Array.prototype.includes;
        Array.prototype.includes = undefined;

        // This test case checks for the existence of a key in our props keys.
        // We tell it which key to check for using the props themselves.
        const props = {
            thekey: "this is the one",
            keyName: "thekey",
        };

        // Act
        let result;
        try {
            result = await render(packages, props);
        } finally {
            Array.prototype.includes = oldIncludes;
        }

        // Assert
        assert.include(result.html, 'true');
    });
});

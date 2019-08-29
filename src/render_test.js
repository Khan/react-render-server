'use strict';
/* global describe, it, before, beforeEach, afterEach, after */

const fs = require("fs");
const vm = require("vm");
const jsdom = require("jsdom");

const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);
const {assert} = chai;

const sinon = require("sinon");

const render = require("./render.js");

describe("render", () => {
    const loadPackages = packageNames => packageNames.map(filename => {
        const filepath = `${__dirname}/testdata/${filename}`;
        return new vm.Script(
            fs.readFileSync(filepath, "utf-8"),
            {filename: filepath},
        );
    });

    beforeEach(() => {
        sinon.spy(jsdom, "JSDOM");
    });

    afterEach(() => {
        jsdom.JSDOM.restore();
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

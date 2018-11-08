'use strict';
/* global describe, it, before, beforeEach, afterEach, after */

const fs = require("fs");
const vm = require("vm");

const assert = require("chai").assert;
const sinon = require("sinon");

const cache = require("./cache.js");
const render = require("./render.js");



describe('render', () => {
    let packages;
    let createContextSpy;

    beforeEach(() => {
        render.resetGlobals();
        cache.init(10000);

        const packageNames = [
            'corelibs-package.js',
            'corelibs-legacy-package.js',
            'shared-package.js',
            'server-package.js',
            'canvas-test-package.js',
            'globals-package.js',
            'polyfill-package.js',
        ];

        packages = packageNames.map(filename => {
            const filepath = `${__dirname}/testdata/${filename}`;
            return [filename, fs.readFileSync(filepath, "utf-8")];
        });

        createContextSpy = sinon.spy(vm, 'createContext');
    });

    afterEach(() => {
        render.resetGlobals();
        cache.destroy();
        createContextSpy.restore();
    });

    const baseExpected = {
        html: '<div data-reactroot="">6<ol class="red_im3wl1"><li>I</li>' +
            '<li>am</li><li>not</li><li>a</li><li>number</li></ol></div>',
        css: {
            content: ".red_im3wl1{color:red !important;}",
            renderedClassNames: ["red_im3wl1"],
        },
    };

    const props = {
        val: 6,
        list: ['I', 'am', 'not', 'a', 'number'],
    };

    it('should correctly render a simple react component', (done) => {
        render(packages,
               "./javascript/server-package/test-component.jsx",
               props
        ).then(actual => {
            assert.deepEqual(baseExpected, actual);
            done();
        }).catch(done);
    });

    it('should pull vm context from cache when possible', (done) => {
        render(packages,
               "./javascript/server-package/test-component.jsx",
               props
        ).then(() => {
            render(packages,
                   "./javascript/server-package/test-component.jsx",
                   props
            ).then(actual => {
                assert.equal(1, createContextSpy.callCount);

                // Ensure it gives back correct results from the cached version
                assert.deepEqual(baseExpected, actual);
                done();
            }).catch(done);
        });
    });

    it('should not pull vm context from cache when asked not to', () => {
        render(packages,
               "./javascript/server-package/test-component.jsx",
               props);

        render(packages,
               "./javascript/server-package/test-component.jsx",
               props,
               {},
               'no');

        assert.equal(2, createContextSpy.callCount);

        // cacheBehavor = 'no' will still fill the cache
        render(packages,
               "./javascript/server-package/test-component.jsx",
               props);

        assert.equal(2, createContextSpy.callCount);
    });


    it('should not use cache at all when asked not to', () => {
        render.setDefaultCacheBehavior('ignore');

        render(packages,
               "./javascript/server-package/test-component.jsx",
               props);

        render(packages,
               "./javascript/server-package/test-component.jsx",
               props);

        assert.equal(2, createContextSpy.callCount);
    });

    it('should use different cache keys for different package lists', () => {
        render(packages,
               "./javascript/server-package/test-component.jsx",
               props);

        packages[0][0] = 'corelibs-package-2.js';

        render(packages,
               "./javascript/server-package/test-component.jsx",
               props);
        assert.equal(2, createContextSpy.callCount);
    });

    it('should not require canvas to run', () => {
        // All we're testing for here is that this renders without crashing.
        render(packages,
               "./javascript/canvas-test-package/test-component.jsx",
               props);
    });

    it('can reference manually set global variables', (done) => {
        const globals = {
            "location":  "http://www.khanacademy.org/science/physics",
            "KA": {
                "language": "es",
            },
        };

        const path = "./javascript/globals-package/test-component.jsx";
        render(packages, path, {}, globals).then(actual => {
            assert.include(actual.html, 'es');
            assert.include(actual.html,
                           'http://www.khanacademy.org/science/physics');
            done();
        }).catch(done);
    });

    it('polyfills methods on props', (done) => {
        // Remove the Array.prototype.includes method to ensure that it gets
        // polyfilled.
        const oldIncludes = Array.prototype.includes;
        Array.prototype.includes = undefined;

        const props = {array: [1, 2, 3]};

        assert.equal(props.array.includes, undefined);

        // Rendering this component depends on props.array.includes being
        // defined.
        const path = "./javascript/polyfill-package/test-component.jsx";
        render(packages, path, props).then(actual => {
            assert.include(actual.html, 'true');

            Array.prototype.includes = oldIncludes;
            done();
        }).catch(done);
    });
});

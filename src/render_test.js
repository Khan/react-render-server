'use strict';
/* global describe, it, before, after */

const fs = require("fs");

const assert = require("chai").assert;

const render = require("./render.js");


// Given some html, remove the reactid and react-checksum, which are
// auto-generated and not necessarily consistent between runs.
const normalizeReactOutput = function(html) {
    html = html.replace(/data-reactid="[^"]*"/g,
                        'data-reactid="..."');
    html = html.replace(/data-react-checksum="[^"]*"/g,
                        'data-react-checksum="..."');
    return html;
};


describe('render', () => {
    it('should correctly render a simple react component', () => {
        const packageNames = ['corelibs-package.js', 'shared-package.js',
                              'server-package.js'];
        const packageContents = packageNames.map(
            filename => fs.readFileSync(`${__dirname}/testdata/${filename}`,
                                        "utf-8"));

        const props = {
            val: 6,
            list: ['I', 'am', 'not', 'a', 'number'],
        };

        const expected = {
            html: '<div data-reactid="..." data-react-checksum="..."><span data-reactid="...">6</span><ol data-reactid="..."><li data-reactid="...">I</li><li data-reactid="...">am</li><li data-reactid="...">not</li><li data-reactid="...">a</li><li data-reactid="...">number</li></ol></div>',     // @Nolint(long line)
            css: {
                content: "",
                renderedClassNames: [],
            },
        };

        const actual = render(packageContents,
                              "./javascript/server-package/test-component.jsx",
                              props);
        actual.html = normalizeReactOutput(actual.html);  // "const"? ha!

        assert.deepEqual(expected, actual);
    });
});

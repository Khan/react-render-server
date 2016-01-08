'use strict';
/* global describe, it, before, beforeEach, afterEach, after */

const fs = require("fs");

const assert = require("chai").assert;
const nock = require("nock");
const supertest = require("supertest");

const cache = require("./cache.js");
const server = require("./server.js");


describe('API endpoint /render', () => {
    const agent = supertest.agent(server);

    let mockScope;

    before(() => {
        nock.disableNetConnect();
        nock.enableNetConnect('127.0.0.1');
    });

    beforeEach(() => {
        mockScope = nock('https://www.khanacademy.org');
        cache.init(10000);
    });

    afterEach(() => {
        nock.cleanAll();
        cache.destroy();
    });

    it('should render a simple react component', (done) => {
        const testProps = {
            val: 6,
            list: ['I', 'am', 'not', 'a', 'number'],
        };
        const testJson = {
            files: ['/corelibs-package.js',
                    '/shared-package.js',
                    '/server-package.js'],
            path: "./javascript/server-package/test-component.jsx",
            props: testProps,
        };

        testJson.files.forEach((pkgname) => {
            const contents = fs.readFileSync(`${__dirname}/testdata${pkgname}`,
                                             "utf-8");
            mockScope.get(pkgname).reply(200, contents);
        });

        // We test the actual rendered contents in render_test.js.  Here
        // we just test that we get *some* output.
        agent
            .post('/render')
            .send(testJson)
            .expect((res) => {
                assert.ok(res.body.html);    // should have *some* html
                assert.ok(res.body.css);     // should have a css object
                mockScope.done();
            })
            .end(done);
    });
});

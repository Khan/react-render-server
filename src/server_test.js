'use strict';

const fs = require("fs");

const assert = require("chai").assert;
const nock = require("nock");
const supertest = require("supertest");

const server = require("./server.js");

describe('/render', () => {
    const agent = supertest.agent(server);

    let mockScope;

    before(() => {
        mockScope = nock('https://www.khanacademy.org');
    });

    after(() => {
        nock.restore();
        nock.cleanAll();
    });

    it('should echo the package contents', (done) => {
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
            mockScope = mockScope.get(pkgname).reply(200, contents);
        });

        // We test the actual rendered contents in render_test.js.  Here
        // we just test that we get *some* output.
        agent
            .post('/render')
            .send(testJson)
            .expect((res) => {
                assert(res.body.html);    // should have *some* html
                assert(res.body.css);     // should have a css object
            })
            .end(done);
    });
});

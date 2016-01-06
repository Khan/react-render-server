'use strict';

const fs = require("fs");

const assert = require("chai").assert;
const supertest = require("supertest");
const superagent = require("superagent");
const superagentMocker = require("superagent-mocker");

const server = require("./server.js");

describe('/render', () => {
    const agent = supertest.agent(server);

    let mock;

    before(() => {
        mock = superagentMocker(superagent);
        const packageNames = ['corelibs-package.js',
                              'shared-package.js',
                              'server-package.js'];

        packageNames.forEach((pkgname) => {
            mock.get(`https://www.khanacademy.org/${pkgname}`,
                     req => fs.readFileSync(`${__dirname}/testdata/${pkgname}`,
                                            "utf-8"));
        });
    });

    after(() => {
        mock.unmock(superagent);
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

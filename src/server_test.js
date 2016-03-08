'use strict';
/* global describe, it, before, beforeEach, afterEach, after */

const fs = require("fs");

const assert = require("chai").assert;
const logging = require("winston");
const nock = require("nock");
const sinon = require("sinon");
const supertest = require("supertest");

const cache = require("./cache.js");
const fetchPackage = require("./fetch_package.js");
const graphiteUtil = require("./graphite_util.js");
const renderSecret = require("./secret.js");
const server = require("./server.js");

describe('API endpoint /_api/ping', () => {
    const agent = supertest.agent(server);

    it("should return pong", (done) => {
        agent
            .get('/_api/ping')
            .expect("pong!\n", done);
    });
});

describe('API endpoint /_api/version', () => {
    const agent = supertest.agent(server);
    afterEach(function() {
        delete process.env['GAE_MODULE_VERSION'];
    });

    it("should return the module version in production", (done) => {
        process.env['GAE_MODULE_VERSION'] = 'foo-version';
        agent
            .get('/_api/version')
            .expect("foo-version\n", done);
    });

    it("should return the 'dev' in dev", (done) => {
        agent
            .get('/_api/version')
            .expect("dev\n", done);
    });
});

describe('API endpoint /_ah/health', () => {
    const agent = supertest.agent(server);

    it("should return ok!", (done) => {
        agent
            .get('/_ah/health')
            .expect("ok!\n", done);
    });
});

describe('API endpoint /_ah/start', () => {
    const agent = supertest.agent(server);

    it("should return ok!", (done) => {
        agent
            .get('/_ah/start')
            .expect("ok!\n", done);
    });
});

describe('API endpoint /_ah/stop', () => {
    const agent = supertest.agent(server);

    it("should return ok!", (done) => {
        agent
            .get('/_ah/stop')
            .expect("ok!\n", done);
    });
});

describe('API endpoint /render', () => {
    const agent = supertest.agent(server);

    let mockScope;
    let debugLoggingSpy;
    let graphiteLogStub;

    before(() => {
        nock.disableNetConnect();
        nock.enableNetConnect('127.0.0.1');
    });

    beforeEach(() => {
        mockScope = nock('https://www.khanacademy.org');
        cache.init(10000);
        sinon.stub(renderSecret, 'matches', actual => actual === "sekret");
        debugLoggingSpy = sinon.spy(logging, "debug");
        graphiteLogStub = sinon.stub(graphiteUtil, "log");
    });

    afterEach(() => {
        nock.cleanAll();
        cache.destroy();
        fetchPackage.resetGlobals();
        renderSecret.matches.restore();
        logging.debug.restore();
        graphiteLogStub.restore();
    });

    it('should render a simple react component', (done) => {
        const testProps = {
            val: 6,
            list: ['I', 'am', 'not', 'a', 'number'],
        };
        const testJson = {
            urls: ['https://www.khanacademy.org/corelibs-package.js',
                   'https://www.khanacademy.org/corelibs-legacy-package.js',
                   'https://www.khanacademy.org/shared-package.js',
                   'https://www.khanacademy.org/server-package.js'],
            path: "./javascript/server-package/test-component.jsx",
            props: testProps,
            secret: 'sekret',
        };

        testJson.urls.forEach((url) => {
            const path = url.substr('https://www.khanacademy.org'.length);
            const contents = fs.readFileSync(`${__dirname}/testdata${path}`,
                                             "utf-8");
            mockScope.get(path).reply(200, contents);
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

    it('should fail on invalid inputs', (done) => {
        const url = 'https://www.khanacademy.org/foo';
        const invalidInputs = [
            {},
            {path: "./foo", props: {bar: 4}, secret: 'sekret'},
            {urls: [], path: "./foo", props: {bar: 4}, secret: 'sekret'},
            {urls: [1, 2], path: "./foo", props: {bar: 4}, secret: 'sekret'},
            {urls: ["foo"], path: "./foo", props: {bar: 4}, secret: 'sekret'},
            {urls: ["/foo"], path: "./foo", props: {bar: 4}, secret: 'sekret'},
            {urls: [url], props: {bar: 4}, secret: 'sekret'},
            {urls: [url], path: 4, props: {bar: 4}, secret: 'sekret'},
            {urls: [url], path: 'foo', props: {bar: 4}, secret: 'sekret'},
            {urls: [url], path: "./foo", props: "foo", secret: 'sekret'},
            {urls: [url], path: "./foo", props: [{}, {}], secret: 'sekret'},
            {urls: [url], path: "./foo", props: {bar: 4}},
            {urls: [url], path: "./foo", props: {bar: 4}, secret: 'bad'},
        ];
        let remainingTests = invalidInputs.length;

        invalidInputs.forEach((testJson) => {
            agent.post('/render').send(testJson).expect(
                res => assert.equal(400, res.status)
            ).end(() => {
                if (--remainingTests === 0) {
                    done();
                }
            });
        });
    });

    it('should log render-stats', (done) => {
        const testProps = {
            val: 6,
            list: ['I', 'am', 'not', 'a', 'number'],
        };
        const testJson = {
            urls: ['https://www.khanacademy.org/corelibs-package.js',
                   'https://www.khanacademy.org/corelibs-legacy-package.js',
                   'https://www.khanacademy.org/shared-package.js',
                   'https://www.khanacademy.org/server-package.js'],
            path: "./javascript/server-package/test-component.jsx",
            props: testProps,
            secret: 'sekret',
        };

        testJson.urls.forEach((url) => {
            const path = url.substr('https://www.khanacademy.org'.length);
            const contents = fs.readFileSync(`${__dirname}/testdata${path}`,
                                             "utf-8");
            mockScope.get(path).reply(200, contents);
        });

        const expected = (
            'render-stats for ' +
            './javascript/server-package/test-component.jsx: {' +
            '"pendingRenderRequests":0,' +
            '"packageFetches":4,' +
            '"createdVmContext":true,' +
            '"vmContextSize":1298191' +
            "}");

        agent
            .post('/render')
            .send(testJson)
            .expect((res) => {
                // We just make sure one of the logging.debug args has
                // the information we expect to be logged.
                let foundRenderStats = false;
                debugLoggingSpy.args.forEach((arglist) => {
                    arglist.forEach((arg) => {
                        if (arg === expected) {
                            foundRenderStats = true;
                        }
                    });
                });
                assert.equal(foundRenderStats, true,
                             JSON.stringify(debugLoggingSpy.args));
                mockScope.done();
            })
            .end(done);
    });

    it('should send to graphite on timeout', (done) => {
        const testProps = {
            val: 6,
            list: ['I', 'am', 'not', 'a', 'number'],
        };
        const testJson = {
            urls: ['https://www.khanacademy.org/corelibs-package.js',
                   'https://www.khanacademy.org/corelibs-legacy-package.js',
                   'https://www.khanacademy.org/shared-package.js',
                   'https://www.khanacademy.org/server-package.js'],
            path: "./javascript/server-package/test-component.jsx",
            props: testProps,
            secret: 'sekret',
        };

        testJson.urls.forEach((url) => {
            const path = url.substr('https://www.khanacademy.org'.length);
            const contents = fs.readFileSync(`${__dirname}/testdata${path}`,
                                             "utf-8");
            mockScope.get(path).delay(500).reply(200, contents);
        });

        // Make sure we time out well before those delays finish.
        fetchPackage.setTimeout(20);

        agent
            .post('/render')
            .send(testJson)
            .expect((res) => {
                assert.deepEqual([['react_render_server.stats.timeout', 1]],
                                 graphiteLogStub.args);
                mockScope.done();
            })
            .end(done);
    });
});

describe('API endpoint /flush', () => {
    const agent = supertest.agent(server);

    let mockScope;

    before(() => {
        nock.disableNetConnect();
        nock.enableNetConnect('127.0.0.1');
    });

    beforeEach(() => {
        mockScope = nock('https://www.khanacademy.org');
        cache.init(10000);
        sinon.stub(renderSecret, 'matches', actual => actual === "sekret");
    });

    afterEach(() => {
        nock.cleanAll();
        cache.destroy();
        renderSecret.matches.restore();
    });

    it('should empty the cache', (done) => {
        const url = 'https://www.khanacademy.org/corelibs-package.js';
        mockScope.get('/corelibs-package.js').reply(200, 'test contents');
        mockScope.get('/corelibs-package.js').reply(200, 'must refetch');

        fetchPackage(url).then((res) => {
            assert.equal(res, "test contents");
            return fetchPackage(url);
        }).then(
            (res) => {
                // Should still be cached.
                assert.equal(res, "test contents");
                agent
                    .post('/flush')
                    .send({secret: 'sekret'})
                    .expect('dev\n', (err) => {
                        fetchPackage(url).then((res) => {
                            assert.equal(res, "must refetch");
                            mockScope.done();
                            done(err);
                        }).catch(done);
                    });
            },
            (err) => done(err));
    });

    it("should require a valid secret", (done) => {
        agent.post('/flush').send({secret: 'bad sekret'}).expect(
            res => assert.equal(400, res.status)
        ).end(done);
    });
});


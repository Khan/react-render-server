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
const renderWorkers = require("./render_workers.js");
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
        delete process.env['GAE_VERSION'];
    });

    it("should return the module version in production", (done) => {
        process.env['GAE_VERSION'] = 'foo-version';
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

describe('API endpoint /render', function() {
    const agent = supertest.agent(server);

    let mockScope;
    let debugLoggingSpy;
    let errorLoggingSpy;
    let graphiteLogStub;

    // Lots of tests will use these same props + json, though some won't.
    const testProps = {
        val: 6,
        list: ['I', 'am', 'not', 'a', 'number!'],
    };

    const testJson = {
        urls: [
            'https://www.khanacademy.org/corelibs-package.js',
            'https://www.khanacademy.org/corelibs-legacy-package.js',
            'https://www.khanacademy.org/shared-package.js',
            'https://www.khanacademy.org/server-package.js',
        ],
        path: "./javascript/server-package/test-component.jsx",
        props: testProps,
        secret: 'sekret',
    };

    before(() => {
        nock.disableNetConnect();
        nock.enableNetConnect('127.0.0.1');
    });

    beforeEach((done) => {
        mockScope = nock('https://www.khanacademy.org');
        cache.init(10000);
        sinon.stub(renderSecret, 'matches', (secret, callback) => {
            return callback(null, secret === "sekret");
        });
        debugLoggingSpy = sinon.spy(logging, "debug");
        errorLoggingSpy = sinon.spy(logging, "error");
        graphiteLogStub = sinon.stub(graphiteUtil, "log");
        renderWorkers.reset(10000, {lazyStart: true}).then(done);
    });

    afterEach(() => {
        nock.cleanAll();
        cache.destroy();
        fetchPackage.resetGlobals();
        logging.debug.restore();
        logging.error.restore();
        graphiteLogStub.restore();
        renderSecret.matches.restore();
        cache.destroy();
    });

    after((done) => {
        renderWorkers.terminate().then(done);
    });

    it('should render a simple react component', (done) => {
        // Tell the render subprocesses to mock these urls.
        process.env._MOCK_FETCHES_FOR_TESTS = testJson.urls.join(",");

        // We test the actual rendered contents in render_test.js.  Here
        // we just test that we get *some* output.
        agent
            .post('/render')
            .send(testJson)
            .expect((res) => {
                assert.ok(res.body.html);    // should have *some* html
                assert.include(res.body.html, 'number!');  // with our input
                assert.ok(res.body.css);     // should have a css object
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

    it('should fail on fetching timeout', (done) => {
        // url;200;500 means: delay for 500ms, then give a 200 response.
        process.env._MOCK_FETCHES_FOR_TESTS = (
            testJson.urls.map(url => `${url};200;500`).join(","));

        // Make sure we time out well before those delays finish.
        // Again we have to use the env so the subprocess get this value.
        process.env._FETCH_TIMEOUT_FOR_TESTS = 20;

        agent
            .post('/render')
            .send(testJson)
            .expect((res) => {
                assert.equal(500, res.status);
            })
            .end(done);
    });

    it('should fail on fetching failure', (done) => {
        // url;404 means: give a 404 response.
        process.env._MOCK_FETCHES_FOR_TESTS = (
            testJson.urls.map(url => `${url};404`).join(","));

        agent
            .post('/render')
            .send(testJson)
            .expect((res) => {
                assert.equal(500, res.status);
            })
            .end(done);
    });

    it('should fail on render timeout', (done) => {
        process.env._MOCK_FETCHES_FOR_TESTS = testJson.urls.join(",");

        renderWorkers.reset(10, {taskTimeout: 1, lazyStart: true}).then(() => {
            agent
                .post('/render')
                .send(testJson)
                .expect((res) => {
                    assert.equal(500, res.status);
                })
                .end(done);
        });
    });

    it('should log render-stats', (done) => {
        // Tell the render subprocesses to mock these urls.
        process.env._MOCK_FETCHES_FOR_TESTS = testJson.urls.join(",");

        const expected = (
            'render-stats for ' +
            './javascript/server-package/test-component.jsx: {' +
            '"pendingRenderRequests":0,' +
            '"packageFetches":4,' +
            '"createdVmContext":true,' +
            '"vmContextSize":2105130' +
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
            })
            .end(done);
    });

    it('should send to graphite on timeout', (done) => {
        testJson.urls.forEach((url) => {
            const path = url.substr('https://www.khanacademy.org'.length);
            const contents = fs.readFileSync(`${__dirname}/testdata${path}`,
                                             "utf-8");
            mockScope.get(path).delay(500).reply(200, contents);
        });

        // Make sure we time out well before those delays finish.
        fetchPackage.setTimeout(20);

        // We have to run the rendering in the main process, not a
        // subprocess, in order to be able to mock out the logs.  This
        // makes for a worse test, but it's better than nothing!
        const myTestJson = JSON.parse(JSON.stringify(testJson));  // copy
        myTestJson.renderInMainProcess = true;

        agent
            .post('/render')
            .send(myTestJson)
            .expect((res) => {
                assert.deepEqual([['react_render_server.stats.timeout', 1]],
                                 graphiteLogStub.args);
                mockScope.done();
            })
            .end(done);
    });

    it('should log an error on fetching timeout', (done) => {
        testJson.urls.forEach((url) => {
            const path = url.substr('https://www.khanacademy.org'.length);
            const contents = fs.readFileSync(`${__dirname}/testdata${path}`,
                                             "utf-8");
            mockScope.get(path).delay(500).reply(200, contents);
        });

        // Make sure we time out well before those delays finish.
        fetchPackage.setTimeout(20);

        const expected = ("timed out while fetching " +
                          "https://www.khanacademy.org/corelibs-package.js");

        // We have to run the rendering in the main process, not a
        // subprocess, in order to be able to mock out the logs.  This
        // makes for a worse test, but it's better than nothing!
        const myTestJson = JSON.parse(JSON.stringify(testJson));  // copy
        myTestJson.renderInMainProcess = true;

        agent
            .post('/render')
            .send(myTestJson)
            .expect((res) => {
                let foundLogMessage = false;
                errorLoggingSpy.args.forEach((arglist) => {
                    arglist.forEach((arg) => {
                        if (arg === expected) {
                            foundLogMessage = true;
                        }
                    });
                });

                assert.equal(foundLogMessage, true,
                             JSON.stringify(errorLoggingSpy.args));
                mockScope.done();
            })
            .end(done);
    });

    it('should log an error on fetching failure', (done) => {
        testJson.urls.forEach((url) => {
            const path = url.substr('https://www.khanacademy.org'.length);
            mockScope.get(path).reply(404);
        });

        const expected = ("Fetching failure: Error: " +
                          "cannot undefined /corelibs-package.js (404): ");

        // We have to run the rendering in the main process, not a
        // subprocess, in order to be able to mock out the logs.  This
        // makes for a worse test, but it's better than nothing!
        const myTestJson = JSON.parse(JSON.stringify(testJson));  // copy
        myTestJson.renderInMainProcess = true;

        agent
            .post('/render')
            .send(myTestJson)
            .expect((res) => {
                let foundLogMessage = false;
                errorLoggingSpy.args.forEach((arglist) => {
                    arglist.forEach((arg) => {
                        if (arg === expected) {
                            foundLogMessage = true;
                        }
                    });
                });

                assert.equal(foundLogMessage, true,
                             JSON.stringify(errorLoggingSpy.args));
                mockScope.done();
            })
            .end(done);
    });

    it('should log an error on render timeout', (done) => {
        // TODO(csilvers): figure out how to test this.
        done();
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
        sinon.stub(renderSecret, 'matches', (secret, callback) => {
            return callback(null, secret === "sekret");
        });
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

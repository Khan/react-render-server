'use strict';
/* global describe, it, before, beforeEach, afterEach, after */

const fs = require("fs");
const vm = require("vm");

const assert = require("chai").assert;
const sinon = require("sinon");
const nock = require("nock");

const cache = require("./cache.js");
const render = require("./render.js");


describe('render apollo', () => {
    let mockScope;
    let packages;
    let createContextSpy;

    before(() => {
        nock.disableNetConnect();
        nock.enableNetConnect('127.0.0.1');

        const packageNames = [
            'corelibs-package.js',
            'corelibs-legacy-package.js',
            'shared-package.js',
            'server-package.js',
            'canvas-test-package.js',
            'globals-package.js',
            'polyfill-package.js',
            'apollo-package.js',
            'coach-package.js',
        ];

        packages = packageNames.map(filename => {
            const filepath = `${__dirname}/testdata/${filename}`;
            return [filename, fs.readFileSync(filepath, "utf-8")];
        });
    });

    beforeEach(() => {
        mockScope = nock('https://www.ka.org');
        render.resetGlobals();
        cache.init(10000);

        createContextSpy = sinon.spy(vm, 'createContext');
    });

    afterEach(() => {
        nock.cleanAll();
        render.resetGlobals();
        cache.destroy();
        createContextSpy.restore();
    });

    const validGraphQLResponse = JSON.stringify({
        "errors": null,
        "data": {
            "coachData": {
                "studentListByName": {
                    "name": "Test Class 1",
                    "__typename": "StudentList",
                },
                "__typename": "StudentsListsQuery",
            },
        },
    });

    const expectedBase = {
        "html": "<div data-reactroot=\"\">Test Class 1</div>",
        "css": {
            "content": "",
            "renderedClassNames": [],
        },
        "data": {
            "$ROOT_QUERY.coachData.studentListByName({\"name\":\"Test Class 1\"})": { // eslint-disable max-len
                "name": "Test Class 1",
                "__typename": "StudentList",
            },
            "$ROOT_QUERY.coachData": {
                "studentListByName({\"name\":\"Test Class 1\"})": {
                    "type": "id",
                    "id": "$ROOT_QUERY.coachData.studentListByName(" +
                        "{\"name\":\"Test Class 1\"})",
                    "generated": true,
                },
                "__typename": "StudentsListsQuery",
            },
            "ROOT_QUERY": {
                "coachData": {
                    "type": "id",
                    "id": "$ROOT_QUERY.coachData",
                    "generated": true,
                },
            },
        },
    };

    it('should correctly render a simple apollo react component', (done) => {
        mockScope.post("/graphql").reply(200, validGraphQLResponse);
        render(packages,
            "./javascript/coach-package/valid.jsx",
            {},
            {
                ApolloNetwork: {
                    url: "https://www.ka.org/graphql",
                },
            }
        ).then(actual => {
            assert.deepEqual(expectedBase, actual);
            done();
        }).catch(done);
    });

    it('should handle variables', (done) => {
        mockScope.post("/graphql").reply(200, validGraphQLResponse);
        render(packages,
            "./javascript/coach-package/variables.jsx",
            {
                name: "Test Class 1",
            },
            {
                ApolloNetwork: {
                    url: "https://www.ka.org/graphql",
                },
            }
        ).then(actual => {
            assert.deepEqual(expectedBase, actual);
            done();
        }).catch(done);
    });

    const headers = {
        "Cookie": "foo=1234",
        "X-KA-Fkey": "secretkey",
    };

    it('should pass through headers to the GraphQL server', (done) => {
        nock('https://www.ka.org', {
            reqheaders: {
                "cookie": headers.Cookie,
                "x-ka-fkey": headers["X-KA-Fkey"],
            },
        })
            .replyContentLength()
            .post("/graphql")
            .reply(200, validGraphQLResponse);

        render(packages,
            "./javascript/coach-package/valid.jsx",
            {},
            {
                ApolloNetwork: {
                    url: "https://www.ka.org/graphql",
                    headers: headers,
                },
            }
        ).then(actual => {
            assert.deepEqual(expectedBase, actual);
            done();
        }).catch(done);
    });

    const syntaxError = 'Syntax Error: Expected Name, found )';

    it('should handle a GraphQL syntax error', (done) => {
        // NOTE(jeresig): No network request is made as the syntax error is
        // caught on the client-side, by Apollo
        render(packages,
            "./javascript/coach-package/syntax-error.jsx",
            {},
            {
                ApolloNetwork: {
                    url: "https://www.ka.org/graphql",
                },
            }
        ).catch(err => {
            assert.equal(syntaxError, err.message);
            done();
        });
    });

    const schemaErrorGraphQLResponse = JSON.stringify({
        "errors": [
            {
                "message": "Validation error: Cannot query field \"fooData\"" +
                " on type \"Query\". Did you mean \"coachData\"?",
            },
        ],
        "data": null,
    });

    const schemaError = 'GraphQL error: Validation error: Cannot query field' +
        ' "fooData" on type "Query". Did you mean "coachData"?';

    it('should handle a GraphQL schema error', (done) => {
        mockScope.post("/graphql").reply(200, schemaErrorGraphQLResponse);
        render(packages,
            "./javascript/coach-package/schema-error.jsx",
            {},
            {
                ApolloNetwork: {
                    url: "https://www.ka.org/graphql",
                },
            }
        ).catch(err => {
            assert.equal(schemaError, err.message);
            done();
        });
    });

    const missingUrlError =
        "Network error: ApolloNetwork must have a valid url.";

    it('should handle a missing Apollo GraphQL URL', (done) => {
        render(packages,
            "./javascript/coach-package/valid.jsx",
            {},
            {
                ApolloNetwork: {},
            }
        ).catch(err => {
            assert.equal(missingUrlError, err.message);
            done();
        });
    });

    const serverError = "Network error: Server returned an error.";

    it('should handle a 404ing GraphQL', (done) => {
        mockScope.post("/graphql").reply(404, "Page not found");
        render(packages,
            "./javascript/coach-package/valid.jsx",
            {},
            {
                ApolloNetwork: {
                    url: "https://www.ka.org/graphql",
                },
            }
        ).catch(err => {
            assert.equal(serverError, err.message);
            done();
        });
    });

    it('should handle a 500ing GraphQL', (done) => {
        mockScope.post("/graphql").reply(500, "Interal Server Error");
        render(packages,
            "./javascript/coach-package/valid.jsx",
            {},
            {
                ApolloNetwork: {
                    url: "https://www.ka.org/graphql",
                },
            }
        ).catch(err => {
            assert.equal(serverError, err.message);
            done();
        });
    });

    it('should handle a 500ms delay from GraphQL', (done) => {
        mockScope.post("/graphql")
            .delay(500)
            .reply(200, validGraphQLResponse);
        render(packages,
            "./javascript/coach-package/valid.jsx",
            {},
            {
                ApolloNetwork: {
                    url: "https://www.ka.org/graphql",
                },
            }
        ).then(actual => {
            assert.deepEqual(expectedBase, actual);
            done();
        }).catch(done);
    });

    const timeoutError = "Network error: Server response exceeded timeout.";

    it('should error out on a 2000ms delay from GraphQL', (done) => {
        mockScope.post("/graphql")
            .delay(2000)
            .reply(200, validGraphQLResponse);
        render(packages,
            "./javascript/coach-package/valid.jsx",
            {},
            {
                ApolloNetwork: {
                    url: "https://www.ka.org/graphql",
                },
            }
        ).catch(err => {
            assert.equal(timeoutError, err.message);
            done();
        });
    });

    it('should error out on a custom timeout', (done) => {
        mockScope.post("/graphql")
            .delay(250)
            .reply(200, validGraphQLResponse);
        render(packages,
            "./javascript/coach-package/valid.jsx",
            {},
            {
                ApolloNetwork: {
                    url: "https://www.ka.org/graphql",
                    timeout: 100,
                },
            }
        ).catch(err => {
            assert.equal(timeoutError, err.message);
            done();
        });
    });
});

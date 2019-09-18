"use strict";
/* global describe, it, before, beforeEach, afterEach, after */

const fs = require("fs");
const vm = require("vm");

const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");

chai.use(chaiAsPromised);
const {assert} = chai;

const nock = require("nock");

const render = require("./render.js");

describe("render apollo", () => {
    const loadPackages = (packageNames) =>
        packageNames.map((filename) => {
            const filepath = `${__dirname}/testdata/${filename}`;
            return {
                content: fs.readFileSync(filepath, "utf-8"),
                url: filepath,
            };
        });
    const validGraphQLResponse = JSON.stringify({
        errors: null,
        data: {
            coachData: {
                studentListByName: {
                    name: "Test Class 1",
                    __typename: "StudentList",
                },
                __typename: "StudentsListsQuery",
            },
        },
    });
    const expectedBase = {
        html: '<div data-reactroot="">Test Class 1</div>',
        css: {
            content: "",
            renderedClassNames: [],
        },
        data: {
            '$ROOT_QUERY.coachData.studentListByName({"name":"Test Class 1"})': {
                // eslint-disable max-len
                name: "Test Class 1",
                __typename: "StudentList",
            },
            "$ROOT_QUERY.coachData": {
                'studentListByName({"name":"Test Class 1"})': {
                    type: "id",
                    id:
                        "$ROOT_QUERY.coachData.studentListByName(" +
                        '{"name":"Test Class 1"})',
                    generated: true,
                    typename: "StudentList",
                },
                __typename: "StudentsListsQuery",
            },
            ROOT_QUERY: {
                coachData: {
                    type: "id",
                    id: "$ROOT_QUERY.coachData",
                    generated: true,
                    typename: "StudentsListsQuery",
                },
            },
        },
    };
    let mockScope;

    before(() => {
        nock.disableNetConnect();
        nock.enableNetConnect("127.0.0.1");
    });

    beforeEach(() => {
        mockScope = nock("https://www.ka.org");
    });

    afterEach(() => {
        nock.cleanAll();
    });

    it("should correctly render a simple apollo react component", async () => {
        // Arrange
        mockScope.post("/graphql").reply(200, validGraphQLResponse);
        const packages = loadPackages([
            "webpacked/common/1.js",
            "webpacked/common/2.js",
            "webpacked/common/3.js",
            "webpacked/apollo/simple/entry.js",
        ]);

        // Act
        const result = await render(
            packages,
            {},
            {
                ApolloNetwork: {
                    url: "https://www.ka.org/graphql",
                },
            },
        );

        // Assert
        assert.deepEqual(result, expectedBase);
    });

    it("should handle variables", async () => {
        // Arrange
        mockScope.post("/graphql").reply(200, validGraphQLResponse);
        const packages = loadPackages([
            "webpacked/common/1.js",
            "webpacked/common/2.js",
            "webpacked/common/3.js",
            "webpacked/apollo/variables/entry.js",
        ]);

        // Act
        const result = await render(
            packages,
            {name: "Test Class 1"},
            {
                ApolloNetwork: {
                    url: "https://www.ka.org/graphql",
                },
            },
        );

        // Assert
        assert.deepEqual(result, expectedBase);
    });

    it("should pass through headers to the GraphQL server", async () => {
        // Arrange
        const packages = loadPackages([
            "webpacked/common/1.js",
            "webpacked/common/2.js",
            "webpacked/common/3.js",
            "webpacked/apollo/simple/entry.js",
        ]);
        const headers = {
            Cookie: "foo=1234",
            "X-KA-Fkey": "secretkey",
        };
        nock("https://www.ka.org", {
            reqheaders: {
                cookie: headers.Cookie,
                "x-ka-fkey": headers["X-KA-Fkey"],
            },
        })
            .replyContentLength()
            .post("/graphql")
            .reply(200, validGraphQLResponse);

        // Act
        const result = await render(
            packages,
            {},
            {
                ApolloNetwork: {
                    url: "https://www.ka.org/graphql",
                    headers: headers,
                },
            },
        );

        // Assert
        assert.deepEqual(result, expectedBase);
    });

    it("should handle a GraphQL syntax error", async () => {
        // Arrange
        const packages = loadPackages([
            "webpacked/common/1.js",
            "webpacked/common/2.js",
            "webpacked/common/3.js",
            "webpacked/apollo/syntax-error/entry.js",
        ]);
        // NOTE(jeresig): No network request is made as the syntax error is
        // caught on the client-side, by Apollo

        // Act
        const underTest = render(
            packages,
            {},
            {
                ApolloNetwork: {
                    url: "https://www.ka.org/graphql",
                },
            },
        );

        // Assert
        await assert.isRejected(
            underTest,
            "Syntax Error: Expected Name, found )",
        );
    });

    it("should handle a GraphQL schema error", async () => {
        // Arrange
        const packages = loadPackages([
            "webpacked/common/1.js",
            "webpacked/common/2.js",
            "webpacked/common/3.js",
            "webpacked/apollo/schema-error/entry.js",
        ]);
        mockScope.post("/graphql").reply(
            200,
            JSON.stringify({
                errors: [
                    {
                        message:
                            'Validation error: Cannot query field "fooData"' +
                            ' on type "Query". Did you mean "coachData"?',
                    },
                ],
                data: null,
            }),
        );

        // Act
        const underTest = render(
            packages,
            {},
            {
                ApolloNetwork: {
                    url: "https://www.ka.org/graphql",
                },
            },
        );

        // Assert
        await assert.isRejected(
            underTest,
            'GraphQL error: Validation error: Cannot query field "fooData" on type "Query". Did you mean "coachData"?',
        );
    });

    it("should handle a missing Apollo GraphQL URL", async () => {
        // Arrange
        const packages = loadPackages([
            "webpacked/common/1.js",
            "webpacked/common/2.js",
            "webpacked/common/3.js",
            "webpacked/apollo/simple/entry.js",
        ]);

        // Act
        const underTest = render(
            packages,
            {},
            {
                ApolloNetwork: {},
            },
        );

        // Assert
        await assert.isRejected(
            underTest,
            "Network error: ApolloNetwork must have a valid url.",
        );
    });

    it("should handle a 404ing GraphQL", async () => {
        // Arrange
        const packages = loadPackages([
            "webpacked/common/1.js",
            "webpacked/common/2.js",
            "webpacked/common/3.js",
            "webpacked/apollo/simple/entry.js",
        ]);
        mockScope.post("/graphql").reply(404, "Page not found");

        // Act
        const underTest = render(
            packages,
            {},
            {
                ApolloNetwork: {
                    url: "https://www.ka.org/graphql",
                },
            },
        );

        // Assert
        await assert.isRejected(
            underTest,
            "Network error: Server returned an error.",
        );
    });

    it("should handle a 500ing GraphQL", async () => {
        // Arrange
        const packages = loadPackages([
            "webpacked/common/1.js",
            "webpacked/common/2.js",
            "webpacked/common/3.js",
            "webpacked/apollo/simple/entry.js",
        ]);
        mockScope.post("/graphql").reply(500, "Interal Server Error");

        // Act
        const underTest = render(
            packages,
            {},
            {
                ApolloNetwork: {
                    url: "https://www.ka.org/graphql",
                },
            },
        );

        // Assert
        await assert.isRejected(
            underTest,
            "Network error: Server returned an error.",
        );
    });

    it("should handle a 500ms delay from GraphQL", async () => {
        // Arrange
        const packages = loadPackages([
            "webpacked/common/1.js",
            "webpacked/common/2.js",
            "webpacked/common/3.js",
            "webpacked/apollo/simple/entry.js",
        ]);
        mockScope
            .post("/graphql")
            .delay(500)
            .reply(200, validGraphQLResponse);

        // Act
        const result = await render(
            packages,
            {},
            {
                ApolloNetwork: {
                    url: "https://www.ka.org/graphql",
                },
            },
        );

        // Assert
        assert.deepEqual(result, expectedBase);
    });

    it("should error out on a 2000ms delay from GraphQL", async () => {
        // Arrange
        const packages = loadPackages([
            "webpacked/common/1.js",
            "webpacked/common/2.js",
            "webpacked/common/3.js",
            "webpacked/apollo/simple/entry.js",
        ]);
        mockScope
            .post("/graphql")
            .delay(2000)
            .reply(200, validGraphQLResponse);

        // Act
        const underTest = render(
            packages,
            {},
            {
                ApolloNetwork: {
                    url: "https://www.ka.org/graphql",
                },
            },
        );

        // Assert
        await assert.isRejected(
            underTest,
            "Network error: Server response exceeded timeout.",
        );
    });

    it("should error out on a custom timeout", async () => {
        // Arrange
        const packages = loadPackages([
            "webpacked/common/1.js",
            "webpacked/common/2.js",
            "webpacked/common/3.js",
            "webpacked/apollo/simple/entry.js",
        ]);
        mockScope
            .post("/graphql")
            .delay(250)
            .reply(200, validGraphQLResponse);

        // Act
        const underTest = render(
            packages,
            {},
            {
                ApolloNetwork: {
                    url: "https://www.ka.org/graphql",
                    timeout: 100,
                },
            },
        );

        // Assert
        await assert.isRejected(
            underTest,
            "Network error: Server response exceeded timeout.",
        );
    });
});

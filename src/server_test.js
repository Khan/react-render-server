'use strict';

const supertest = require("supertest");
const superagent = require("superagent");
const superagentMocker = require("superagent-mocker");

const server = require("./server.js");

describe('render', () => {
    const agent = supertest.agent(server);

    let mock;

    before(() => {
        mock = superagentMocker(superagent);
        const filenameToContents = {
            "/apackage.js": "I am an A!",
            "/bpackage.js": "I am a B!",
            "/cpackage.js": "I do not know what I am.",
        };
        Object.keys(filenameToContents).forEach((key) => {
            mock.get(`https://www.khanacademy.org${key}`,
                     req => filenameToContents[key]);
        });
    });

    after(() => {
        mock.unmock(superagent);
    });

    it('should echo the package contents', (done) => {
        const testJson = {
            files: ['/apackage.js', '/bpackage.js', '/cpackage.js'],
        };
        const expected = ("I am an A!\n" +
                          "I am a B!\n" +
                          "I do not know what I am.");
        agent
            .post('/render')
            .send(testJson)
            .expect({contents: expected}, done);
    });
});


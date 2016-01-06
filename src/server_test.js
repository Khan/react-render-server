const request = require("supertest");

const server = require("./server.js");


describe('render', () => {
    const agent = request.agent(server);

    it('should echo the input', (done) => {
        const testJson = {'foo': 'bar', 'baz': [1, 2, 3]};
        agent
            .post('/render')
            .send(testJson)
            .expect(testJson, done);
    });
});


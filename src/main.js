/**
 * The main entrypoint for our react-component render server.
 */

/* eslint-disable no-console */

const app = require("./server.js");

const server = app.listen(8060, () => {
    const host = server.address().address;
    const port = server.address().port;

    console.log('react-render-server running at http://%s:%s', host, port);
});


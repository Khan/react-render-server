/**
 * The main entrypoint for our react-component render server.
 */

/* eslint-disable no-console */

const express = require("express");

const app = express();

app.get('/_api/ping', (req, res) => { res.send('pong!\n'); });

var server = app.listen(8060, () => {
    const host = server.address().address;
    const port = server.address().port;

    console.log('react-render-server running at http://%s:%s', host, port);
});

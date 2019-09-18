/**
 * The main entrypoint for our react-component render server.
 */

"use strict";

// Now that cloud trace is set up, we can require() everything else.
const express = require("express");

const args = require("./arguments.js");
const logging = require("./logging.js");

const app = require("./server.js");
const renderSecret = require("./secret.js");

const port = args.port;

if (!args.dev) {
    // Start logging agent for Cloud Trace (https://cloud.google.com/trace/).
    // We need to do this as soon as possible so it can patch future requires.
    const traceAgent = require("@google-cloud/trace-agent");
    traceAgent.start({logLevel: 2}); // log at WARN and ERROR

    const debugAgent = require("@google-cloud/debug-agent");
    debugAgent.start({logLevel: 2});

    const profiler = require("@google-cloud/profiler");
    profiler.start();
}

// Set up our globals and singletons
if (args.dev) {
    // Disable the need for secrets.
    renderSecret.matches = (actual, callback) => {
        return callback(null, true);
    };

    process.env.NODE_ENV = "dev";
} else {
    // This is important for the default catch-all error handler:
    // http://expressjs.com/en/guide/error-handling.html
    process.env.NODE_ENV = "production";
}

// Add logging support, based on
//   https://cloud.google.com/nodejs/getting-started/logging-application-events
const appWithLogging = express();

appWithLogging.use(logging.middleware.requestLogger);
appWithLogging.use(logging.middleware.errorLogger);
appWithLogging.use(app);

const server = appWithLogging.listen(port, () => {
    const host = server.address().address;
    const port = server.address().port;
    logging.info("react-render-server running at http://%s:%s", host, port);
});

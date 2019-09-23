// @flow
/**
 * The main entrypoint for our react-component render server.
 */

import express from "express";
import logging, {middleware} from "./logging.js";

// Now that cloud trace is set up, we can require() everything else.

import args from "./arguments.js";

import app from "./server.js";

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
    process.env.NODE_ENV = "dev";
} else {
    // This is important for the default catch-all error handler:
    // http://expressjs.com/en/guide/error-handling.html
    process.env.NODE_ENV = "production";
}

// Add logging support, based on
//   https://cloud.google.com/nodejs/getting-started/logging-application-events
const appWithLogging = express();

appWithLogging.use(middleware.requestLogger);
appWithLogging.use(middleware.errorLogger);
appWithLogging.use(app);

const server = appWithLogging.listen(args.port, (err: ?Error) => {
    if (server == null || err != null) {
        logging.error(
            `react-render-server appears not to have started: ${(err &&
                err.message) ||
                "Unknown error"}`,
        );
        return;
    }

    const address = server.address();
    if (address == null || typeof address === "string") {
        logging.warn(
            "react-render-server may not have started properly: %s",
            address,
        );
        return;
    }

    const host = address.address;
    const port = address.port;
    logging.info(`react-render-server running at http://${host}:${port}`);
});

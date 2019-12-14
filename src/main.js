// @flow
/**
 * The main entrypoint for our react-component render server.
 */

// eslint-disable-next-line import/no-unassigned-import
import "./patch-promise.js";

import express from "express";

import args from "./arguments.js";
import logging, {middleware} from "./logging.js";
import app from "./server.js";

/**
 * Let's begin by logging our arguments.
 */
logging.debug(`Parsed arguments: ${args.toString()}`);

/**
 * In production mode, we want to hook up to various StackDriver services.
 */
if (!args.dev) {
    // Start logging agent for Cloud Trace (https://cloud.google.com/trace/).
    const traceAgent = require("@google-cloud/trace-agent");
    traceAgent.start({logLevel: 2}); // log at WARN and ERROR

    const debugAgent = require("@google-cloud/debug-agent");
    debugAgent.start({logLevel: 2});

    const profiler = require("@google-cloud/profiler");
    profiler.start();
}

/**
 * Make sure we have a NODE_ENV variablewithout overriding the test state.
 */
if (process.env.NODE_ENV !== "test") {
    if (args.dev) {
        process.env.NODE_ENV = "dev";
    } else {
        // This is important for the default catch-all error handler:
        // http://expressjs.com/en/guide/error-handling.html
        process.env.NODE_ENV = "production";
    }
}

/**
 * Create the express app.
 *
 * Logging support is based on:
 *   https://cloud.google.com/nodejs/getting-started/logging-application-events
 *
 * The order matters here.
 *
 * The request logger should come before the app, and the error logger, after.
 */
const appWithLogging = express()
    .use(middleware.requestLogger)
    .use(app)
    .use(middleware.errorLogger);

/**
 * Start the server listening.
 *
 * We need the variable so we can reference it inside the error handling
 * callback. Feels a bit nasty, but it works.
 */
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

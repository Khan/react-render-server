// @flow
/**
 * The main entrypoint for our react-component render server.
 */

/**
 * Import the trace-agent setup first so that it can patch everything else.
 */
// eslint-disable-next-line import/no-unassigned-import
import "./trace-agent.js";

import args from "./arguments.js";
import express from "express";
import {
    rootLogger as logging,
    extractErrorInfo,
    makeErrorMiddleware,
    makeRequestMiddleware,
} from "./logging.js";
import {requestIDMiddleware} from "./request-id-middleware.js";
import app from "./server.js";

async function main() {
    /**
     * Let's begin by logging our arguments.
     */
    logging.debug(`Parsed arguments: ${args.toString()}`);

    /**
     * In production mode, we want to hook up to various StackDriver services.
     */
    if (!args.dev) {
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
        // Add request log middleware.
        .use(await makeRequestMiddleware(logging))
        // Augment request log middleware with GAE requestID.
        .use(requestIDMiddleware)
        // Add the app.
        .use(app)
        // Add error handling middleware.
        .use(makeErrorMiddleware(logging));

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

    /**
     * NOTE(somewhatabstract): We have seen many 502 BAD GATEWAY errors in
     * production Node services. It seems this is because the Node server
     * is closing a connection before the load balancer is expecting it to.
     * There is some indication on the Internet [1] that the issue can occur
     * when Node's (or nginx [2]) keepalive is lower than the load balancer's
     * keepalive. In addition, the recommended fix is to always have the load
     * balancer close a connection by ensuring the Node server has a higher
     * keepalive timeout value than the load balancer.
     *
     * Node's default is 5s, but the indication is that the Google load
     * balancer value is 80s [3]. So, here we default to 90s, but we also
     * provide a configuration value to change it as needed.
     *
     * In addition, it is suggested that the headers timeout should be higher
     * than the keepalive timeout [1].
     *
     * [1] https://shuheikagawa.com/blog/2019/04/25/keep-alive-timeout/
     * [2] https://blog.percy.io/tuning-nginx-behind-google-cloud-platform-http-s-load-balancer-305982ddb340
     * [3] https://khanacademy.slack.com/archives/CJSE4TMQX/p1573252787333500
     */
    if (server != null) {
        server.keepAliveTimeout = 90000;
        /**
         * Flow's node types don't support this yet.
         * $FlowIgnore
         */
        server.headersTimeout = server.keepAliveTimeout + 5000;
    }
}

main().catch((err) => {
    const errorString = extractErrorInfo(err);
    logging.error(`Error caught from main setup: ${errorString}`);
});

/**
 * The main entrypoint for our react-component render server.
 */

'use strict';

const argparse = require("argparse");

const packageInfo = require("../package.json");

const parser = new argparse.ArgumentParser({
    version: packageInfo.version,
    addHelp: true,
    description: packageInfo.description,
});
parser.addArgument(
    ['-p', '--port'],
    {
        type: 'int',
        defaultValue: 8060,
        help: "Port to run on.",
    });
parser.addArgument(
    ['--dev'],
    {
        action: 'storeTrue',
        help: "Set if running on dev; controls caching/etc.",
    });
parser.addArgument(
    ['--cache-size'],
    {
        type: 'int',
        defaultValue: 200,
        help: "Internal cache size, in MB.",
    });
parser.addArgument(
    ['--render-timeout'],
    {
        type: 'int',
        defaultValue: 1000,
        help: "How many ms until we abort a render as taking too long.",
    });
parser.addArgument(
    ['--log-level'],
    {
        defaultValue: 'info',
        choices: ['silly', 'debug', 'verbose', 'info', 'warn', 'error'],
        help: "What level to log at.",
    });
parser.addArgument(
    ['--likeprod'],
    {
        action: 'storeTrue',
        help: "Only useful with --dev. Tells the dev server to cache and timeout like production would",
    }
)

const args = parser.parseArgs();

if (!args.dev) {
    // Start logging agent for Cloud Trace (https://cloud.google.com/trace/).
    // We need to do this as soon as possible so it can patch future requires.
    const traceAgent = require('@google-cloud/trace-agent');
    traceAgent.start({logLevel: 2});  // log at WARN and ERROR

    const debugAgent = require('@google-cloud/debug-agent');
    debugAgent.start({logLevel: 2});

    const profiler = require('@google-cloud/profiler')
    profiler.start();
}


// Now that cloud trace is set up, we can require() everything else.
const express = require("express");
const expressWinston = require('express-winston');
const winston = require('winston');

const StackdriverTransport = (
    require('@google-cloud/logging-winston').LoggingWinston);

const app = require("./server.js");
const cache = require("./cache.js");
const fetchPackage = require("./fetch_package.js");
const renderSecret = require("./secret.js");

const logging = winston;     // just an alias, for clarity

const port = args.port;

// Set up our globals and singletons
if (args.dev) {
    // If we want to test things a bit more closely to how prod does, we can
    // skip caching behavior changes.
    if (!args.likeprod) {
        // In dev, we do an if-modified-since query rather than trusting
        // the cache never gets out of date.  (In prod the default cache
        // behavior is fine because package-names include their md5 in the
        // filename.)
        fetchPackage.setDefaultCacheBehavior('ims');
    } else {
        // eslint-disable-next-line no-console
        console.log("DEV: Caching and timeouts like production");
    }

    // Disable the need for secrets.
    renderSecret.matches = (actual, callback) => {
        return callback(null, true);
    };

    process.env.NODE_ENV = 'dev';
} else {
    // This is important for the default catch-all error handler:
    // http://expressjs.com/en/guide/error-handling.html
    process.env.NODE_ENV = 'production';
}

// Add logging support, based on
//   https://cloud.google.com/nodejs/getting-started/logging-application-events
winston.level = args.log_level;
const appWithLogging = express();

function getTransports(json, colorize) {
    const transports = [];
    if (!args.dev) {
        transports.push(new StackdriverTransport());
    }
    transports.push(new winston.transports.Console({
        json,
        colorize,
    }));
    return transports;
}

appWithLogging.use(expressWinston.logger({      // request logging
    transports: getTransports(false, args.dev), // colorize for dev, not prod
    expressFormat: true,
    meta: false,
}));
appWithLogging.use(expressWinston.errorLogger({      // error logging
    transports: getTransports(true, args.dev), // colorize for dev, not prod
}));
appWithLogging.use(app);

cache.init(args.cache_size * 1024 * 1024);

const server = appWithLogging.listen(port, () => {
    const host = server.address().address;
    const port = server.address().port;
    logging.info('react-render-server running at http://%s:%s', host, port);
});

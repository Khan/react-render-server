/**
 * The main entrypoint for our react-component render server.
 */

'use strict';

const argparse = require("argparse");
const express = require("express");
const expressWinston = require('express-winston');
const winston = require('winston');

const app = require("./server.js");
const cache = require("./cache.js");
const fetchPackage = require("./fetch_package.js");
const packageInfo = require("../package.json");
const render = require("./render.js");
const renderSecret = require("./secret.js");

const logging = winston;     // just an alias, for clarity

const parser = new argparse.ArgumentParser({
    version: packageInfo.version,
    addHelp: true,
    description: packageInfo.description,
});
parser.addArgument(['-p', '--port'],
                   {type: 'int', defaultValue: 8060,
                    help: "Port to run on."});
parser.addArgument(['--dev'],
                   {action: 'storeTrue',
                    help: "Set if running on dev; controls caching/etc."});
parser.addArgument(['--cache-size'],
                   {type: 'int', defaultValue: 100,
                    help: "Internal cache size, in MB."});

const args = parser.parseArgs();

const port = args.port;

// Set up our globals and singletons
if (args.dev) {
    // In dev, we do an if-modified-since query rather than trusting
    // the cache never gets out of date.  (In prod the default cache
    // behavior is fine because package-names include their md5 in the
    // filename.)
    fetchPackage.setDefaultCacheBehavior('ims');
    render.setDefaultCacheBehavior('ignore');
    // We also turn off the timeout in dev; it's not as important there.
    fetchPackage.setTimeout(null);
    // Disable the need for secrets.
    renderSecret.matches = (actual) => true;
} else {
    // In production, we write to a file which magically gets picked up by the
    // AppEngine log service so we can see them in the log viewer.
    //
    // https://cloud.google.com/appengine/docs/managed-vms/custom-runtimes#logging
    // TODO(csilvers): is this necessary?  This page hints no:
    // https://cloud.google.com/nodejs/getting-started/logging-application-events
    //const managedVMLogPath = "/var/log/app_engine/request.log";
    //const accessLogStream = fs.createWriteStream(managedVMLogPath,
    //                                             {flags: 'a'});
}

// Add logging support, based on
//   https://cloud.google.com/nodejs/getting-started/logging-application-events
const appWithLogging = express();
appWithLogging.use(expressWinston.logger({      // request logging
    transports: [
        new winston.transports.Console({
            json: false,
            colorize: args.dev,    // colorize for dev, but not prod
        }),
    ],
    expressFormat: true,
    meta: false,
}));
appWithLogging.use(expressWinston.errorLogger({      // error logging
    transports: [
        new winston.transports.Console({
            json: true,
            colorize: args.dev,
        }),
    ],
}));
// Send a 500 on all uncaught exceptions.
// We also append the normal app on after this, and we're all set!
appWithLogging.use(function(err, req, res, next) {
    res.status(500).send('Something broke!');
}, app);

cache.init(args.cacheSize * 1024 * 1024);

// Don't let unhandled Promise rejections fail silently.
//
// Ideally this would result in the request containing the unhandled rejection,
// if any, 500'ing, but I don't know how you'd be able to recover a reference
// to the request from reason or p.
process.on('unhandledRejection', (reason, p) => {
    logging.error("Unhandled Rejection at: Promise ", p,
                  " reason: ", reason.stack);
});

const server = appWithLogging.listen(port, () => {
    const host = server.address().address;
    const port = server.address().port;

    logging.info('react-render-server running at http://%s:%s', host, port);
});


/**
 * The main entrypoint for our react-component render server.
 */

/* eslint-disable no-console */

const argparse = require("argparse");

const app = require("./server.js");
const fetchPackage = require("./fetch_package.js");
const cache = require("./cache.js");
const packageInfo = require("../package.json");

const parser = new argparse.ArgumentParser({
    version: packageInfo.version,
    addHelp: true,
    description: packageInfo.description,
});
parser.addArgument(['-p', '--port'],
                   {type: 'int', defaultValue: 8060,
                    help: "Port to run on."});
parser.addArgument(['--host'],
                   {defaultValue: 'https://www.khanacademy.org',
                    help: "Host to fetch javascript files from."});
parser.addArgument(['--cache-size'],
                   {type: 'int', defaultValue: 100,
                    help: "Internal cache size, in MB."});

const args = parser.parseArgs();

const port = args.port;
const host = args.host.replace(/\/$/, '');     // get rid of any trailing /

// Set up our globals and singletons
fetchPackage.setServerHostname(host);    // funtimes global funtimes
cache.init(args.cacheSize * 1024 * 1024);

// Don't let unhandled Promise rejections fail silently.
//
// Ideally this would result in the request containing the unhandled rejection,
// if any, 500'ing, but I don't know how you'd be able to recover a reference
// to the request from reason or p.
process.on('unhandledRejection', (reason, p) => {
    console.log("Unhandled Rejection at: Promise ", p,
                " reason: ", reason.stack);
});

const server = app.listen(port, () => {
    const host = server.address().address;
    const port = server.address().port;

    console.log('react-render-server running at http://%s:%s', host, port);
});


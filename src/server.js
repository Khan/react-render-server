/**
 * The high-level logic for our serving endpoints (api routes).
 */

'use strict';

const bodyParser = require("body-parser");
const express = require("express");
const logging = require("winston");

const cache = require("./cache.js");
const fetchPackage = require("./fetch_package.js");
const graphiteUtil = require("./graphite_util.js");
const profile = require("./profile.js");
const render = require("./render.js");
const renderSecret = require("./secret.js");

// We keep track of how many render requests are currently "in
// flight", to help us estimate how long a new request will take.
let pendingRenderRequests = 0;

const app = express();
app.use(bodyParser.json({limit: '5mb'}));


/**
 * Server-side render a react component.
 *
 * The contents to render are sent in the request body as json, in
 * the following format:
 * {
 *    "urls": [
 *        "http://kastatic.org/genfiles/javascript/en/corelibs-package-xx.js",
 *        "http://kastatic.org/genfiles/javascript/en/shared-package-xx.js",
 *        "http://kastatic.org/genfiles/javascript/en/content-library-xx.js"
 *    ],
 *    "path": "./javascript/content-library-package/components/link.jsx",
 *    "globals": {
 *        "location": "http://khanacademy.org/science/physics",
 *        "KA": {
 *            "language": "en"
 *        }
 *    },
 *    "props": {
 *        "href": "http://www.google.com",
 *        "children": "Google"
 *    },
 *    "secret": "...."
 * }
 *
 * 'urls' should be specified in topological-sort order; they are
 * executed in the order listed here.
 *
 * 'path' is a path in nodejs require() format, which exports the react
 * component we wish to render.  It must be included in one of the files
 * specified in 'urls'.
 *
 * `globals` is a map of global variables to their values. These values will be
 * set in the JavaScript VM context before the React component specified by
 * `path` is `require()`'d.
 *
 * 'props' are passed as the props to the react component being rendered.
 *
 * 'secret' is a shared secret.  It must equal the value of the 'secret'
 * file in the server's base-directory, or the server will deny the request.
 * NOTE: In dev mode, the secret field is ignored.
 *
 * The return format is also json:
 * {
 *     "html": "<a href='http://www.google.com' class='link141'>Google</a>",
 *     "css": {
 *         content: ".link141{backgroundColor:transparent;}",
 *         renderedClassNames: ["link141"]
 *     }
 * }
 *
 * css will only be returned if the component makes use of Aphrodite
 * (https://github.com/Khan/aphrodite).
 */

// This middleware manages the number of connections, and logs about it.
app.use('/render', (req, res, next) => {
    // The number of concurrent requests will fluctuate as this
    // request is evaluated.  We arbitrarily take the number at
    // our-request-start as the value we log.
    // We store the stats-to-log in `req` as a hacky way of holding
    // per-request stats.
    req.requestStats = {
        pendingRenderRequests: pendingRenderRequests,
        packageFetches: 0,
        createdVmContext: false,
        vmContextSize: 0,
    };

    pendingRenderRequests++;
    const renderProfile = profile.start();

    // Monkey-patch res.end so we can do our logging at request-end.
    const end = res.end;
    res.end = (chunk, encoding) => {
        pendingRenderRequests--;
        if (res.statusCode < 300) {   // only log on successful fetches
            renderProfile.end(`render-stats for ${req.body.path}: ` +
                              JSON.stringify(req.requestStats));
        }
        res.end = end;
        res.end(chunk, encoding);
    };
    next();
});

app.post('/render', (req, res) => {
    // Validate the input.
    let err;
    let value;
    if (!renderSecret.matches(req.body.secret)) {
        err = 'Missing or invalid secret';
        value = '<redacted>';
    } else if (!Array.isArray(req.body.urls) || req.body.urls.length === 0 ||
               !req.body.urls.every(e => typeof e === 'string') ||
               !req.body.urls.every(e => e.indexOf('http') === 0)) {
        err = ('Missing "urls" keyword in POST JSON input, ' +
               'or "urls" is not a list of full urls');
        value = req.body.urls;
    } else if (typeof req.body.path !== 'string' ||
               req.body.path.indexOf("./") !== 0) {
        err = ('Missing "path" keyword in POST JSON input, ' +
               'or "path" does not start with "./"');
        value = req.body.path;
    } else if (typeof req.body.props !== 'object' ||
               Array.isArray(req.body.props)) {
        err = ('Missing "props" keyword in POST JSON input, ' +
               'or "props" is not an object, or it has non-string keys.');
        value = req.body.props;
    }
    if (err) {
        res.status(400).json({error: err, value: value});
        return;
    }

    const fetchPromises = req.body.urls.map(
        url => fetchPackage(url, undefined, req.requestStats).then(
            contents => [url, contents])
    );

    Promise.all(fetchPromises).then(
        (fetchBodies) => {
            const renderedState = render(fetchBodies,
                                         req.body.path,
                                         req.body.props,
                                         req.body.globals,
                                         undefined,
                                         req.requestStats);
            res.json(renderedState);
        },
        (err) => {
            // Error handler for fetching failures.
            if (err.response && err.response.error) {
                logging.error('Fetching failure: ' + err.response.error + ': ',
                              err.stack);
                res.status(500).json({error: err});
            } else if (err.error) {        // set for timeouts, in particular
                logging.error(err.error);
                res.status(500).json(err);
            } else {
                logging.error('Fetching failure: ', err.stack);
                res.status(500).json({error: err.toString()});
            }
            // If the error was a timeout, log that fact to graphite.
            if (err.timeout) {
                graphiteUtil.log("react_render_server.stats.timeout", 1);
            }

        })
        .catch((err) => {
            // Error handler for rendering failures
            logging.error('Rendering failure:', err.stack);
            res.status(500).json({error: err.toString()});
        });
});


/**
 * Flush all the caches.
 *
 * This can be useful when there's weird errors that may be due to bad
 * caching, or for testing.
 *
 * The post data is sent in the request body as json, in the following format:
 * {
 *    "secret": "...."
 * }
 *
 * 'secret' is a shared secret.  It must equal the value of the 'secret'
 * file in the server's base-directory, or the server will deny the request.
 * NOTE: In dev mode, the secret field is ignored.
 *
 * We respond with the instance that was flushed.
 * TODO(csilvers): how do we flush *all* the instances??
 */
app.post('/flush', (req, res) => {
    if (!renderSecret.matches(req.body.secret)) {
        res.status(400).json({error: 'Missing or invalid secret'});
        return;
    }
    cache.reset();
    res.send((process.env['GAE_MODULE_INSTANCE'] || 'dev') + '\n');
});

app.get('/_api/ping', (req, res) => { res.send('pong!\n'); });

app.get('/_api/version', (req, res) => {
    // This will return the module version ID we set when deploying.
    res.send((process.env['GAE_MODULE_VERSION'] || 'dev') + '\n');
});

// These are used by the Managed VM lifecycle functions:
// https://cloud.google.com/appengine/docs/managed-vms/custom-runtimes#lifecycle_events
app.get('/_ah/health', (req, res) => { res.send('ok!\n'); });
app.get('/_ah/start', (req, res) => { res.send('ok!\n'); });
app.get('/_ah/stop', (req, res) => { res.send('ok!\n'); });


module.exports = app;


/**
 * The high-level logic for our serving endpoints (api routes).
 */

'use strict';

const bodyParser = require("body-parser");
const express = require("express");

const cache = require("./cache.js");
const profile = require("./profile.js");
const renderSecret = require("./secret.js");
const renderWorkers = require("./render_workers.js");


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

const checkSecret = function(req, res, next) {
    renderSecret.matches(req.body.secret, (err, secretMatches) => {
        if (err || !secretMatches) {
            return res.status(400).send({error: "Missing or invalid secret"});
        }
        return next();
    });
};

app.post('/render', checkSecret, (req, res) => {
    // Validate the input.
    let err;
    let value;
    if (!Array.isArray(req.body.urls) || req.body.urls.length === 0 ||
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

    let fetchFn;
    if (req.body.renderInMainProcess) {     // used for tests
        // This does the work that's normally done in the subprocess,
        // but we'll just do it directly in the main process.
        fetchFn = renderWorkers.fetchAndRenderInWorker;
    } else {
        fetchFn = renderWorkers.fetchAndRender;
    }
    fetchFn(
        req.body.path, req.body.urls, req.body.props, req.body.globals,
        req.requestStats
    ).then(renderedState => {
        // We store the updated request-stats in renderedState
        // (the only way to get the updated data back from our
        // subprocess); pop that out into update req.requestStats.
        req.requestStats = renderedState.requestStats;
        delete renderedState.requestStats;
        res.json(renderedState);
    }).catch((err) => {
        res.status(500).json(err);
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
app.post('/flush', checkSecret, (req, res) => {
    cache.reset();
    res.send((process.env['GAE_INSTANCE'] || 'dev') + '\n');
});

app.get('/_api/ping', (req, res) => res.send('pong!\n'));

app.get('/_api/version', (req, res) => {
    // This will return the module version ID we set when deploying.
    res.send((process.env['GAE_VERSION'] || 'dev') + '\n');
});

// These are used by the Managed VM lifecycle functions:
// https://cloud.google.com/appengine/docs/managed-vms/custom-runtimes#lifecycle_events
app.get('/_ah/health', (req, res) => res.send('ok!\n'));
app.get('/_ah/start', (req, res) => res.send('ok!\n'));
app.get('/_ah/stop', (req, res) => res.send('ok!\n'));


// Simplistic priming endpoint. Calling this endpoint uses CPU and thus
// hopefully causes the autoscaler to spin up more instances. This endpoint
// takes about 2 seconds when called locally on my laptop.
app.get('/prime', (req, res) => {
    for (var i = 0; i < 3000000000; i++) { // eslint-disable-line
    }
    res.send('ok\n');
});

module.exports = app;

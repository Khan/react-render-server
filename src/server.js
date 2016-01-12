'use strict';

/**
 * The high-level logic for our serving endpoints (api routes).
 */

/* eslint-disable no-console */

const bodyParser = require("body-parser");
const express = require("express");

const fetchPackage = require("./fetch_package.js");
const render = require("./render.js");

const app = express();
app.use(bodyParser.json());

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
 *    "props": {
 *        "href": "http://www.google.com",
 *        "children": "Google"
 *    }
 * }
 *
 * 'urls' should be specified in topological-sort order; they are
 * executed in the order listed here.
 *
 * 'path' is a path in nodejs require() format, which exports the react
 * component we wish to render.  It must be included in one of the files
 * specified in 'urls'.
 *
 * 'props' are passed as the props to the react component being rendered.
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
app.post('/render', (req, res) => {
    // Validate the input.
    // TODO(csilvers): add a 'secret' arg and verify that it matches.
    let err;
    if (!Array.isArray(req.body.urls) || req.body.urls.length === 0 ||
            !req.body.urls.every(e => typeof e === 'string') ||
            !req.body.urls.every(e => e.indexOf('http') === 0)) {
        err = ('Missing "urls" keyword in POST JSON input, ' +
               'or "urls" is not a list of full urls');
    } else if (typeof req.body.path !== 'string' ||
               req.body.path.indexOf("./") !== 0) {
        err = ('Missing "path" keyword in POST JSON input, ' +
               'or "path" does not start with "./"');
    } else if (typeof req.body.props !== 'object' ||
               Array.isArray(req.body.props)) {
        err = ('Missing "props" keyword in POST JSON input, ' +
               'or "props" is not an object, or it has non-string keys.');
    }
    if (err) {
        res.status(400).json({error: err});
        return;
    }

    const fetchPromises = req.body.urls.map(
        url => fetchPackage(url).then(contents => [url, contents])
    );

    Promise.all(fetchPromises).then(
        (fetchBodies) => {
            const renderedState = render(fetchBodies,
                                         req.body.path,
                                         req.body.props);
            res.json(renderedState);
        },
        (err) => {
            // Error handler for fetching failures.
            if (err.response && err.response.error) {
                console.error('Fetching failure: ' + err.response.error + ': ',
                              err.stack);
            } else {
                console.error('Fetching failure: ', err.stack);
            }
            res.status(500).json({error: err});
        })
        .catch((err) => {
            // Error handler for rendering failures
            console.error('Rendering failure:', err.stack);
            res.status(500).json({error: err});
        });
});


app.get('/_api/ping', (req, res) => { res.send('pong!\n'); });

// These are used by the Managed VM lifecycle functions:
// https://cloud.google.com/appengine/docs/managed-vms/custom-runtimes#lifecycle_events
app.get('/_ah/health', (req, res) => { res.send('ok!\n'); });
app.get('/_ah/start', (req, res) => { res.send('ok!\n'); });
app.get('/_ah/stop', (req, res) => { res.send('ok!\n'); });

module.exports = app;


/**
 * The high-level logic for our serving endpoints (api routes).
 */

"use strict";

const bodyParser = require("body-parser");
const express = require("express");
const logging = require("winston");

const fetchPackage = require("./fetch_package.js");
const graphiteUtil = require("./graphite_util.js");
const profile = require("./profile.js");
const renderSecret = require("./secret.js");
const render = require("./render.js");

// We keep track of how many render requests are currently "in
// flight", to help us estimate how long a new request will take.
let pendingRenderRequests = 0;

const app = express();
app.use(bodyParser.json({limit: "5mb"}));

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
 * executed in the order listed here. The last one should always be the
 * instigator of the render.
 *
 * `globals` is a map of global variables to their values. These values will be
 * set in the JavaScript VM context before the entry point specified by
 * `entry` is `require()`'d.
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
app.use("/render", (req, res, next) => {
    // The number of concurrent requests will fluctuate as this
    // request is evaluated.  We arbitrarily take the number at
    // our-request-start as the value we log.
    // We store the stats-to-log in `req` as a hacky way of holding
    // per-request stats.
    req.requestStats = {
        pendingRenderRequests: pendingRenderRequests,
        packageFetches: 0,
        fromCache: 0,
        vmContextSize: 0,
        createdVmContext: false,
    };

    pendingRenderRequests++;
    const renderProfile = profile.start();

    // Monkey-patch res.end so we can do our logging at request-end.
    const end = res.end;
    res.end = (chunk, encoding) => {
        pendingRenderRequests--;
        if (res.statusCode < 300) {
            // only log on successful fetches
            renderProfile.end(
                `render-stats for ${
                    req.body.urls[req.body.urls.length - 1]
                }: ` + JSON.stringify(req.requestStats),
            );
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

const handleFetchError = function(err, res) {
    // Error handler for fetching failures.
    if (err.response && err.response.error) {
        logging.error(
            "Fetching failure: " + err.response.error + ": ",
            err.stack,
        );
        res.status(500).json({error: err, stack: err.stack});
    } else if (err.error) {
        // set for timeouts, in particular
        logging.error(err.error);
        res.status(500).json(err);
    } else {
        logging.error("Fetching failure: ", err.stack);
        res.status(500).json({error: err.toString(), stack: err.stack});
    }
    // If the error was a timeout, log that fact to graphite.
    if (err.timeout) {
        graphiteUtil.log("react_render_server.stats.timeout", 1);
    }
};

const respond400Error = (res, error, value) => {
    return res.status(400).json({error, value});
};

app.post("/render", checkSecret, (req, res) => {
    // Validate the input.
    const {urls, props, globals} = req.body;

    if (!Array.isArray(urls) || !urls.every(url => typeof url === "string")) {
        return respond400Error(
            res,
            'Missing "urls" keyword in POST JSON input, ' +
                'or "urls" is not a list of strings',
            urls,
        );
    } else if (typeof props !== "object" || Array.isArray(props)) {
        return respond400Error(
            res,
            'Missing "props" keyword in POST JSON input, ' +
                'or "props" is not an object, or it has non-string keys.',
            props,
        );
    }

    // We filter out all non-JS URLs as we don't need to download them in
    // order to render the page (for example .css files may be specified and
    // we want to ignore them)
    const jsUrls = urls.filter(
        url => url.startsWith("http") && url.endsWith(".js"),
    );

    if (jsUrls.length === 0) {
        return respond400Error(
            res,
            'Error in "urls" keyword in POST JSON input, ' +
                "no valid JS urls were specified.",
            urls,
        );
    }

    // Fetch the entry point and its dependencies.
    const fetchPromises = jsUrls.map(url =>
        fetchPackage(url, req.requestStats)
    );

    // TODO(joshuan): Consider moving to async/await.
    Promise.all(fetchPromises)
        .then(
            packages =>
                render(
                    packages,
                    props,
                    globals,
                    req.requestStats,
                ).then(renderedState => {
                    // We store the updated request-stats in renderedState
                    // (the only way to get the updated data back from our
                    // subprocess); pop that out into update req.requestStats.
                    req.requestStats = renderedState.requestStats;
                    delete renderedState.requestStats;
                    res.json(renderedState);
                }),
            err => handleFetchError(err, res),
        )
        .catch(err => {
            logging.error(
                "Rendering failure: " + jsUrls[jsUrls.length - 1] + " :",
                err.stack,
            );
            // A rendering error is probably a bad component, so we
            // give a 400.
            res.status(400).json({error: err.toString(), stack: err.stack});
        });
});

app.get("/_api/ping", (req, res) => res.send("pong!\n"));

app.get("/_api/version", (req, res) => {
    // This will return the module version ID we set when deploying.
    res.send((process.env["GAE_VERSION"] || "dev") + "\n");
});

// These are used by the Managed VM lifecycle functions:
// https://cloud.google.com/appengine/docs/managed-vms/custom-runtimes#lifecycle_events
app.get("/_ah/health", (req, res) => res.send("ok!\n"));
app.get("/_ah/start", (req, res) => res.send("ok!\n"));
app.get("/_ah/stop", (req, res) => res.send("ok!\n"));

// Simplistic priming endpoint. Calling this endpoint uses CPU and thus
// hopefully causes the autoscaler to spin up more instances. This endpoint
// takes about 2 seconds when called locally on my laptop.
app.get("/prime", (req, res) => {
    for (let i = 0; i < 3000000000; i++) {
        // noop
    }
    res.send("ok\n");
});

module.exports = app;

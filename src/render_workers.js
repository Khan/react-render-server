/**
 * A simple wrapper around worker-nodes to provide render-processes.
 *
 * We don't want to render in the main process because rendering is
 * CPU-intensive, which means we can't interrupt or cancel renders
 * that take too long.  By using a process pool, we can.
 */

const logging = require("winston");
const workerNodes = require("worker-nodes");
const workerNodeErrors = require("worker-nodes/lib/errors.js");

const fetchPackage = require("./fetch_package.js");
const graphiteUtil = require("./graphite_util.js");
const render = require("./render.js");


let renderWorkers = null;


// When run in a subprocess (via worker-nodes.js) we need to
// initialize our own cache.  worker-nodes.js sets an envvar
// letting us know that.
if (process.env._RENDER_CACHE_SIZE) {
    require("./cache.js").init(parseInt(process.env._RENDER_CACHE_SIZE));
}
// Likewise, we need to do some mocking in the subprocess for tests.
if (process.env._MOCK_FETCHES_FOR_TESTS) {
    const fs = require("fs");
    const nock = require("nock");

    nock.disableNetConnect();
    nock.enableNetConnect('127.0.0.1');
    const mockScope = nock('https://www.khanacademy.org');
    process.env._MOCK_FETCHES_FOR_TESTS.split(",").forEach((urlData) => {
        // Each url is of the form "url;response_code;response_delay"
        const [url, rc, delay] = urlData.split(";");
        const path = url.substr('https://www.khanacademy.org'.length);
        const contents = fs.readFileSync(`${__dirname}/testdata${path}`,
                                         "utf-8");
        let response = mockScope.get(path);
        if (delay) {
            response = response.delay(delay);
        }
        response.reply(rc || 200, contents);
    });
}



// options are as in
// https://www.npmjs.com/package/worker-nodes#WorkerNodesOptions
const init = function(cacheSize, options) {
    // worker-nodes doesn't support initialization code, so
    // instead we set an envvar telling render.js to run
    // appropriate initialization code at import-time.
    process.env._RENDER_CACHE_SIZE = cacheSize;
    renderWorkers = new workerNodes(`${__dirname}/render_workers.js`, options);
};


// Returns a promise that resolves when the new workers have started up.
// Used only for tests!
const reset = function(cacheSize, options) {
    if (!renderWorkers) {
        init(cacheSize, options);
    }
    return renderWorkers.terminate().then(() => init(cacheSize, options));
};


// Terminate all the workers.  Returns a promise that resolves when all
// the workers are terminated.  Used only for tests!
const terminate = function() {
    return renderWorkers.terminate();
};


const fetchAndRenderInWorker = function(path, urls, props, globals,
                                        requestStats) {
    const fetchPromises = urls.map(
        url => fetchPackage(url, undefined, requestStats).then(
            contents => [url, contents])
    );

    return Promise.all(fetchPromises).then(
        (fetchBodies) => {
            return render(fetchBodies,
                path,
                props,
                globals,
                undefined,
                requestStats
            );
        },
        (err) => {
            // If the error was a timeout, log that fact to graphite.
            if (err.timeout) {
                graphiteUtil.log("react_render_server.stats.timeout", 1);
            }
            // Error handler for fetching failures.
            if (err.response && err.response.error) {
                logging.error('Fetching failure: ' + err.response.error + ': ',
                              err.stack);
                throw new Error({error: err});
            } else if (err.error) {        // set for timeouts, in particular
                logging.error(err.error);
                throw new Error(err);
            } else {
                logging.error('Fetching failure: ', err.stack);
                throw new Error({error: err.toString()});
            }
        })
        .catch((err) => {
            // Error handler for rendering failures
            if (err instanceof workerNodeErrors.TimeoutError) {
                graphiteUtil.log("react_render_server.stats.timeout", 1);
                const errorText = `Timeout rendering ${path}`;
                logging.error('Rendering failure:', errorText);
                throw new Error({error: errorText});
            } else {
                logging.error('Rendering failure:', err.stack);
                throw new Error({error: err.toString()});
            }
        });
};


// Returns a promise that is resolved when rendering is finished
// in the subprocess.
// You must call init() before calling this!
const fetchAndRender = function(path, urls, props, globals, requestStats) {
    return renderWorkers.call.fetchAndRenderInWorker(
        path, urls, props, globals, requestStats);
};


module.exports = {
    init: init,
    reset: reset,
    terminate: terminate,
    fetchAndRenderInWorker: fetchAndRenderInWorker,
    fetchAndRender: fetchAndRender,
};

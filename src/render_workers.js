/**
 * A simple wrapper around worker-nodes to provide render-processes.
 *
 * We don't want to render in the main process because rendering is
 * CPU-intensive, which means we can't interrupt or cancel renders
 * that take too long.  By using a process pool, we can.
 */

const workerNodes = require("worker-nodes");


let renderWorkers = null;


// options are as in
// https://www.npmjs.com/package/worker-nodes#WorkerNodesOptions
const init = function(cacheSize, options) {
    // worker-nodes doesn't support initialization code, so
    // instead we set an envvar telling render.js to run
    // appropriate initialization code at import-time.
    process.env._RENDER_CACHE_SIZE = cacheSize;
    renderWorkers = new workerNodes(`${__dirname}/render.js`, options);
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


// Returns a promise that is resolved when rendering is finished,
// with the return value being the return-value of render.js.
// The arguments are the same as render.js:render(), as well.
// You must call init() before calling this!
const render = function(...args) {
    return renderWorkers.call(...args);
};


module.exports = {
    init: init,
    reset: reset,
    terminate: terminate,
    render: render,
};

/**
 * A simple wrapper around worker-nodes to provide render-processes.
 *
 * We don't want to render in the main process because rendering is
 * CPU-intensive, which means we can't interrupt or cancel renders
 * that take too long.  By using a process pool, we can.
 */

const fs = require("fs");
const tmp = require("tmp");

const workerNodes = require("worker-nodes");


tmp.setGracefulCleanup();     // always clean up the tmpfiles we create
let renderWorkers = null;


// options are as in
// https://www.npmjs.com/package/worker-nodes#WorkerNodesOptions
const init = function(cacheSize, options) {
    // We want to create workers that initialize a cache to a given
    // size, at worker-startup, and then exposes a render() function.
    // But sadly worker-nodes doesn't support initialization code,
    // and I don't see a better way to do this than to create the
    // necessary file at runtime.  I use `tmp` for its automatic
    // cleanup.
    const template = `${__dirname}/render_cache_${cacheSize}_XXXXXX.js`;
    const tmpobj = tmp.fileSync({template: template, discardDescriptor: true});
    const filename = tmpobj.name;
    const contents = `
const cache = require("./cache.js");
cache.init(${cacheSize});
module.exports = require("./render.js");
`;
    fs.writeFileSync(filename, contents);

    renderWorkers = new workerNodes(filename, options);
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

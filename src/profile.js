/**
 * Simple tools for logging profiling data.
 *
 * This wraps the winston API for profiling.
 *
 * You can use it like this:
 *
 *     const profile = require("./profile.js");
 *
 *     const fooProfile = profile.start("doing foo");
 *     foo();
 *     fooProfile.end();
 *
 * Which will log something that looks like this:
 *
 *     PROFILE: doing foo (finished after 16.7658 ms)
 */
const {format} = require("winston");
const logging = require('./logging.js');

const start = (msg) => {
    if (!msg) {
        throw new Error("Must provide a message or name for the profile session.");
    }
    // We use the winston profiling API to do the profiling bit, but we add
    // some additional log entries to aid investigations (like spotting when
    // a profiling task started as winston will only log once profiling is done)
    logging.debug(`PROFILE(start): ${msg}`);

    const profiler = logging.startTimer();
    return {
        end: (endMsg) => {
            const message = endMsg || msg;
            profiler.done({
                message: `PROFILE(end): ${message}`,
                level: "debug",
            });
        },
    };
};

module.exports = { start: start };

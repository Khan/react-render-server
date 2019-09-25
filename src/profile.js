// @flow
/**
 * Simple tools for logging profiling data.
 *
 * This wraps the winston API for profiling.
 *
 * You can use it like this:
 *
 *     import profile from "./profile.js";
 *
 *     const fooProfile = profile.start("doing foo");
 *     foo();
 *     fooProfile.end();
 *
 * Which will log something that looks like this:
 *
 *     PROFILE(start): doing foo
 *
 *     PROFILE(end): doing foo (40ms)
 */
import logging from "./logging.js";

import type {LogLevel} from "./types.js";

type ProfileSession = {
    end: (endMsg?: string, level?: LogLevel) => void,
};

const start = (msg: string): ProfileSession => {
    if (!msg) {
        throw new Error(
            "Must provide a message or name for the profile session.",
        );
    }
    // We use the winston profiling API to do the profiling bit, but we add
    // some additional log entries to aid investigations (like spotting when
    // a profiling task started as winston will only log once profiling is done)
    logging.debug(`PROFILE(start): ${msg}`);

    const profiler = logging.startTimer();
    return {
        end: (endMsg?: string, level?: LogLevel = "debug") => {
            const message = endMsg || msg;
            profiler.done({
                message: `PROFILE(end): ${message}`,
                level,
            });
        },
    };
};

export default {start: start};

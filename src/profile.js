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
import {tracer} from "./trace-agent.js";
import type {LogLevel, Logger} from "./types.js";

type ProfileSession = {
    end: (endMsg?: string, level?: LogLevel) => void,
};

const start = (logging: Logger, msg: string): ProfileSession => {
    if (!msg) {
        throw new Error(
            "Must provide a message or name for the profile session.",
        );
    }

    // We use the winston profiling API to do the profiling bit, but we add
    // some additional log entries to aid investigations (like spotting when
    // a profiling task started as winston will only log once profiling is done)
    // We log the start markers at "silly" as generally we just want the end
    // summary. However the start markers may be useful if we have to dig in.
    logging.silly(`PROFILE(start): ${msg}`);

    /**
     * Start a trace section for this so it will appear in Stackdriver Trace
     * We annotate the start with "PROFILE:" so that it is clear in the trace
     * which spans were created by this API and which were inserted by other
     * means.
     */
    const span = tracer.createChildSpan({name: `PROFILE: ${msg}`});
    const profiler = logging.startTimer();
    return {
        end: (endMsg?: string, level?: LogLevel = "debug") => {
            span.endSpan();
            const message = endMsg || msg;
            profiler.done({
                message: `PROFILE(end): ${message}`,
                level,
            });
        },
    };
};

export default {start: start};

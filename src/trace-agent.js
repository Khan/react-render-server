// @flow
import args from "./arguments.js";

// Start logging agent for Cloud Trace (https://cloud.google.com/trace/).
import traceAgent from "@google-cloud/trace-agent";

export const tracer = traceAgent.start({
    enabled: !args.dev,
});

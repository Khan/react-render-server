// NOTE(somewhatabstract): We don't use the return type, so we're just saying
// There is one.
declare class traceagent$Tracer {}

declare type traceagent$Config = {
    logLevel: number,
};

declare function traceagent$start(config?: traceagent$Config): traceagent$Tracer;

declare module '@google-cloud/trace-agent' {
    declare export type Config = traceagent$Config;
    declare module.exports: {
        start: typeof traceagent$start,
    };
}

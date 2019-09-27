// NOTE(somewhatabstract): We don't use the return type, so we're just saying
// There is one.
declare type profiler$Config = {
    logLevel: number,
};

declare function profiler$start(config?: profiler$Config): Promise<void>;

declare module '@google-cloud/profiler' {
    declare export type Config = profiler$Config;
    declare module.exports: {
        start: typeof profiler$start,
    };
}

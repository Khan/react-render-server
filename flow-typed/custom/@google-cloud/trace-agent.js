

/**
 * Represents a trace span.
 */
declare interface traceagent$Span {
    /**
     * Ends the span. This method should only be called once.
     * @param timestamp A custom span end time; defaults to the time when endSpan
     * was called if not provided.
     */
    endSpan(timestamp?: Date): void;
}

/**
 * An interface that describes the available options for creating a span in
 * general.
 */
declare interface traceagent$SpanOptions {
    name: string;
    /**
     * The number of stack frames to skip when collecting call stack information
     * for the span, starting from the top; this should be set to avoid including
     * frames in the plugin. Defaults to 0.
     */
    skipFrames?: number;
}

declare class traceagent$Tracer {
    createChildSpan(options?: $traceagent$SpanOptions): traceagent$Span;
}

declare type traceagent$Config = {
    enabled?: boolean,
    logLevel?: number,
};

declare function traceagent$start(config?: traceagent$Config): traceagent$Tracer;

declare module '@google-cloud/trace-agent' {
    declare export type Config = traceagent$Config;
    declare export type SpanOptions = traceagent$SpanOptions;
    declare export type Span = traceagent$Span;
    declare module.exports: {
        start: typeof traceagent$start,
    };
}

// @flow

/**
 * Logging setup for our application.
 */
import stream from "stream";
import expressWinston from "express-winston";
import winston from "winston";

import * as lw from "@google-cloud/logging-winston";

import args from "./arguments.js";

import type {Middleware} from "express";
import type {Transport, NpmLogLevels, Format} from "winston";
import type {Info, Logger, LogLevel} from "./types.js";

/**
 * This is how the log message gets formatted.
 * We're adding the durationMs from the profiler commands in winston so
 * that we can read them :)
 */
const devFormatter = ({level, message, durationMs}: Info): string =>
    `${level}: ${message} ${(durationMs && `(${durationMs}ms)`) || ""}`;

function getFormatters() {
    const formatters: Array<Format> = [
        winston.format.splat(), // Allows for %s style substitutions
    ];

    formatters.push(winston.format.cli({level: true}));
    formatters.push(winston.format.printf((info: any) => devFormatter(info)));

    return winston.format.combine(...formatters);
}

function getTransports(isDev: boolean): Array<Transport> {
    if (process.env.NODE_ENV === "test") {
        // During testing, we just dump logging to a stream.
        // This isn't used for anything at all right now, but we could use
        // it for snapshot testing with some updates at some point.
        const sink = new stream.Writable({write: () => {}});
        // This is a hack to make our writable stream work $FlowFixMe
        sink._write = sink.write;
        return [
            new winston.transports.Stream({
                format: getFormatters(),
                stream: sink,
            }),
        ];
    }

    /**
     * If we're in dev mode, just use a console transport.
     */
    if (isDev) {
        return [
            new winston.transports.Console({
                format: getFormatters(),
            }),
        ];
    }

    /**
     * We must be in production, so use the Stackdriver logging setup.
     */
    return [new lw.LoggingWinston()];
}

function initLogging(logLevel: LogLevel, isDev: boolean): Logger {
    // This is the logger that we use to log general information in our app.
    // Whereever one might use console, use this instead.
    const winstonLogger = winston.createLogger<NpmLogLevels>({
        level: logLevel,
        transports: getTransports(isDev),
    });

    winstonLogger.debug(
        `Intialized logging with Level=${logLevel} DeveloperMode=${
            isDev ? "true" : "false"
        }`,
    );

    return winstonLogger;
}

export function extractErrorInfo(error: any): string {
    if (typeof error === "string") {
        return error;
    }

    if (error.response && error.response.error) {
        return `${error.response.error}: ${error.stack}`;
    }

    if (error.error && error !== error.error) {
        return extractErrorInfo(error.error);
    }

    if (error.stack) {
        return error.stack;
    }

    return `${error}`;
}

export function makeErrorMiddleware(logger: Logger): Promise<Middleware> {
    // This is the logger that captures errors in our express server.
    return Promise.resolve(
        expressWinston.errorLogger({
            /**
             * Specify the level that this logger logs at.
             * (use a function to dynamically change level based on req, res and
             * err)
             *     `function(req, res, err) { return String; }`
             */
            level: "error",

            /**
             * Use the logger we already set up.
             */
            winstonInstance: logger,
        }),
    );
}

export async function makeRequestMiddleware(
    logger: Logger,
): Promise<Middleware> {
    // This is the logger that captures requests handled by our express server.
    return args.dev
        ? /**
           * If we're in dev, we're going to use the expressWinston logger
           */
          Promise.resolve(
              expressWinston.logger({
                  /**
                   * Specify the level that this logger logs at.
                   * (use a function to dynamically change level based on req and res)
                   *     `function(req, res) { return String; }`
                   */
                  level: "info",

                  /**
                   * Use the logger we already set up.
                   */
                  winstonInstance: logger,
                  expressFormat: true,
                  colorize: true,
                  meta: false,
              }),
          )
        : /**
           * Otherwise, we're using the Google middleware
           */
          await lw.express.makeMiddleware(logger);
}

export const rootLogger: Logger = initLogging(args.logLevel, args.dev);

let scopedLogger: ?Logger = null;
export const getScopedLogger = (): Logger => {
    return scopedLogger != null ? scopedLogger : rootLogger;
};
export const useScopedLogger = (logger: Logger) => {
    scopedLogger = logger;
};
export const revertScopedLogger = () => {
    scopedLogger = null;
};

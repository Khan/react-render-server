// @flow

/**
 * Logging setup for our application.
 */
import stream from "stream";
import expressWinston from "express-winston";
import winston from "winston";

import {LoggingWinston as StackdriverTransport} from "@google-cloud/logging-winston";

import args from "./arguments.js";

import type {Middleware} from "express";
import type {NpmLogLevels, Format} from "winston";
import type {Info, Logger, LogLevel} from "./types.js";

/**
 * This is how the log message gets formatted.
 * We're adding the durationMs from the profiler commands in winston so
 * that we can read them :)
 */
const prodFormatter = ({message, durationMs}: Info): string =>
    `${message} ${(durationMs && `(${durationMs}ms)`) || ""}`;

/**
 * Our dev format adds the log level.
 */
const devFormatter = (info: Info): string =>
    `${info.level}: ${prodFormatter(info)}`;

function getFormatters(isDev) {
    const formatters: Array<Format> = [
        winston.format.splat(), // Allows for %s style substitutions
    ];

    formatters.push(winston.format.cli({level: isDev}));
    formatters.push(
        winston.format.printf((info: any) =>
            (isDev ? devFormatter : prodFormatter)(info),
        ),
    );

    return winston.format.combine(...formatters);
}

function getTransports(isDev) {
    const transports = [];
    if (!isDev) {
        transports.push(new StackdriverTransport());
    }

    if (process.env.NODE_ENV === "test") {
        // During testing, we just dump logging to a stream.
        // This isn't used for anything at all right now, but we could use
        // it for snapshot testing with some updates at some point.
        const sink = new stream.Writable({write: () => {}});
        // This is a hack to make our writable stream work $FlowFixMe
        sink._write = sink.write;
        transports.push(
            new winston.transports.Stream({
                format: getFormatters(isDev),
                stream: sink,
            }),
        );
    } else {
        transports.push(
            new winston.transports.Console({
                format: getFormatters(isDev),
            }),
        );
    }
    return transports;
}

type Loggers = {
    default: Logger,
    middleware: {
        requestLogger: Middleware,
        errorLogger: Middleware,
    },
};

function initLogging(logLevel: LogLevel, isDev: boolean): Loggers {
    // This is the logger that we use to log general information in our app.
    // Whereever one might use console, use this instead.
    const winstonLogger = winston.createLogger<NpmLogLevels>({
        level: logLevel,
        transports: getTransports(isDev),
    });

    // This is the logger that captures requests handled by our express server.
    const requestLogger = expressWinston.logger({
        /**
         * Specify the level that this logger logs at.
         * (use a function to dynamically change level based on req and res)
         *     `function(req, res) { return String; }`
         */
        level: "info",

        /**
         * Use the logger we already set up.
         */
        winstonInstance: winstonLogger,
        expressFormat: true,
        colorize: isDev,
        meta: false,
    });

    // This is the logger that captures errors in our express server.
    const errorLogger = expressWinston.errorLogger({
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
        winstonInstance: winstonLogger,
    });

    winstonLogger.debug(
        `Intialized logging with Level=${logLevel} DeveloperMode=${
            isDev ? "true" : "false"
        }`,
    );

    return {
        default: winstonLogger,
        middleware: {requestLogger, errorLogger},
    };
}

const loggers: Loggers = initLogging(args.logLevel, args.dev);

export const middleware = loggers.middleware;
export default loggers.default;

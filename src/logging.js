/**
 * Logging setup for our application.
 */
const stream = require("stream");
const expressWinston = require("express-winston");
const winston = require("winston");

const StackdriverTransport = require("@google-cloud/logging-winston")
    .LoggingWinston;
const args = require("./arguments.js");

/**
 * This is how the log message gets formatted.
 * We're adding the durationMs from the profiler commands in winston so
 * that we can read them :)
 */
const prodFormatter = ({message, durationMs}) =>
    `${message} ${(durationMs && `(${durationMs}ms)`) || ""}`;

/**
 * Our dev format adds the log level.
 */
const devFormatter = (info) => `${info.level}: ${prodFormatter(info)}`;

function getFormatters(json, isDev) {
    const formatters = [
        winston.format.splat(), // Allows for %s style substitutions
    ];

    if (json) {
        formatters.push(winston.format.json());
        if (isDev) {
            formatters.push(winston.format.prettyPrint({colorize: true}));
        }
    } else {
        formatters.push(winston.format.cli({all: isDev}));
        formatters.push(
            winston.format.printf(isDev ? devFormatter : prodFormatter),
        );
    }

    return winston.format.combine(...formatters);
}

function getTransports(json, isDev) {
    const transports = [];
    if (!isDev) {
        transports.push(new StackdriverTransport());
    }

    if (process.env.NODE_ENV === "test") {
        // During testing, we just dump logging to a stream.
        const sink = new stream.Writable({write: () => {}});
        sink._write = sink.write;
        transports.push(
            new winston.transports.Stream({
                format: getFormatters(json, isDev),
                stream: sink,
            }),
        );
    } else {
        transports.push(
            new winston.transports.Console({
                format: getFormatters(json, isDev),
            }),
        );
    }
    return transports;
}

function initLogging(logLevel, isDev) {
    // This is the logger that captures requests handled by our express server.
    const requestLogger = expressWinston.logger({
        level: logLevel,
        transports: getTransports(false, isDev),
        expressFormat: true,
        meta: false,
    });

    // This is the logger that captures errors in our express server.
    const errorLogger = expressWinston.errorLogger({
        level: logLevel,
        transports: getTransports(true, isDev),
    });

    // This is the logger that we use to log general information in our app.
    // Whereever one might use console, use this instead.
    const winstonLogger = winston.createLogger({
        level: logLevel,
        transports: getTransports(false, isDev),
    });

    winstonLogger.middleware = {
        requestLogger,
        errorLogger,
    };

    winstonLogger.debug(
        `Intialized logging with Level=${logLevel} DeveloperMode=${isDev}`,
    );

    return winstonLogger;
}

const logger = initLogging(args.log_level, args.dev);
module.exports = logger;

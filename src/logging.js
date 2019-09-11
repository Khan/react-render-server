/**
 * Logging setup for our application.
 */
const args = require("./arguments.js");
const expressWinston = require('express-winston');
const winston = require('winston');

const StackdriverTransport = (
    require('@google-cloud/logging-winston').LoggingWinston);

/**
 * This is how the log message gets formatted.
 * We're adding the durationMs from the profiler commands in winston so
 * that we can read them :)
 */
const prodFormatter = ({message, durationMs}) =>
    `${message} ${durationMs && `(${durationMs}ms)` || ""}`;

/**
 * Our dev format adds the log level.
 */
const devFormatter = info => `${info.level}: ${prodFormatter(info)}`;

function getFormatters(json, isDev) {
    const formatters = [
        winston.format.splat(), // Allows for %s style substitutions
    ];

    if (json) {
        formatters.push(winston.format.json());
        if (isDev) {
            formatters.push(winston.format.prettyPrint({colorize: true}))
        }
    } else {
        formatters.push(winston.format.cli({all: isDev}));
        formatters.push(winston.format.printf(
            isDev ? devFormatter : prodFormatter,
        ));
    }

    return winston.format.combine(...formatters);
}

function getTransports(json, isDev) {
    const transports = [];
    if (!isDev) {
        transports.push(new StackdriverTransport());
    }

    transports.push(new winston.transports.Console({
        format: getFormatters(json, isDev),
    }));
    return transports;
}

function initLogging(logLevel, isDev) {
    const requestLogger = expressWinston.logger({
        level: logLevel,
        transports: getTransports(false, isDev),
        expressFormat: true,
        meta: false,
    });
    const errorLogger = expressWinston.errorLogger({
        level: logLevel,
        transports: getTransports(true, isDev),
    });
    const winstonLogger = winston.createLogger({
        level: logLevel,
        transports: getTransports(false, isDev),
    });

    winstonLogger.middleware = {
        requestLogger,
        errorLogger,
    };

    winston.debug(`Intialized logging with Level=${logLevel} DeveloperMode=${isDev}`);

    return winstonLogger;
}

const logger = initLogging(args.log_level, args.dev);
module.exports = logger;

import * as Transport from 'winston-transport';

declare type express$Handler = (
    req: express$Request,
    res: express$Response,
    next: express$NextFunction
  ) => mixed;
declare type express$ErrorRequestHandler = (
    error: Error,
    req: express$Request,
    res: express$Response,
    next: express$NextFunction
) => mixed;

declare interface expresswinston$BaseLoggerOptions {
    expressFormat?: boolean,
    format?: Format,
    level?: string,
    meta?: boolean,
}

declare type expresswinston$LoggerOptionsWithTransports = {
    transports?: Array<Transport>,
    ...
} & expresswinston$BaseLoggerOptions


declare type expresswinston$LoggerOptions = expresswinston$LoggerOptionsWithTransports;

declare function expresswinston$logger(options: expresswinston$LoggerOptions): express$Handler

declare interface expresswinston$BaseErrorLoggerOptions {
    level?: string,
}

declare type expresswinston$ErrorLoggerOptionsWithTransports = {
    transports?: Array<Transport>,
    ...
} & expresswinston$BaseErrorLoggerOptions


declare type expresswinston$ErrorLoggerOptions = expresswinston$ErrorLoggerOptionsWithTransports;
declare function expresswinston$errorLogger(options: expresswinston$ErrorLoggerOptions): express$ErrorRequestHandler


declare module 'express-winston' {
    declare module.exports: {
        logger: typeof expresswinston$logger,
        errorLogger: typeof expresswinston$errorLogger
    };
}

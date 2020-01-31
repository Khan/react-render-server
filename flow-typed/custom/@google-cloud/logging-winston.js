declare type loggingwinston$Callback = (err: Error, apiResponse: {...}) => void;

declare interface loggingwinston$Options {
    // TODO: Fill this out
}

declare class loggingwinston$LoggingWinston extends $winstonTransport {
  constructor(options?: loggingwinston$Options): this;
  log(info: any, callback: loggingwinston$Callback): void;
}

declare interface loggingwinston$express {
    makeMiddleware(logger: $winstonLogger, transport: loggingwinston$LoggingWinston): Promise<express$Middleware>;
    makeMiddleware(logger: $winstonLogger, options?: loggingwinston$Options): Promise<express$Middleware>;
}


declare module '@google-cloud/logging-winston' {
    declare module.exports: {
        LoggingWinston: typeof loggingwinston$LoggingWinston,
        express: loggingwinston$express
    }
}


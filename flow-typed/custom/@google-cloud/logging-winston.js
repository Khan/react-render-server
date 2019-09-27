import {Transport} from "winston";

declare type loggingwinston$Callback = (err: Error, apiResponse: {...}) => void;

declare interface loggingwinston$Options {
    // TODO: Fill this out
}

declare class loggingwinston$LoggingWinston extends Transport {
  constructor(options?: loggingwinston$Options): this;
  log(info: any, callback: loggingwinston$Callback): void;
}


declare module '@google-cloud/logging-winston' {
    declare module.exports: {
        LoggingWinston: typeof loggingwinston$LoggingWinston
    }
}


// @flow
import type {
    NpmLogLevels,
    Logger as WinstonLogger,
    Info as WinstonInfo,
} from "winston";

export type Info = {
    ...WinstonInfo<NpmLogLevels>,
    durationMs: number,
    ...
};

export type LogLevel = $Keys<NpmLogLevels>;
export type Logger = WinstonLogger<NpmLogLevels>;

/* eslint-disable flowtype/no-dupe-keys */
export interface IProvideArguments {
    get port(): number;
    get dev(): boolean;
    get logLevel(): LogLevel;
}
/* eslint-enable flowtype/no-dupe-keys */

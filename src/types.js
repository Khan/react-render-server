// @flow
import type {Levels} from "winston";

export type LogLevel = $Keys<Levels>;

/* eslint-disable flowtype/no-dupe-keys */
export interface IProvideArguments {
    get port(): number;
    get dev(): boolean;
    get logLevel(): LogLevel;
}
/* eslint-enable flowtype/no-dupe-keys */

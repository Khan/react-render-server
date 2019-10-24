// @flow
import type {JSDOM} from "jsdom";

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

export type Globals = {
    +location: string,
    +[key: string]: mixed,
    ...
};

export type RenderBody = {
    +urls: Array<string>,
    +globals: Globals,
    +props: mixed,
    +secret: string,
};

export type JavaScriptPackage = {
    +content: string,
    +url: string,
};

export type RequestStats = {
    pendingRenderRequests: number,
    packageFetches: number,
    fromCache: number,
    vmContextSize: number,
    createdVmContext: boolean,
};

export interface RenderContext extends JSDOM {
    close: () => void;
    run: <TReturns>(
        fnOrText: (() => TReturns) | string,
        options?: vm$ScriptOptions,
    ) => TReturns;
}

export type RenderResult = {
    data?: any,
    requestStats?: RequestStats,
    ...
};

export type PackageJson = {
    version: string,
    description: string,
    ...
};

/* eslint-disable flowtype/no-dupe-keys */
/**
 * Disable no-dupe-keys here because the eslint rule appears to be incorrectly
 * interpreting this as `get(void)` being redefined.
 * See https://github.com/gajus/eslint-plugin-flowtype/issues/431
 */
export interface IProvideArguments {
    get port(): number;
    get dev(): boolean;
    get logLevel(): LogLevel;
    get useCache(): boolean;
}
/* eslint-enable flowtype/no-dupe-keys */

// @flow
import * as ApolloClient from "apollo-client";

import type {JSDOM} from "jsdom";
import type {ApolloCache} from "apollo-client";
import type {ApolloLink} from "apollo-link-http";

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

type ApolloNetworkConfiguration = {
    timeout?: number,
    url?: string,
    headers?: any,
};

export interface RenderContext extends JSDOM {
    close: () => void;
    run: (fnOrText: Function | string, options?: vm$ScriptOptions) => mixed;

    ApolloClient?: typeof ApolloClient;
    ApolloNetworkLink?: ApolloLink;
    ApolloCache?: ApolloCache<mixed>;
    ApolloNetwork?: ApolloNetworkConfiguration;
}

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
}
/* eslint-enable flowtype/no-dupe-keys */

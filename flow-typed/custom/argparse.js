// flow-typed signature: 7e5c18bf3f1536f28836db5f0f0b8821
// flow-typed version: <<STUB>>/argparse_v1.0.10/flow_v0.108.0

declare class argparse$ArgumentParser mixins argparse$ArgumentGroup {
    constructor(options?: argparse$ArgumentParserOptions): this;
    addSubparsers(options?: argparse$SubparserOptions): argparse$SubParser;
    parseArgs<TArgs>(args?: string[], ns?: argparse$Namespace | {[key: string]: mixed}): TArgs;
    printUsage(): void;
    printHelp(): void;
    formatUsage(): string;
    formatHelp(): string;
    parseKnownArgs(args?: string[], ns?: argparse$Namespace | {[key: string]: mixed}): any[];
    convertArgLineToArg(argLine: string): string[];
    exit(status: number, message: string): void;
    error(err: string | Error): void;
}

declare class argparse$Namespace {
    constructor(options: {[key: string]: any}): this;
    get<K: $Keys<this>, D: any>(key: K, defaultValue?: D): $ElementType<this, K> | D;
    isset(key: $Keys<this>): boolean;
    set<K: $Keys<this>>(key: K, value: $ElementType<this, K>): this;
    set<K: string, V: any>(key: K, value: V): this & {[key: K]: V, ...};
    set<K: {[key: string]: any}>(obj: K): this & K;
    unset<K: $Keys<this>, D: any>(key: K, defaultValue?: D): $ElementType<this, K> | D;
}

declare class argparse$SubParser {
    addParser(name: string, options?: argparse$SubArgumentParserOptions): argparse$ArgumentParser;
}

declare class argparse$ArgumentGroup {
    addArgument(args: string[] | string, options?: argparse$ArgumentOptions): void;
    addArgumentGroup(options?: argparse$ArgumentGroupOptions): argparse$ArgumentGroup;
    addMutuallyExclusiveGroup(options?: {required: boolean,...}): argparse$ArgumentGroup;
    setDefaults(options?: {...}): void;
    getDefault(dest: string): any;
}

declare type argparse$SubparserOptions = {
    title?: string,
    description?: string,
    prog?: string,
    parserClass?: {
        new (): any,...
    },
    action?: string,
    dest?: string,
    help?: string,
    metavar?: string,
}

declare type argparse$SubArgumentParserOptions = {
    aliases?: string[],
    help?: string,
    ...
} & argparse$ArgumentParserOptions;

declare type argparse$ArgumentParserOptions = {
    description?: string,
    epilog?: string,
    addHelp?: boolean,
    argumentDefault?: any,
    parents?: argparse$ArgumentParser[],
    prefixChars?: string,
    formatterClass?: {
        new (): argparse$HelpFormatter | argparse$ArgumentDefaultsHelpFormatter | argparse$RawDescriptionHelpFormatter | argparse$RawTextHelpFormatter,
        ...
    },
    prog?: string,
    usage?: string,
    version?: string,
    debug?: boolean,
}

declare type argparse$ArgumentGroupOptions = {
    prefixChars?: string,
    argumentDefault?: any,
    title?: string,
    description?: string,
}

declare class argparse$Action  {
    dest: string;
    constructor(options: argparse$ActionConstructorOptions): this;
    call(
        parser: ArgumentParser,
        namespace: Namespace,
        values: string | string[],
        optionString: string | null,
    ): void;
}

declare type argparse$ActionConstructorOptions = number & {
    _: "ActionConstructorOptions",
    ...
};

declare class argparse$HelpFormatter  {}
declare class argparse$ArgumentDefaultsHelpFormatter {}
declare class argparse$RawDescriptionHelpFormatter  {}
declare class argparse$RawTextHelpFormatter  {}
declare type argparse$ArgumentOptions = {
    action?: string | {
        new (options: argparse$ActionConstructorOptions): Action,
        ...
    },
    optionStrings?: string[],
    dest?: string,
    nargs?: string | number,
    constant?: any,
    defaultValue?: any,
    type?: string | Function,
    choices?: string | string[],
    required?: boolean,
    help?: string,
    metavar?: string,
}

declare type argparse$Const = {
    +EOL: string,
    +SUPPRESS: string,
    +OPTIONAL: string,
    +ZERO_OR_MORE: string,
    +ONE_OR_MORE: string,
    +PARSER: string,
    +REMAINDER: string,
    +_UNRECOGNIZED_ARGS_ATTR: string
};

declare module 'argparse' {
    declare export type SubParser = argparse$SubParse;
    declare export type SubparserOptions = argparse$SubparserOptions;
    declare export type SubArgumentParserOptions = argparse$SubArgumentParserOptions;
    declare export type ArgumentParserOptions = argparse$ArgumentParserOptions;
    declare export type ArgumentGroup = argparse$ArgumentGroup;
    declare export type ArgumentGroupOptions = argparse$ArgumentGroupOptions;
    declare export type ArgumentOptions = argparse$ArgumentOptions;
    declare export type ActionConstructorOptions = argparse$ActionConstructorOptions;

    declare module.exports: {
        ArgumentParser: typeof argparse$ArgumentParser,
        Namespace: typeof argparse$Namespace,
        Action: typeof argparse$Action,
        HelpFormatter: typeof argparse$HelpFormatter,
        Const: argparse$Const,

        ArgumentDefaultsHelpFormatter: typeof argparse$ArgumentDefaultsHelpFormatter,
        RawDescriptionHelpFormatter: typeof argparse$RawDescriptionHelpFormatter,
        RawTextHelpFormatter: typeof argparse$RawTextHelpFormatter
    };
}

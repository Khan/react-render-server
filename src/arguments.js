// @flow
/**
 * Parse the arguments for our application.
 */
import argparse from "argparse";

import packageInfo from "../package.json";

import type {LogLevel, PackageJson, IProvideArguments} from "./types.js";

type RawParsedArgs = {
    log_level: LogLevel,
    dev: boolean,
    port: number,
    use_cache: boolean,
};

const packageInfoJson: PackageJson = packageInfo;

const parser = new argparse.ArgumentParser({
    version: packageInfoJson.version,
    addHelp: true,
    description: packageInfoJson.description,
});
parser.addArgument(["-p", "--port"], {
    type: "int",
    defaultValue: 8060,
    help: "Port to run on.",
});
parser.addArgument(["--dev"], {
    action: "storeTrue",
    help: "Set if running on dev; controls caching/etc.",
});
parser.addArgument(["--log-level"], {
    defaultValue: "info",
    choices: ["silly", "debug", "verbose", "info", "warn", "error"],
    help: "What level to log at.",
});
parser.addArgument(["--use-cache"], {
    action: "storeTrue",
    help:
        "Force caching of JS files on. Only has an effect when combined with --dev as caching is always on for non-dev runs.",
});

// We only want to parse the args if we're running inside our main app.
// Could be src/main.js or dist/main.js.
const args: RawParsedArgs = process.argv[1].endsWith("/main.js")
    ? parser.parseArgs<RawParsedArgs>()
    : {
          // Some defaults for tests and the like.
          log_level: "debug",
          dev: true,
          port: 42,
          use_cache: false,
      };

/**
 * Wrapper class with accessors that can be overridden in testing.
 */
class ArgumentProvider implements IProvideArguments {
    _args: RawParsedArgs;

    constructor(args: RawParsedArgs) {
        this._args = args;
    }

    get port(): number {
        return this._args.port;
    }

    get logLevel(): LogLevel {
        return this._args.log_level;
    }

    get dev(): boolean {
        return this._args.dev;
    }

    get useCache(): boolean {
        return this._args.use_cache || !this.dev;
    }

    toString() {
        return JSON.stringify(
            {
                port: this.port,
                logLevel: this.logLevel,
                dev: this.dev,
                useCache: this.useCache,
            },
            null,
            "    ",
        );
    }
}

export default new ArgumentProvider(args);

// @flow
/**
 * Parse the arguments for our application.
 */
import argparse from "argparse";

import packageInfo from "../package.json";

import type {LogLevel, IProvideArguments} from "./types.js";

const parser = new argparse.ArgumentParser({
    version: packageInfo.version,
    addHelp: true,
    description: packageInfo.description,
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

// We only want to parse the args if we're running inside our main app.
// Could be src/main.js or dist/main.js.
const args = process.argv[1].endsWith("/main.js")
    ? parser.parseArgs()
    : {
          // Some defaults for tests and the like.
          log_level: "debug",
          dev: true,
          port: 42,
      };

/**
 * Wrapper class with accessors that can be overridden in testing.
 */
class ArgumentProvider implements IProvideArguments {
    _args: any;

    constructor(args: any) {
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
}

export default new ArgumentProvider(args);

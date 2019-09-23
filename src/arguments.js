// @flow
/**
 * Parse the arguments for our application.
 */
import argparse from "argparse";

import packageInfo from "../package.json";

import type {Arguments} from "./types.js";

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
const args: Arguments = process.argv[1].endsWith("/main.js")
    ? parser.parseArgs()
    : {
          // Some defaults for tests and the like.
          log_level: "debug",
          dev: true,
          port: 42,
      };

export default args;

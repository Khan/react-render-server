/**
 * Parse the arguments for our application.
 */
const argparse = require("argparse");

const packageInfo = require("../package.json");

const parser = new argparse.ArgumentParser({
    version: packageInfo.version,
    addHelp: true,
    description: packageInfo.description,
});
parser.addArgument(
    ['-p', '--port'],
    {
        type: 'int',
        defaultValue: 8060,
        help: "Port to run on.",
    });
parser.addArgument(
    ['--dev'],
    {
        action: 'storeTrue',
        help: "Set if running on dev; controls caching/etc.",
    });
parser.addArgument(
    ['--render-timeout'],
    {
        type: 'int',
        defaultValue: 1000,
        help: "How many ms until we abort a render as taking too long.",
    });
parser.addArgument(
    ['--log-level'],
    {
        defaultValue: 'info',
        choices: ['silly', 'debug', 'verbose', 'info', 'warn', 'error'],
        help: "What level to log at.",
    });

// We only want to parse the args if we're running inside our main app.
const args = process.argv[1].endsWith("/src/main.js")
    ? parser.parseArgs()
    : {
        // Some defaults for tests and the like.
        log_level: "debug",
        dev: true,
    };

module.exports = args;

// @flow
/**
 * A simple module for exposing the secret for /render calls.
 *
 * /render will execute arbitrary javascript that you tell it to.  So
 * for security, we require you to know a shared secret in order to
 * call /render.  This file exposes the secret as known by the server.
 *
 * This is in its own module to allow for mocking in tests.  That's
 * also one reason we have this weird matches() indirection.
 */

"use strict";

import fs from "fs";
import path from "path";

import args from "./arguments.js";
import logging from "./logging.js";

const secretPath: string = path.normalize(__dirname + "/../secret");
let secret: string;

// Exported for use by the benchmark/loadtest tool.
export const get = function(done: (?Error, ?string) => void): void {
    if (secret) {
        done(null, secret);
        return;
    }

    fs.readFile(secretPath, "utf-8", (err: ?Error, contents: string): void => {
        if (err) {
            logging.error(
                `FATAL ERROR (${err.message}): You must create a file:`,
            );
            logging.error("    " + secretPath);
            logging.error("Its contents should be the secret-string at");
            logging.error("    https://phabricator.khanacademy.org/K121");
            done(err);
            return;
        }

        secret = contents.trim();
        if (!secret) {
            done(new Error("secret file is empty!"));
            return;
        }

        done(null, secret);
        return;
    });
};

export const matches = function(
    actualSecret: string,
    done: (?Error, ?boolean) => void,
): void {
    if (args.dev) {
        // Disable the need for secrets.
        done(null, true);
        return;
    }

    return get((err: ?Error, secret: ?string): void => {
        if (err) {
            done(err);
            return;
        }

        done(null, secret === actualSecret);
        return;
    });
};

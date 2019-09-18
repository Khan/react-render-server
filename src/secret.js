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

const fs = require("fs");
const path = require("path");

const logging = require("./logging.js");

const secretPath = path.normalize(__dirname + "/../secret");
let secret;

// Used by the benchmark/loadtest tool.
const get = function(done) {
    if (secret) {
        return done(null, secret);
    }

    fs.readFile(secretPath, "utf-8", (err, contents) => {
        if (err) {
            logging.error(`FATAL ERROR (${err}): You must create a file:`);
            logging.error("    " + secretPath);
            logging.error("Its contents should be the secret-string at");
            logging.error("    https://phabricator.khanacademy.org/K121");
            return done(err);
        }

        secret = contents.trim();
        if (!secret) {
            return done(new Error("secret file is empty!"));
        }

        return done(null, secret);
    });
};

const matches = function(actual, done) {
    return get((err, secret) => {
        if (err) {
            return done(err);
        }

        return done(null, secret === actual);
    });
};

// get is only used by the benchmarking/loadtest tool.
module.exports = {matches: matches, get: get};

/**
 * A simple module for sending stats to hostedgraphite.
 *
 * We need a secret to talk to hostedgraphite.  This isn't considered
 * core functionality, so the server will still work without the
 * secret, but we print a big warning.
 *
 */

'use strict';

const fs = require("fs");
const path = require("path");

const graphite = require("graphite-udp");
const logging = require("winston");


const secretPath = path.normalize(__dirname + "/../hostedgraphite.api_key");
let secret;


const graphiteSecret = function() {
    if (!secret) {
        try {
            secret = fs.readFileSync(secretPath, "utf-8").trim();
            if (!secret) {     // empty file?
                throw new Error('secret file is empty!');
            }
        } catch (err) {
            logging.warn(`NOT LOGGING TO GRAPHITE: ${err}.`);
            logging.warn('To log to hostedgraphite, create a file:');
            logging.warn('    ' + secretPath);
            logging.warn('Its contents should be hostedgraphite_api_key ' +
                         'from webapp:secrets.py');
        }
    }
    return secret;
};


const graphiteClient = graphiteSecret() ? graphite.createClient({
    host: 'carbon.hostedgraphite.com',
    prefix: graphiteSecret(),
}) : null;


const log = function(key, value) {
    if (graphiteClient) {
        graphiteClient.add(key, value);
    }
};


module.exports = { log: log };

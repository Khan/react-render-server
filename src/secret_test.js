'use strict';
/* global describe, it, before, beforeEach, afterEach, after */

const fs = require("fs");

const assert = require("chai").assert;
const sinon = require("sinon");
const renderSecret = require("./secret.js");

describe('secret', () => {
    beforeEach(() => {
      sinon.stub(fs, 'readFile', (filePath, encoding, callback) => {
        return callback(null, "sekret");
      });
    });

    afterEach(() => {
        fs.readFile.restore();
    });


    it ("can handle missing secret file", (done) => {
      fs.readFile.restore();
      sinon.stub(fs, 'readFile', (filePath, encoding, callback) => {
        return callback(new Error("File not found"));
      });

      renderSecret.matches("sekret", (err, valueMatches) => {
        assert.equal(err.message, "File not found");
        done();
      });
    });

    it ("can handle empty secret file", (done) => {
      fs.readFile.restore();
      sinon.stub(fs, 'readFile', (filePath, encoding, callback) => {
        return callback(null, "");
      });

      renderSecret.matches("sekret", (err, valueMatches) => {
        assert.equal(err.message, "secret file is empty!");
        done();
      });
    });

    it ("can match secret to actual value", (done) => {
      renderSecret.matches("sekret", (err, valueMatches) => {
        assert.equal(valueMatches, true, "Should match secret value ");
        done();
      });
    });

    it ("can match cached secret to actual value", (done) => {
      // On the second run through, the fs.readFile function should not be called.
      fs.readFile.restore();
      sinon.stub(fs, 'readFile', (filePath, encoding, callback) => {
        return callback(new Error("Should not be called"));
      });

      renderSecret.matches("sekret", (err, valueMatches) => {
        assert.equal(valueMatches, true, "Should match secret value ");
        done();
      });
    });
});

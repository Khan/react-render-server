// @flow
"use strict";

import fs from "fs";
import {promisify} from "util";

import {assert} from "chai";
import sinon from "sinon";
import args from "./arguments.js";
import * as renderSecret from "./secret.js";

const matches = promisify(renderSecret.matches);

describe("secret", () => {
    afterEach(() => {
        sinon.restore();
    });

    it("can handle missing secret file", async () => {
        // Arrange
        sinon
            .stub(fs, "readFile")
            .callsFake((filePath, encoding, callback) =>
                callback(new Error("File not found")),
            );
        sinon.stub(args, "dev").get(() => false);

        // Act
        const promise = matches("sekret");

        // Assert
        await assert.isRejected(promise, "File not found");
    });

    it("can handle empty secret file", async () => {
        // Arrange
        sinon
            .stub(fs, "readFile")
            .callsFake((filePath, encoding, callback) => callback(null, ""));
        sinon.stub(args, "dev").get(() => false);

        // Act
        const promise = matches("sekret");

        // Assert
        await assert.isRejected(promise, "secret file is empty!");
    });

    it("can match secret to actual value", (done) => {
        sinon
            .stub(fs, "readFile")
            .callsFake((filePath, encoding, callback) =>
                callback(null, "sekret"),
            );
        renderSecret.matches("sekret", (err, valueMatches) => {
            assert.equal(valueMatches, true, "Should match secret value ");
            done();
        });
    });

    it("can match cached secret to actual value", (done) => {
        // On the second run through, the fs.readFile function should not be called.
        sinon
            .stub(fs, "readFile")
            .callsFake((filePath, encoding, callback) =>
                callback(new Error("Should not be called")),
            );

        renderSecret.matches("sekret", (err, valueMatches) => {
            assert.equal(valueMatches, true, "Should match secret value ");
            done();
        });
    });
});

// @flow
import {getRequestID} from "./get-request-id.js";
import {assert} from "chai";
import sinon from "sinon";

import type {$Request} from "express";

describe("#getRequestID", () => {
    it("should return null when header is absent", () => {
        // Arrange
        const request: $Request = ({
            header: sinon.stub().withArgs("X-Appengine-Request-Log-Id"),
        }: any);

        // Act
        const result = getRequestID(request);

        // Assert
        assert.isNull(result);
    });

    it("should return the requestID when it does not end with 000101xx", () => {
        // Arrange
        const request: $Request = ({
            header: sinon
                .stub()
                .withArgs("X-Appengine-Request-Log-Id")
                .returns("this-is-a-good-request-id"),
        }: any);

        // Act
        const result = getRequestID(request);

        // Assert
        assert.equal(result, "this-is-a-good-request-id");
    });

    it("should return a fixed requestID when it does end with 000101xx", () => {
        // Arrange
        const request: $Request = ({
            header: sinon
                .stub()
                .withArgs("X-Appengine-Request-Log-Id")
                .returns("this-is-a-bad-request-id-000101BD"),
        }: any);

        // Act
        const result = getRequestID(request);

        // Assert
        assert.equal(result, "this-is-a-bad-request-id-000100");
    });
});

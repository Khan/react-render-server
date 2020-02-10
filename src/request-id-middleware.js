// @flow
import {getRequestID} from "./get-request-id.js";
import type {$Response, $Request, NextFunction} from "express";

export const requestIDMiddleware = (
    req: $Request,
    res: $Response,
    next: NextFunction,
): void => {
    /**
     * NOTE: the $Request type doesn't have a log field, officially.
     * However, we know that the Google middleware adds it.
     * $FlowIgnore
     */
    if (req.log == null) {
        // The Google middleware must not be in use. Let's just skip on.
        next();
        return;
    }

    const requestID = getRequestID(req);
    if (requestID == null) {
        // We couldn't get the GAE request ID, so let's skip on.
        next();
        return;
    }

    /**
     * We have a requestID and we know req.log exists, so let's replace
     * req.log with a derived child logger that adds the requestID metadata.
     *
     * NOTE: the $Request type doesn't have a log field, officially.
     * However, we know that the Google middleware adds it.
     * $FlowIgnore
     */
    req.log = req.log.child({requestID});
    next();
};

// @flow
import type {$Request} from "express";

/**
 * Get the GAE requestID for a given request if it exists.
 */
export const getRequestID = (req: $Request): ?string => {
    const requestID = req.header("X-Appengine-Request-Log-Id");
    if (requestID == null) {
        return null;
    }

    /**
     * Per https://github.com/Khan/webapp/blob/57b38a92b5ac8ca912252aa41f3e37e6a9e486fa/web/request/request_id.py#L27-L55
     * the requestID could be incorrect. Though it's likely that Google fixed
     * this by now, let's keep the hack as it is harmless and will address the
     * issue if it remains.
     *
     * The "bad" suffixes are all of the form 000101xx and need to be changed to
     * 000100.
     */
    const suffixIndex = requestID.length - 8;
    const maybeBadSuffix = requestID.substring(suffixIndex);

    if (maybeBadSuffix.startsWith("000101")) {
        return requestID.substring(0, suffixIndex) + "000100";
    }
    return requestID;
};

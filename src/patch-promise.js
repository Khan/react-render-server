// @flow
/**
 * We use JSDOM for lots of things right now. When we close the JSDOM context
 * it tries to abort any outstanding fetches. It assumes these all have an
 * `abort` function, but that isn't the case if they are regular promises.
 *
 * We tried to mitigate this within our custom resource loader but it is not
 * working, so let's go right down to the base of the problem and patch
 * the promise prototype.
 */
export const applyAbortPatch = () => {
    /**
     * We know that this doesn't exist on the promise type.
     * But we're getting rid of it if it does and it is not ours.
     * Other things can replace it if they so choose.
     * $FlowIgnore
     */
    if (Promise.prototype.abort && !Promise.prototype.abort.__rrs_patched__) {
        // $FlowIgnore
        delete Promise.prototype.abort;
    }

    /**
     * Make a noop and tag it as our patched version.
     */
    const ourAbort = () => {};
    ourAbort.__rrs_patched__ = true;

    /**
     * We still know that this doesn't exist on the promise type.
     * $FlowIgnore
     */
    Promise.prototype.abort = ourAbort;
};

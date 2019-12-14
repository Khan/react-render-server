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
const applyAbortPatch = () => {
    /**
     * We know that this doesn't exist on the promise type.
     * But we're getting rid of it if it does. Other things can replace
     * it if they so choose.
     * $FlowIgnore
     */
    if (Promise.prototype.abort) {
        delete Promise.prototype.abort;
    }

    /**
     * We still know that this doesn't exist on the promise type.
     * $FlowIgnore
     */
    Promise.prototype.abort = () => {};
};

/**
 * Don't usually like side-effects in imports, but this enables us to import
 * this in the files we want and know it just works which is useful for
 * ensuring the tests will work without explicit knowledge of the need for this
 * patch.
 */
applyAbortPatch();

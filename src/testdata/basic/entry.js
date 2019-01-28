/**
 * This is a simple test file that conforms to the server expectations but
 * doesn't require the overhead of react and things. It just fulfills the
 * contract for tests that don't need Apollo.
 */

// Our element is just a string with the props stringified.
// When we render, we add HTML: and CSS: to the front of the props.
// This provides an easily verified, repeatable result.
const renderElement = async (props) => Promise.resolve({
    html: `HTML: ${JSON.stringify(props)}`,
    css: `CSS: ${JSON.stringify(props)}`
});

__registerForSSR__(renderElement);

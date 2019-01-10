/**
 * This is a simple test file that conforms to the server expectations but
 * doesn't require the overhead of react and things. It just fulfills the
 * contract for tests that don't need Apollo.
 */
const renderElement = async props => Promise.resolve({
    html: `HTML: ${Object.keys(props).includes(props.keyName)}`,
    css: `CSS: ${Object.keys(props).includes(props.keyName)}`
});

__registerForSSR__(renderElement);

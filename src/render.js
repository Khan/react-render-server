/**
 * The core functionality of actually rendering a react component.
 *
 * This uses 'vm' to execute the javascript holding the react
 * component, and jsdom (plus a few other things) to provide the
 * necessary context for rendering it.
 */

'use strict';

const vm = require("vm");

const ReactDOMServer = require('react-dom/server');
const getOrCreateRenderContext = require('./get-or-create-render-context.js');
const configureApolloNetwork = require('./configure-apollo-network.js');

const profile = require("./profile.js");

// render takes a cacheBehavior property, which is one of these:
//    'yes': try to retrieve the object from the cache
//    'no': do not try to retrieve the object from the cache (but
//          still store it in the cache after retrieving it).
//    'ignore': do not try to retrieve the object from the cache,
//          nor try to store it in the cache.
// This variable controls the cache behavior that is used if the
// user does not pass in a value for cacheBehavior for render().
let defaultCacheBehavior;

const resetGlobals = function() {
    defaultCacheBehavior = 'yes';
};

resetGlobals();


const runInContext = function(context, fn) {
    return vm.runInContext("(" + fn.toString() + ")()", context);
};


/**
 * Actually render a React component.
 *
 * @param {string[][]} jsPackages - A list of [filename, source code]
 *     pairs for js packages that we need to include in order to render the
 *     given component.  These files are executed in the order specified.
 * @param {string} pathToReactComponent - What to require() in order
 *     to render the react component.
 * @param {object} props - the props object to pass in to the react
 *     renderer; the props used to render the React component.
 * @param {object} globals - the map of global variable name to their values to
 *     be set before the React component is require()'d.
 * @param {string} cacheBehaviour - One of 'yes', 'no', or 'ignore'. Used to
 *     determine caching behaviour. See comment on defaultCacheBehaviour.
 * @param {object} requestStats -- If defined, should be a dict. Used to
 *     store stats about the current request.  In this case, we set
 *     requestStats.createdVmContext based on whether we had to create a
 *     new vm context or could get an existing one from the cache.

 * @returns an object like follows:
 *   {
 *       "html": "<a href='http://www.google.com' class='link141'>Google</a>",
 *       "css": {
 *           content: ".link141{backgroundColor:transparent;}",
 *           renderedClassNames: ["link141"]
 *       }
 *   }
 *
 * html is the rendered html of the React component.
 * css will only be returned if the component makes use of Aphrodite
 * (https://github.com/Khan/aphrodite).
 */
const render = function(jsPackages, pathToReactComponent, props,
                        globals, cacheBehavior, requestStats) {
    const context = getOrCreateRenderContext(
        jsPackages,
        pathToReactComponent,
        cacheBehavior || defaultCacheBehavior,
        requestStats);

    context.reactProps = props;

    const renderProfile = profile.start("rendering " +
        pathToReactComponent);

    if (globals) {
        Object.keys(globals).forEach(key => {
            // Location is a special case.
            if (key === 'location') {
                context.location.replace(globals[key]);
            } else {
                context[key] = globals[key];
            }
        });
    }

    if (context.ApolloNetwork) {
        configureApolloNetwork(context);
    }

    // getVMContext sets up the sandbox to have React installed, as
    // well as everything else needed to load the React component, so
    // our work here is easy.
    return runInContext(context, () => {
        return new Promise((resolve, reject) => {
            // NOTE(jeresig): We should be using `let` here but the current
            // version of the Node.js runtime we use in production doesn't
            // understand `let` inside runInContext (known bug).
            var Component = KAdefine.require(global.pathToReactComponent); // eslint-disable-line no-var

            // The Component could have been exported using `export default`
            // We check for that case and use that component here.
            if (Component.default) {
                Component = Component.default;
            }

            // Make a deep clone of the props in the context before rendering
            // them, so that any polyfills we have in the context (like
            // Array.prototype.includes) are applied to the elements of
            // the props.
            const clonedProps = JSON.parse(JSON.stringify(global.reactProps));

            const reactElement = React.createElement(Component, clonedProps);

            // Render a React element and sent the string back to the main
            // Node.js process. The object will have an 'html' property (from
            // the React element), a 'css' property (from Aphrodite), and
            // possibly a 'data' property (from Apollo, if it exists).

            const renderElement = (element, data) => {
                const result = global.StyleSheetServer.renderStatic(() =>
                    ReactDOMServer.renderToString(element));

                if (data) {
                    result.data = data;
                }

                resolve(result);
            };

            // For React elements that have no Apollo-centric logic, we just
            // render them as normal.
            if (!global.ApolloNetworkLink) {
                return renderElement(reactElement);
            }

            // If network details were provided for Apollo then we go about
            // wrapping the element in an Apollo provider (which will collect
            // the data requirements of the child components and send off a
            // network request to a GraphQL endpoint).

            // Build an Apollo client. This is responsible for making the
            // network requests to the GraphQL endpoint and bringing back
            // the data.
            const client = new global.ApolloClient.ApolloClient({
                ssrMode: true,
                link: global.ApolloNetworkLink,
                cache: global.ApolloCache,
            });

            // We wrap the React element with an Apollo Provider (which
            // takes a React element and a client)
            const wrappedElement = React.createElement(
                global.ReactApollo.ApolloProvider,
                {
                    children: reactElement,
                    client: client,
                }
            );

            // From the Apollo Provider and the wrapped React element we
            // use React Apollo to traverse through the full React element
            // tree to find all the GraphQL data requirements that've been
            // specified by the components. These requirements are pulled
            // together and sent to the serve as a single request.
            global.ReactApollo.getDataFromTree(wrappedElement)
                .then(() => {
                    // All of the data comes back as a single object which
                    // we can then pass back to the client to be rendered
                    // directly into the page (for the re-hydration).
                    const initialState = client.extract();

                    renderElement(wrappedElement, initialState);
                }).catch((err) => reject(err));
        });
    }).then((data) => {
        renderProfile.end();
        // If we passed in request-stats, we've modified them in this
        // function (to update the stats).  Pass back the updated
        // stats as part of our response object.
        if (requestStats) {
            data.requestStats = requestStats;
        }
        return data;
    }).catch((err) => {
        renderProfile.end();
        return Promise.reject(err);
    });
};

render.setDefaultCacheBehavior = function(cacheBehavior) {
    defaultCacheBehavior = cacheBehavior;
};

// Used by tests.
render.resetGlobals = resetGlobals;

module.exports = render;

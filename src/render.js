/**
 * The core functionality of actually rendering a react component.
 *
 * This uses 'vm' to execute the javascript holding the react
 * component, and jsdom (plus a few other things) to provide the
 * necessary context for rendering it.
 */

'use strict';

const vm = require("vm");

// TODO(csilvers): try to get rid of the dependency on jsdom
const jsdom = require("jsdom");
const ReactDOMServer = require('react-dom/server');
const ApolloClient = require("apollo-client");
const ReactApollo = require("react-apollo");
const {InMemoryCache} = require("apollo-cache-inmemory");
const {createHttpLink} = require("apollo-link-http");
const fetch = require('node-fetch');

const cache = require("./cache.js");
const profile = require("./profile.js");

const BAD_URL = "BAD_URL";

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
 * Retrieve a vm context object that's been preloaded by having all of
 * the jsPackages executed and the react environment initialized.
 * If requestStats is non-empty, set requestStats.createdVmContext to
 * whether we got the context from the cache or not.
 */
const getVMContext = function(jsPackages, pathToReactComponent,
                              cacheBehavior, requestStats) {
    if (cacheBehavior == null) {
        cacheBehavior = defaultCacheBehavior;
    }

    // (We expect props to vary between requests for the same
    // component, so we don't make the props part of the cache key.)
    const cacheKey = (jsPackages.map(pkg => pkg[0]).join(",") +
                      ":" + pathToReactComponent);

    if (cacheBehavior === 'yes') {
        const cachedValue = cache.get(cacheKey);
        if (cachedValue) {
            if (requestStats) {
                requestStats.createdVmContext = false;
            }
            return cachedValue;
        }
    }

    const vmConstructionProfile = profile.start("building VM for " +
                                                pathToReactComponent);

    const sandbox = {};

    // A minimal document, for parts of our code that assume there's a DOM.
    const doc = jsdom.jsdom(
        "<!DOCTYPE html><html><head></head><body></body></html>", {
            // Forward console logs from inside the VM to the real console
            virtualConsole: jsdom.createVirtualConsole().sendTo(console),
            // CKEditor, and maybe other things, check for
            // location.href, and expect it to be non-empty.
            url:  "http://www.khanacademy.org",
            features: {
                FetchExternalResources: false,
                ProcessExternalResources: false,
            },
        });

    // Copy everything from the jsdom object onto the sandbox.
    // TODO(jlfwong): For some reason, copying doc.defaultView works, but
    // using it directly as an arg to vm.createContext doesn't.
    Object.keys(doc.defaultView).forEach(function(key) {
        sandbox[key] = doc.defaultView[key];
    });
    sandbox.window = sandbox;
    sandbox.global = sandbox;
    sandbox.self = sandbox;
    sandbox.ReactDOMServer = ReactDOMServer;

    // Used by javascript/reports-package/reports-shared.jsx on boot in
    // isExerciseMapFresh().
    sandbox.localStorage = {};

    // This makes sure that qTip2 doesn't try to use the canvas.
    sandbox.HTMLCanvasElement.prototype.getContext = undefined;

    let cumulativePackageSize = 0;

    const context = vm.createContext(sandbox);

    jsPackages.forEach((pkg) => {
        vm.runInContext(pkg[1], context);   // pkg is [url path, contents]
        cumulativePackageSize += pkg[1].length;
    });

    context.pathToReactComponent = pathToReactComponent;
    runInContext(context, () => {
        // Get stuff out of the context and into local vars.
        const ReactDOMServer = global.ReactDOMServer;

        const React = KAdefine.require("react");

        // Verify we have the right version of react.  ReactDOMServer
        // holds the react version that we've installed here, for this
        // server, while React holds the react version that is
        // provided via the input js packages -- that is, the version
        // on webapp.  If they don't match, throw an exception.
        if (React.version !== ReactDOMServer.version) {
            throw new Error(`Server should be using React version ` +
                            `${React.version}, but is using React ` +
                            `version ${ReactDOMServer.version}`);
        }

        try {
            global.StyleSheetServer = KAdefine.require("aphrodite").StyleSheetServer;

            // Make sure we're using a new enough version of Aphrodite
            global.StyleSheetServer.renderStatic;
        } catch (e) {
            // If we're here, it should mean that the component being rendered
            // does not depend on Aphrodite. We'll make a stub instead to make
            // the code below simpler.
            global.StyleSheetServer = {
                renderStatic: (cb) => {
                    return {
                        html: cb(),
                        css: {
                            content: "",
                            renderedClassNames: [],
                        },
                    };
                },
            };
        }
    });

    if (cacheBehavior !== 'ignore') {
        // As a rough heuristic, we say that the size of the context is double
        // the size of the JS source files.
        const cachedSize = jsPackages.reduce((sum, pkg) => sum + pkg[0].length,
                                             0) * 2;
        cache.set(cacheKey, context, cachedSize);
    }

    vmConstructionProfile.end();

    if (requestStats) {
        requestStats.createdVmContext = true;
        requestStats.vmContextSize = cumulativePackageSize;
    }

    return context;
};

// If Apollo network settings were provided then we need to expose some
// important objects to the vm context. ApolloNetwork should have two
// properties: 'url' (for the URL of the GraphQL endpoint) and 'headers'
// for a key-value map of headers to send to the GraphQL endpoint. This
// can include things such as cookies and xsrf tokens.
// Requests will automatically timeout after 1000ms, unless another
// timeout is provided via a 'timeout' property.
const handleApolloNetwork = function(context) {
    const handleNetworkFetch = (url, params) => {
        if (!url || url === BAD_URL) {
            return Promise.reject(
                new Error("ApolloNetwork must have a valid url."));
        }
        return new Promise((resolve, reject) => {
            let complete = false;

            fetch(url, params)
            .then(result => {
                // Ignore requests that've already been aborted
                // (this should never happen)
                if (complete) {
                    return;
                }

                // Handle server errors
                if (result.status !== 200) {
                    return reject(
                        new Error("Server returned an error."));
                }

                complete = true;

                resolve(result);
            })
            .catch(err => {
                reject(err);
            });

            // After a specified timeout we abort the request if
            // it's still on-going.
            setTimeout(() => {
                if (!complete) {
                    complete = true;
                    reject(new Error(
                        "Server response exceeded timeout."));
                }
            }, context.ApolloNetwork.timeout || 1000);
        });
    };

    Object.assign(context, {
        // Specifically we need to use the server-side Node.js versions of
        // apollo-client and react-apollo (the ones we use on the main site
        // don't include the server-side rendering logic).
        ApolloClient: ApolloClient,
        ReactApollo: ReactApollo,

        // Additionally, we need to build a request mechanism for actually
        // making a network request to our GraphQL endpoint. We use the
        // node-fetch module for making this request. This logic
        // should be very similar to the logic held in apollo-wrapper.jsx.

        ApolloNetworkLink: createHttpLink({
            // HACK(briang): If you give the uri undefined, it will call
            // fetch("/graphql") but we want to ensure that an undefined URL
            // will fail the request.
            uri: context.ApolloNetwork.url || BAD_URL,
            fetch: handleNetworkFetch,
            headers: context.ApolloNetwork.headers,
        }),

        ApolloCache: new InMemoryCache(),
    });
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
    const context = getVMContext(jsPackages, pathToReactComponent,
                                 cacheBehavior, requestStats);

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
        handleApolloNetwork(context);
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

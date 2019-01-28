/**
 * The core functionality of actually rendering.
 *
 * This uses 'vm' to execute the javascript holding that will perform the
 * render, and jsdom (plus a few other things) to provide the
 * necessary context for rendering it.
 */

'use strict';

const vm = require("vm");

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
 * This method is executed whenever a render is needed. It is executed inside
 * the vm context.
 */
const performRender = async () => {
    // 1. Setup an Apollo client if one is expected.
    const maybeApolloClient = global.ApolloNetworkLink
        // If network details were provided for Apollo then we go about
        // wrapping the element in an Apollo provider (which will
        // collect the data requirements of the child components and
        // send off a network request to a GraphQL endpoint).

        // Build an Apollo client. This is responsible for making the
        // network requests to the GraphQL endpoint and bringing back
        // the data.
        ? new global.ApolloClient.ApolloClient({
            ssrMode: true,
            link: global.ApolloNetworkLink,
            cache: global.ApolloCache,
        })
        // For rendering things that have no Apollo-centric logic, we
        // don't have a client.
        : null;

    // Make a deep clone of the props in the context before
    // rendering them, so that any polyfills we have in the context
    // (like Array.prototype.includes) are applied to the elements
    // of the props.
    const clonedProps = JSON.parse(
        JSON.stringify(global.ssrProps),
    );

    const {getRenderPromiseCallback} = window.__rrs;

    // Now ask the client to render.
    // The client should also get the data here with
    // ReactApollo.getDataFromTree (or other mechanism specific to the
    // framework, if not React).
    const result = await getRenderPromiseCallback(
        clonedProps,
        maybeApolloClient,
    );

    // We need to pass back any data so that it can be rendered directly
    // into the page (for the re-hydration).
    if (global.ApolloNetworkLink) {
        result.data = maybeApolloClient.extract();
    }
    return result;
};

/**
 * Perform a render.
 *
 * This renders by importing all the code that an entrypoint requires.
 * That entrypoint should call __registerForSSR__ which gives us a callback
 * to actually get the rendered content.
 *
 * @param {string} pathToClientEntryPoint - Absolute URL to the client entry
 *     point that is to be loaded and will instigate the render.
 * @param {string} entryPointContent - This is the fetched entry point code
 *     for us to execute.
 * @param {object} props - the props object to pass in to the
 *     renderer; the props used to render.
 * @param {object} globals - the map of global variable name to their values to
 *     be set before the entrypoint is require()'d.
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
 * html is the rendered html of the entry point.
 * css will only be returned if the entrypoint makes use of Aphrodite
 * (https://github.com/Khan/aphrodite).
 */
const render = async function(
    jsPackages,
    props,
    globals,
    cacheBehavior,
    requestStats,
) {
    const {url: entryPointUrl} = jsPackages[jsPackages.length - 1];

    // Here we get the existing VM context for this request or create a new one
    // and configure it accordingly.
    const context = getOrCreateRenderContext(
        jsPackages,
        entryPointUrl,
        cacheBehavior || defaultCacheBehavior,
        requestStats);

    context.ssrProps = props;

    const renderProfile = profile.start("rendering " + entryPointUrl);

    try {
        // Make sure the require globals are made available to the VM context.
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

        // If Apollo is required, get it configured on the context.
        if (context.ApolloNetwork) {
            configureApolloNetwork(context);
        }

        // Now that everything is setup, we can invoke our rendering.
        if (context.__rrs == null) {
            // This is a problem.
            throw new Error("No render callbacks registered");
        }

        const result = await runInContext(context, performRender);
        // If we passed in request-stats, we've modified them in this
        // function (to update the stats).  Pass back the updated
        // stats as part of our response object.
        if (requestStats) {
            result.requestStats = requestStats;
        }
        return result;
    } finally {
        renderProfile.end();
    }
};

render.setDefaultCacheBehavior = function(cacheBehavior) {
    defaultCacheBehavior = cacheBehavior;
};

// Used by tests.
render.resetGlobals = resetGlobals;

module.exports = render;

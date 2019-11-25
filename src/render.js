// @flow
/**
 * The core functionality of actually rendering.
 *
 * This uses 'vm' to execute the javascript holding that will perform the
 * render, and jsdom (plus a few other things) to provide the
 * necessary context for rendering it.
 */
import logging from "./logging.js";
import profile from "./profile.js";
import createRenderContext from "./create-render-context.js";
import configureApolloNetwork from "./configure-apollo-network.js";

import type {
    Globals,
    JavaScriptPackage,
    RenderResult,
    RequestStats,
} from "./types.js";

import type {
    ApolloGlobals,
    ApolloNetworkConfiguration,
    ApolloClientInstance,
} from "./configure-apollo-network.js";

type RenderCallback = (
    props: mixed,
    apolloClient: ?ApolloClientInstance,
) => Promise<RenderResult>;

/**
 * This method is executed whenever a render is needed. It is executed inside
 * the vm context. Because of that, it cannot reference methods that are not
 * a part of the VM context of it's own implementation.
 */
const performRender = async (): Promise<RenderResult> => {
    if (window["__DEBUG_RENDER__"]) {
        // To activate, set __DEBUG_RENDER__ to truthy on the vm context.
        // Special debug entrypoint because this is run inside the vm context
        // by turning it into a string, which means regular breakpoints don't
        // work.
        // eslint-disable-next-line no-debugger
        debugger;
    }

    /**
     * Helper to get the Apollo global setup info together.
     *
     * Ideally, this would live in configure-apollo-network so everything
     * was in one place, but because we're executing this in the VM, it cannot
     * reference that code that way.
     */
    const getApolloGlobals = (): ?ApolloGlobals => {
        const apolloNetworkConfig: ?ApolloNetworkConfiguration = (global.ApolloNetwork: any);

        if (apolloNetworkConfig == null) {
            return null;
        }

        return {
            ApolloClientModule: global.ApolloClientModule,
            ApolloNetworkLink: global.ApolloNetworkLink,
            ApolloCache: global.ApolloCache,
        };
    };

    /**
     * This builds an apollo client if we need one. Again, would be nice if
     * this were colocated with configure-apollo-network, alas due to VM context
     * execution, they can't. However, we do share the types to make it clear.
     */
    const getApolloClient = (): ?ApolloClientInstance => {
        const apolloGlobals = getApolloGlobals();

        if (apolloGlobals == null) {
            // For rendering things that have no Apollo-centric logic, we
            // don't have a client.
            return null;
        }

        const {
            ApolloClientModule,
            ApolloNetworkLink,
            ApolloCache,
        } = apolloGlobals;

        // If network details were provided for Apollo then we go about
        // wrapping the element in an Apollo provider (which will
        // collect the data requirements of the child components and
        // send off a network request to a GraphQL endpoint).

        // Build an Apollo client. This is responsible for making the
        // network requests to the GraphQL endpoint and bringing back
        // the data.
        return new ApolloClientModule.ApolloClient({
            ssrMode: true,
            link: ApolloNetworkLink,
            cache: ApolloCache,
        });
    };

    // Setup an Apollo client if one is expected.
    const maybeApolloClient = getApolloClient();

    // Make a deep clone of the props in the context before
    // rendering them, so that any polyfills we have in the context
    // (like Array.prototype.includes) are applied to the elements
    // of the props.
    const clonedProps = JSON.parse(JSON.stringify(global.ssrProps));

    // Get the render callback that the client registered.
    const getRenderPromiseCallback: RenderCallback =
        window.__rrs.getRenderPromiseCallback;

    // Now ask the client to render.
    // The client should also get the data here with
    // ReactApollo.getDataFromTree (or other mechanism specific to the
    // framework, if not React).
    const result: RenderResult = await getRenderPromiseCallback(
        clonedProps,
        maybeApolloClient,
    );

    // We need to pass back any data so that it can be rendered directly
    // into the page (for the re-hydration).
    if (maybeApolloClient != null) {
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
 * @param {[{content: string, url: string}]} jsPackages - the JS packages to
 * load that will begin the render.
 * @param {object} props - the props object to pass in to the
 *     renderer; the props used to render.
 * @param {object} globals - the map of global variable name to their values to
 *     be set before the entrypoint is require()'d.
 * @param {object} requestStats -- If defined, should be a dict. Used to
 *     store stats about the current request.
 * @returns the results of the entrypoint render; this can be whatever you so
 * choose, but might look something like:
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
export default async function render(
    jsPackages: Array<JavaScriptPackage>,
    props: mixed,
    globals: Globals,
    requestStats?: RequestStats,
) {
    // Here we get the existing VM context for this request or create a new one
    // and configure it accordingly.
    const context = createRenderContext(
        globals ? globals["location"] : "http://www.khanacademy.org",
        globals,
        jsPackages,
        requestStats,
    );

    context.window.ssrProps = props;

    const renderProfile = profile.start(
        `rendering ${(globals && globals["location"]) || ""}`,
    );

    try {
        // If Apollo is required, get it configured on the context.
        const apolloNetwork: ?ApolloNetworkConfiguration = (context.window
            .ApolloNetwork: any);
        const apolloGlobals = configureApolloNetwork(apolloNetwork);

        /**
         * We attach these things to the context window so that when running
         * inside the VM, our code can retrieve them and operate upon them.
         */
        Object.assign(context.window, apolloGlobals);

        // Now that everything is setup, we can invoke our rendering.
        if (context.window.__rrs == null) {
            // This is a problem.
            throw new Error("No render callbacks registered");
        }

        // To debug the performRender function, set a breakpoint on the
        // following line and then in the debug console, set
        // context.__DEBUG_RENDER__ to true before continuing.
        const result = await context.run(performRender);

        // If we passed in request-stats, we've modified them in this
        // function (to update the stats).  Pass back the updated
        // stats as part of our response object.
        if (requestStats) {
            result.requestStats = requestStats;
        }
        return result;
    } finally {
        // We need to kill the JSDOM environment so code doesn't languish
        // running timers and such.
        try {
            context.close();
        } catch (e) {
            logging.warn(`Error while closing JSDOM context: ${e}`);
        }
        renderProfile.end();
    }
}

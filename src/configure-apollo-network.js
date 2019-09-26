// @flow
/**
 * Configure a given context to support Apollo
 *
 * If Apollo network settings are provided during render then we need to expose
 * some important objects to the vm context. ApolloNetwork should have two
 * properties: 'url' (for the URL of the GraphQL endpoint) and 'headers'
 * for a key-value map of headers to send to the GraphQL endpoint. This
 * can include things such as cookies and xsrf tokens.
 * Requests will automatically timeout after 1000ms, unless another
 * timeout is provided via a 'timeout' property.
 */
import * as ApolloClientModule from "apollo-client";
import {InMemoryCache} from "apollo-cache-inmemory";
import {createHttpLink} from "apollo-link-http";
import fetch from "node-fetch";

import type {DOMWindow} from "jsdom";
import type {NormalizedCacheObject} from "apollo-cache-inmemory";
import type {ApolloClient, ApolloCache, ApolloLink} from "apollo-client";

type ApolloNetworkConfiguration = {
    timeout?: number,
    url?: string,
    headers?: any,
};

type ApolloGlobals = {
    +ApolloClientModule: typeof ApolloClientModule,
    +ApolloNetworkLink: ApolloLink,
    +ApolloCache: ApolloCache<NormalizedCacheObject>,
    +ApolloNetwork: ApolloNetworkConfiguration,
};

const BAD_URL = "BAD_URL";

const timeout = async (timeout: number, errorMsg: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            reject(new Error(errorMsg));
        }, timeout);
    });
};

/**
 * Get the Apollo netowrk configuration.
 *
 * This runs both inside and outside the render JSDOM VM.
 */
const getApolloConfiguration = (
    contextWindow?: DOMWindow,
): ?ApolloNetworkConfiguration => {
    return ((contextWindow || global).ApolloNetwork: any);
};

/**
 * Build Apollo configuration info from global data.
 *
 * This runs inside the render JSDOM VM.
 */
const getApolloGlobals = (): ?ApolloGlobals => {
    const apolloNetworkConfig: ?ApolloNetworkConfiguration = getApolloConfiguration();

    if (apolloNetworkConfig == null) {
        return null;
    }

    return {
        ApolloNetwork: (apolloNetworkConfig: ApolloNetworkConfiguration),
        ApolloClientModule: global.ApolloClient,
        ApolloNetworkLink: global.ApolloNetworkLink,
        ApolloCache: global.ApolloCache,
    };
};

/**
 * Get an instance of ApolloClient.
 *
 * This runs inside the render JSDOM VM. We know all the types because we set
 * this up.
 */
export const getApolloClient = (): ?ApolloClient<NormalizedCacheObject> => {
    const apolloGlobals = getApolloGlobals();

    if (apolloGlobals == null) {
        // For rendering things that have no Apollo-centric logic, we
        // don't have a client.
        return null;
    }

    const {ApolloClientModule, ApolloNetworkLink, ApolloCache} = apolloGlobals;

    // If network details were provided for Apollo then we go about
    // wrapping the element in an Apollo provider (which will
    // collect the data requirements of the child components and
    // send off a network request to a GraphQL endpoint).

    // Build an Apollo client. This is responsible for making the
    // network requests to the GraphQL endpoint and bringing back
    // the data.
    return new ApolloClientModule.ApolloClient<NormalizedCacheObject>({
        ssrMode: true,
        link: ApolloNetworkLink,
        cache: ApolloCache,
    });
};

export default function configureApolloNetwork(contextWindow: DOMWindow): void {
    const ApolloNetwork = getApolloConfiguration(contextWindow);
    if (ApolloNetwork == null) {
        return;
    }

    const handleNetworkFetch = async (url: string, params: any) => {
        if (!url || url === BAD_URL) {
            throw new Error("ApolloNetwork must have a valid url.");
        }

        const result = await Promise.race([
            fetch(url, params),
            // After a specified timeout we abort the request if
            // it's still on-going.
            timeout(
                ApolloNetwork.timeout || 1000,
                "Server response exceeded timeout.",
            ),
        ]);

        // Handle server errors
        if (!result || result.status !== 200) {
            throw new Error("Server returned an error.");
        }

        return result;
    };

    /**
     * We attach these things to the context DOMWindow so that when running
     * inside the VM, our code can retrieve them and operate upon them.
     */
    Object.assign(contextWindow, {
        // We need to use the server-side Node.js version of
        // apollo-client (the ones we use on the main site
        // don't include the server-side rendering logic).
        ApolloClient: ApolloClientModule,

        // Additionally, we need to build a request mechanism for actually
        // making a network request to our GraphQL endpoint. We use the
        // node-fetch module for making this request. This logic
        // should be very similar to the logic held in apollo-wrapper.jsx.

        ApolloNetworkLink: createHttpLink({
            // HACK(briang): If you give the uri undefined, it will call
            // fetch("/graphql") but we want to ensure that an undefined URL
            // will fail the request.
            uri: ApolloNetwork.url || BAD_URL,
            fetch: handleNetworkFetch,
            headers: ApolloNetwork.headers,
        }),

        ApolloCache: new InMemoryCache(),
    });
}

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
import * as ApolloClient from "apollo-client";
import {InMemoryCache} from "apollo-cache-inmemory";
import {createHttpLink} from "apollo-link-http";
import fetch from "node-fetch";

import type {RenderContext} from "./types.js";

const BAD_URL = "BAD_URL";

const timeout = async (timeout: number, errorMsg: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            reject(new Error(errorMsg));
        }, timeout);
    });
};

export default function configureApolloNetwork(context: RenderContext): void {
    const {ApolloNetwork} = context;
    if (ApolloNetwork == null) {
        return;
    }

    const handleNetworkFetch = async (url, params) => {
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

    Object.assign(context, {
        // We need to use the server-side Node.js version of
        // apollo-client (the ones we use on the main site
        // don't include the server-side rendering logic).
        ApolloClient: ApolloClient,

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

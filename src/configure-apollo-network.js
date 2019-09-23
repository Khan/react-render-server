// @noflow
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
const ApolloClient = require("apollo-client");
const apolloCacheInmemory = require("apollo-cache-inmemory");
const apolloLinkHttp = require("apollo-link-http");
const fetch = require("node-fetch");

const createHttpLink = apolloLinkHttp.createHttpLink;
const InMemoryCache = apolloCacheInmemory.InMemoryCache;

const BAD_URL = "BAD_URL";

const timeout = async (timeout, errorMsg) => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            reject(new Error(errorMsg));
        }, timeout);
    });
};

const configureApolloNetwork = (context) => {
    const handleNetworkFetch = async (url, params) => {
        if (!url || url === BAD_URL) {
            throw new Error("ApolloNetwork must have a valid url.");
        }

        const result = await Promise.race([
            fetch(url, params),
            // After a specified timeout we abort the request if
            // it's still on-going.
            timeout(
                context.ApolloNetwork.timeout || 1000,
                "Server response exceeded timeout.",
            ),
        ]);

        // Handle server errors
        if (result.status !== 200) {
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
            uri: context.ApolloNetwork.url || BAD_URL,
            fetch: handleNetworkFetch,
            headers: context.ApolloNetwork.headers,
        }),

        ApolloCache: new InMemoryCache(),
    });
};

module.exports = configureApolloNetwork;

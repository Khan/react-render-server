
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
const fetch = require('node-fetch');

const createHttpLink = apolloLinkHttp.createHttpLink;
const InMemoryCache = apolloCacheInmemory.InMemoryCache;

const BAD_URL = "BAD_URL";

const configureApolloNetwork = (context) => {
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
        // Specifically we need to use the server-side Node.js version of
        // apollo-client).
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

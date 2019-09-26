// flow-typed signature: 1d91079d6f9a7cc4435ad74fd7a02f81
// flow-typed version: <<STUB>>/apollo-cache-inmemory_v1.3.0/flow_v0.108.0
import {ApolloCache} from "apollo-client";
import type { StoreValue } from 'apollo-utilities';

declare type apollocacheinmemory$StoreObject = {
    __typename?: string;
    [storeFieldKey: string]: StoreValue;
}

declare type apollocacheinmemory$NormalizedCacheObject = {
    [dataId: string]: apollocacheinmemory$StoreObject;
}

declare class apollocacheinmemory$InMemoryCache extends ApolloCache<apollocacheinmemory$NormalizedCacheObject> {
    constructor(): this;
}

declare module 'apollo-cache-inmemory' {
    declare export type NormalizedCacheObject = apollocacheinmemory$NormalizedCacheObject;

    declare module.exports: {
        InMemoryCache: typeof apollocacheinmemory$InMemoryCache
    };
}

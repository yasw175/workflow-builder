import { ApolloClient, InMemoryCache, HttpLink, split } from '@apollo/client';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';
import { getMainDefinition } from '@apollo/client/utilities';
import { nhost } from './nhost';

const httpUrl = process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL!;
const wsUrl = process.env.NEXT_PUBLIC_HASURA_GRAPHQL_WS_URL!;

const httpLink = new HttpLink({
  uri: httpUrl,
  fetch: (uri, options: any) => {
    const token = nhost.auth.getAccessToken();
    options.headers = {
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    return fetch(uri, options);
  },
});

const wsLink =
  typeof window !== 'undefined'
    ? new GraphQLWsLink(
        createClient({
          url: wsUrl,
          connectionParams: () => {
            const token = nhost.auth.getAccessToken();
            return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
          },
        })
      )
    : null;

const splitLink =
  typeof window !== 'undefined' && wsLink
    ? split(
        ({ query }) => {
          const def = getMainDefinition(query);
          return def.kind === 'OperationDefinition' && def.operation === 'subscription';
        },
        wsLink,
        httpLink
      )
    : httpLink;

export const apolloClient = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache(),
});

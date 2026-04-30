import { GraphQLClient, gql } from "graphql-request";
require('dotenv').config()

const endpoint = "https://api.start.gg/gql/alpha";

console.log(process.env.STARTGG_API_KEY)

export const startggClient = new GraphQLClient(endpoint, {
  headers: {
    Authorization: `Bearer ${process.env.STARTGG_API_KEY}`,
  },
});

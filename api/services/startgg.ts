import { GraphQLClient } from "graphql-request";
import dotenv from "dotenv";

dotenv.config();

const endpoint = "https://api.start.gg/gql/alpha";
const apiKey = process.env.STARTGG_API_KEY;

if (!apiKey) {
  throw new Error("STARTGG_API_KEY is required");
}

export const startggClient = new GraphQLClient(endpoint, {
  headers: {
    Authorization: `Bearer ${apiKey}`,
  },
});

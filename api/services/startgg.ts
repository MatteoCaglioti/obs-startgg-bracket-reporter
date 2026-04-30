import { GraphQLClient } from "graphql-request";
import dotenv from "dotenv";
import { getStartggApiKey } from "./config";

dotenv.config();

const endpoint = "https://api.start.gg/gql/alpha";

const apiKey = getStartggApiKey();

if (!apiKey) {
  throw new Error("STARTGG_API_KEY is required");
}

export const startggClient = new GraphQLClient(endpoint, {
  headers: {
    Authorization: `Bearer ${apiKey}`,
  },
});

import { GraphQLClient } from "graphql-request";
import { getStartggApiKey } from "./config";

const endpoint = "https://api.start.gg/gql/alpha";

function createStartggClient() {
  const apiKey = getStartggApiKey();

  if (!apiKey) {
    throw new Error("STARTGG_API_TOKEN is required");
  }

  return new GraphQLClient(endpoint, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
}

export const startggClient = {
  request(document: any, variables?: any) {
    return createStartggClient().request(document, variables);
  },
};

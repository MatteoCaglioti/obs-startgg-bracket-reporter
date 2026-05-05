import { gql } from "graphql-request";
import { startggClient } from "./startgg";

const MARK_SET_IN_PROGRESS = gql`
  mutation MarkSetInProgress($setId: ID!) {
    markSetInProgress(setId: $setId) {
      id
      state
    }
  }
`;

const MARK_SET_CALLED = gql`
  mutation MarkSetCalled($setId: ID!) {
    markSetCalled(setId: $setId) {
      id
      state
    }
  }
`;

export async function startSetOnStartGG(setId: string) {
  // Some brackets require called → in progress
  await startggClient.request(MARK_SET_CALLED, {
    setId,
  });

  const result = await startggClient.request(MARK_SET_IN_PROGRESS, { setId });
  return result;
}

import { gql } from "graphql-request";
import { startggClient } from "./startgg";

const ASSIGN_STREAM = gql`
  mutation AssignStream($setId: ID!, $streamId: ID!) {
    assignStream(setId: $setId, streamId: $streamId) {
      id
      stream {
        id
        streamName
        streamSource
      }
    }
  }
`;

export async function assignStreamToSet(setId: string, streamId: string) {
  return startggClient.request(ASSIGN_STREAM, {
    setId,
    streamId,
  });
}

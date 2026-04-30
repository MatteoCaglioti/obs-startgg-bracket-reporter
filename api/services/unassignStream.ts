import { gql } from "graphql-request";
import { startggClient } from "./startgg";

const UNASSIGN_STREAM = gql`
  mutation UnassignStream($setId: ID!) {
    assignStream(setId: $setId, streamId: 0) {
      id
      stream {
        id
        streamName
      }
    }
  }
`;

export async function unassignStreamFromSet(setId: string) {
  return startggClient.request(UNASSIGN_STREAM, { setId });
}

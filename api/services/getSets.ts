import { startggClient } from "./startgg";
import { gql } from "graphql-request";

const GET_SETS = gql`
  query GetSets($slug: String!) {
    tournament(slug: $slug) {
      events {
        sets(page: 1, perPage: 50) {
          nodes {
            id
            fullRoundText
            state

            stream {
              id
              streamName
            }

            slots {
              entrant {
                id
                name
              }
              standing {
                stats {
                  score {
                    value
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

export async function getSets(slug: string) {
  const data = await startggClient.request(GET_SETS, { slug });

  return data.tournament.events.flatMap((event: any) => event.sets.nodes);
}

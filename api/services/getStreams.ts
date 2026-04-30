import { gql } from "graphql-request";
import { startggClient } from "./startgg";
import type { TournamentStream } from "../core/types";

const GET_TOURNAMENT_STREAMS = gql`
  query GetTournamentStreams($slug: String!) {
    tournament(slug: $slug) {
      id
      streams {
        id
        streamId
        streamName
        streamSource
      }
    }
  }
`;

function normalizeStreamName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function getTournamentStreams(
  slug: string,
): Promise<TournamentStream[]> {
  const data: any = await startggClient.request(GET_TOURNAMENT_STREAMS, {
    slug,
  });

  const streams = data.tournament?.streams ?? [];

  return streams
    .filter((s: any) => s?.id && s?.streamName)
    .map((s: any) => ({
      id: String(s.id),
      name: s.streamName,
      source: s.streamSource ?? null,
      externalStreamId: s.streamId ? String(s.streamId) : null,
    }));
}

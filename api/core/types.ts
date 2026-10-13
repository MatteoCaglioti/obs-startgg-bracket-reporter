export type MatchStatus =
  | "idle"
  | "assigned"
  | "live"
  | "saved"
  | "complete";

export interface Match {
  id: string;
  round: string;

  player1: { id: string; name: string };
  player2: { id: string; name: string };

  score1: number;
  score2: number;

  /** Stream selected locally for this app's scoreboard. */
  streamId: string | null;
  /** Stream assignment currently reported by start.gg. */
  startggStreamId: string | null;
  status: "idle" | "assigned" | "live" | "saved" | "complete";

  updatedAt: number;
}

export function isMatchNotNull(m: Match | null): m is Match {
  return m !== null;
}

export interface TournamentStream {
  id: string; // start.gg stream object ID
  name: string;
  source: string | null;
  externalStreamId?: string | null; // Twitch/YouTube/etc platform stream id if present
}

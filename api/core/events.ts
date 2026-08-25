import type { Match } from "./types";

export type Event =
  | { type: "OFFLINE_MATCH_CONFIGURED"; matchId: string; match: Match }
  | {
      type: "OFFLINE_MATCH_DETAILS_UPDATED";
      matchId: string;
      player1Name: string;
      player2Name: string;
      matchLabel: string;
    }
  | { type: "MATCH_ASSIGNED"; matchId: string; streamId: string }
  | { type: "MATCH_UNASSIGNED"; matchId: string }
  | { type: "MATCH_STARTED"; matchId: string }
  | { type: "SCORE_UPDATED"; matchId: string; score1: number; score2: number }
  | { type: "MATCH_RESULT_SAVED"; matchId: string }
  | { type: "MATCH_COMPLETED"; matchId: string };

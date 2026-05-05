export type Event =
  | { type: "MATCH_ASSIGNED"; matchId: string; streamId: string }
  | { type: "MATCH_UNASSIGNED"; matchId: string }
  | { type: "MATCH_STARTED"; matchId: string }
  | { type: "SCORE_UPDATED"; matchId: string; score1: number; score2: number }
  | { type: "MATCH_RESULT_SAVED"; matchId: string }
  | { type: "MATCH_COMPLETED"; matchId: string };

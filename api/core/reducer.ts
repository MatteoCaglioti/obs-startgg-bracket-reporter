import { Match } from "./types";
import { Event } from "./events";

export function reducer(state: Record<string, Match>, event: Event) {
  const match = state[event.matchId];
  if (!match) return state;

  switch (event.type) {
    case "MATCH_ASSIGNED":
      if (match.status !== "idle") return state;
      if (match.streamId) return state;

      match.streamId = event.streamId;
      match.status = "assigned";
      break;

    case "MATCH_UNASSIGNED":
      if (!match.streamId) return state;

      match.streamId = null;

      if (match.status === "assigned") {
        match.status = "idle";
      }

      match.updatedAt = Date.now();
      break;

    case "MATCH_STARTED":
      if (match.status !== "assigned") return state;
      match.status = "live";
      break;

    case "SCORE_UPDATED":
      if (match.status === "complete") return state;
      match.score1 = event.score1;
      match.score2 = event.score2;
      match.updatedAt = Date.now();
      break;

    case "MATCH_RESULT_SAVED":
      if (match.status !== "live") return state;
      match.status = "saved";
      break;

    case "MATCH_COMPLETED":
      if (match.status !== "saved") return state;
      match.status = "complete";
      match.streamId = null;
      break;
  }

  match.updatedAt = Date.now();
  return state;
}

import { Match } from "../core/types";

export function mapSetToMatch(set: any): Match | null {
  const p1 = set.slots?.[0]?.entrant;
  const p2 = set.slots?.[1]?.entrant;
  const startggStreamId = set.stream?.id ? String(set.stream.id) : null;

  if (
    !p1?.id ||
    !p2?.id ||
    p1.name === "BYE" ||
    p2.name === "BYE" ||
    set.state === 3
  )
    return null;

  return {
    id: String(set.id),
    round: set.fullRoundText ?? "Unknown",

    player1: {
      id: p1?.id ?? "p1",
      name: p1?.name ?? "TBD",
    },

    player2: {
      id: p2?.id ?? "p2",
      name: p2?.name ?? "TBD",
    },

    score1: set.slots?.[0]?.standing?.stats?.score?.value ?? 0,
    score2: set.slots?.[1]?.standing?.stats?.score?.value ?? 0,

    streamId: null,
    startggStreamId,
    status: mapStartGGStateToStatus(set.state),
    updatedAt: Date.now(),
  };
}

function mapStartGGStateToStatus(state: number): Match["status"] {
  if (state === 2) return "live";
  if (state === 3) return "complete";

  return "idle";
}

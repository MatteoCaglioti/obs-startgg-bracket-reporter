import { Router } from "express";
import type { Request, Response } from "express";
import { store } from "../core/store";
import { Server } from "socket.io";
import type { Match } from "../core/types";

export function adjustDisplayedScore(
  match: Pick<Match, "score1" | "score2">,
  player: 1 | 2,
  delta: -1 | 1,
  swapped: boolean,
) {
  const updatesScore1 = (player === 1) !== swapped;

  return {
    score1: updatesScore1
      ? Math.max(0, match.score1 + delta)
      : match.score1,
    score2: updatesScore1
      ? match.score2
      : Math.max(0, match.score2 + delta),
  };
}

export function createStreamDeckRouter(io: Server) {
  const router = Router();

  // Scoreboard display state keyed by streamId (or "default")
  const displayState: Record<string, { visible: boolean; swapped: boolean }> = {
    default: { visible: true, swapped: false },
  };

  function getDisplay(streamId: string) {
    if (!displayState[streamId]) {
      displayState[streamId] = { visible: true, swapped: false };
    }
    return displayState[streamId];
  }

  function emitDisplay() {
    io.emit("scoreboard:display", displayState);
  }

  function requestedStreamId(req: Request) {
    const { streamId } = { ...req.query, ...req.body };
    return typeof streamId === "string" && streamId ? streamId : undefined;
  }

  /** Find the match explicitly selected for a stream or the default scoreboard. */
  function findActiveMatch(streamId?: string) {
    const matches = Object.values(store.getState());
    if (streamId) {
      return (
        matches.find(
          (m) => m.streamId === streamId && m.status !== "complete",
        ) ?? null
      );
    }
    return (
      matches.find((m) => Boolean(m.streamId) && m.status !== "complete") ??
      null
    );
  }

  function updateDisplayedScore(
    req: Request,
    res: Response,
    player: 1 | 2,
    delta: -1 | 1,
  ) {
    const streamId = requestedStreamId(req);
    const match = findActiveMatch(streamId);
    if (!match) return res.status(404).json({ error: "No active match found" });
    if (match.status === "complete") {
      return res.status(409).json({ error: "Match is complete" });
    }

    const display = getDisplay(streamId ?? "default");
    const scores = adjustDisplayedScore(match, player, delta, display.swapped);

    store.dispatch({
      type: "SCORE_UPDATED",
      matchId: match.id,
      ...scores,
    });
    return res.json(store.getState()[match.id]);
  }

  // ── Score controls ────────────────────────────────────────────────────────

  router.all("/p1/score/up", (req, res) => {
    return updateDisplayedScore(req, res, 1, 1);
  });

  router.all("/p1/score/down", (req, res) => {
    return updateDisplayedScore(req, res, 1, -1);
  });

  router.all("/p2/score/up", (req, res) => {
    return updateDisplayedScore(req, res, 2, 1);
  });

  router.all("/p2/score/down", (req, res) => {
    return updateDisplayedScore(req, res, 2, -1);
  });

  router.all("/score/reset", (req, res) => {
    const streamId = requestedStreamId(req);
    const match = findActiveMatch(streamId);
    if (!match) return res.status(404).json({ error: "No active match found" });
    if (match.status === "complete") return res.status(409).json({ error: "Match is complete" });

    store.dispatch({
      type: "SCORE_UPDATED",
      matchId: match.id,
      score1: 0,
      score2: 0,
    });
    return res.json(store.getState()[match.id]);
  });

  // ── Display controls ──────────────────────────────────────────────────────

  router.all("/swap", (req, res) => {
    const streamId = requestedStreamId(req) ?? "default";
    const d = getDisplay(streamId);
    d.swapped = !d.swapped;
    emitDisplay();
    return res.json({ streamId, swapped: d.swapped });
  });

  router.all("/scoreboard/show", (req, res) => {
    const streamId = requestedStreamId(req) ?? "default";
    const d = getDisplay(streamId);
    d.visible = true;
    emitDisplay();
    return res.json({ streamId, visible: true });
  });

  router.all("/scoreboard/hide", (req, res) => {
    const streamId = requestedStreamId(req) ?? "default";
    const d = getDisplay(streamId);
    d.visible = false;
    emitDisplay();
    return res.json({ streamId, visible: false });
  });

  router.all("/display", (_req, res) => {
    return res.json(displayState);
  });

  return {
    router,
    getDisplayState: () => displayState,
  };
}

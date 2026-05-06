import { Router } from "express";
import { store } from "../core/store";
import { Server } from "socket.io";

export function createStreamDeckRouter(io: Server) {
  const router = Router();

  // Scoreboard display state keyed by streamId (or "default")
  const displayState: Record<string, { visible: boolean; swapped: boolean }> = {};

  function getDisplay(streamId: string) {
    if (!displayState[streamId]) {
      displayState[streamId] = { visible: true, swapped: false };
    }
    return displayState[streamId];
  }

  function emitDisplay() {
    io.emit("scoreboard:display", displayState);
  }

  /** Find the active match for a given streamId, or the first live/assigned match */
  function findActiveMatch(streamId?: string) {
    const matches = Object.values(store.getState());
    if (streamId) {
      return matches.find((m) => m.streamId === streamId && m.status !== "complete") ?? null;
    }
    return (
      matches.find((m) => m.status === "live") ??
      matches.find((m) => m.status === "saved") ??
      matches.find((m) => m.status === "assigned" && m.streamId) ??
      null
    );
  }

  // ── Score controls ────────────────────────────────────────────────────────

  router.post("/p1/score/up", (req, res) => {
    const { streamId } = req.body ?? {};
    const match = findActiveMatch(streamId);
    if (!match) return res.status(404).json({ error: "No active match found" });
    if (match.status === "complete") return res.status(409).json({ error: "Match is complete" });

    store.dispatch({
      type: "SCORE_UPDATED",
      matchId: match.id,
      score1: match.score1 + 1,
      score2: match.score2,
    });
    io.emit("match:update", store.getState());
    return res.json(store.getState()[match.id]);
  });

  router.post("/p1/score/down", (req, res) => {
    const { streamId } = req.body ?? {};
    const match = findActiveMatch(streamId);
    if (!match) return res.status(404).json({ error: "No active match found" });
    if (match.status === "complete") return res.status(409).json({ error: "Match is complete" });

    store.dispatch({
      type: "SCORE_UPDATED",
      matchId: match.id,
      score1: Math.max(0, match.score1 - 1),
      score2: match.score2,
    });
    io.emit("match:update", store.getState());
    return res.json(store.getState()[match.id]);
  });

  router.post("/p2/score/up", (req, res) => {
    const { streamId } = req.body ?? {};
    const match = findActiveMatch(streamId);
    if (!match) return res.status(404).json({ error: "No active match found" });
    if (match.status === "complete") return res.status(409).json({ error: "Match is complete" });

    store.dispatch({
      type: "SCORE_UPDATED",
      matchId: match.id,
      score1: match.score1,
      score2: match.score2 + 1,
    });
    io.emit("match:update", store.getState());
    return res.json(store.getState()[match.id]);
  });

  router.post("/p2/score/down", (req, res) => {
    const { streamId } = req.body ?? {};
    const match = findActiveMatch(streamId);
    if (!match) return res.status(404).json({ error: "No active match found" });
    if (match.status === "complete") return res.status(409).json({ error: "Match is complete" });

    store.dispatch({
      type: "SCORE_UPDATED",
      matchId: match.id,
      score1: match.score1,
      score2: Math.max(0, match.score2 - 1),
    });
    io.emit("match:update", store.getState());
    return res.json(store.getState()[match.id]);
  });

  // ── Display controls ──────────────────────────────────────────────────────

  router.post("/swap", (req, res) => {
    const { streamId = "default" } = req.body ?? {};
    const d = getDisplay(streamId);
    d.swapped = !d.swapped;
    emitDisplay();
    return res.json({ streamId, swapped: d.swapped });
  });

  router.post("/scoreboard/show", (req, res) => {
    const { streamId = "default" } = req.body ?? {};
    const d = getDisplay(streamId);
    d.visible = true;
    emitDisplay();
    return res.json({ streamId, visible: true });
  });

  router.post("/scoreboard/hide", (req, res) => {
    const { streamId = "default" } = req.body ?? {};
    const d = getDisplay(streamId);
    d.visible = false;
    emitDisplay();
    return res.json({ streamId, visible: false });
  });

  router.get("/display", (_req, res) => {
    return res.json(displayState);
  });

  return { router, getDisplay, emitDisplay };
}

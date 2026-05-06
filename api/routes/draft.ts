import { Router } from "express";
import path from "path";
import fs from "fs";
import { draftStore } from "../core/draftStore";
import { Ruleset } from "../core/draftTypes";
import { Server } from "socket.io";

function loadRuleset(): Ruleset {
  const configPath = (process as any).pkg
    ? path.join(path.dirname(process.execPath), "config", "ruleset.json")
    : path.join(__dirname, "..", "config", "ruleset.json");
  const raw = fs.readFileSync(configPath, "utf-8");
  return JSON.parse(raw) as Ruleset;
}

export function createDraftRouter(io: Server) {
  const router = Router();

  draftStore.subscribe(() => {
    io.emit("draft:update", draftStore.getState());
  });

  // GET /draft — current draft state + ruleset
  router.get("/", (_req, res) => {
    return res.json(draftStore.getState());
  });

  // POST /draft/start — start/restart a fresh draft
  router.post("/start", (req, res) => {
    const { matchId, p1Name, p2Name } = req.body ?? {};
    try {
      const ruleset = loadRuleset();
      draftStore.start(ruleset, matchId, p1Name, p2Name);
      return res.json(draftStore.getState());
    } catch (err: any) {
      return res.status(500).json({ error: "Failed to load ruleset", details: err.message });
    }
  });

  // POST /draft/select — player selects a character
  router.post("/select", (req, res) => {
    const { codename } = req.body ?? {};
    if (!codename) return res.status(400).json({ error: "codename is required" });
    const ok = draftStore.select(codename);
    if (!ok) return res.status(409).json({ error: "Invalid selection" });
    return res.json(draftStore.getState());
  });

  // POST /draft/confirm — confirm current step
  router.post("/confirm", (_req, res) => {
    const ok = draftStore.confirm();
    if (!ok) return res.status(409).json({ error: "Cannot confirm at this time" });
    return res.json(draftStore.getState());
  });

  // POST /draft/undo
  router.post("/undo", (_req, res) => {
    const ok = draftStore.undo();
    if (!ok) return res.status(409).json({ error: "Nothing to undo" });
    return res.json(draftStore.getState());
  });

  // POST /draft/redo
  router.post("/redo", (_req, res) => {
    const ok = draftStore.redo();
    if (!ok) return res.status(409).json({ error: "Nothing to redo" });
    return res.json(draftStore.getState());
  });

  // POST /draft/restart — reset draft
  router.post("/restart", (_req, res) => {
    draftStore.restart();
    return res.json(draftStore.getState());
  });

  // POST /draft/match-winner — record winner, advance to next game
  router.post("/match-winner", (req, res) => {
    const { winner } = req.body ?? {};
    if (winner !== 0 && winner !== 1) {
      return res.status(400).json({ error: "winner must be 0 or 1" });
    }
    draftStore.recordGameWinner(winner as 0 | 1);
    return res.json(draftStore.getState());
  });

  // POST /draft/gentlemans — toggle gentleman's clause
  router.post("/gentlemans", (req, res) => {
    const { value } = req.body ?? {};
    draftStore.setGentlemans(typeof value === "boolean" ? value : !draftStore.getState().gentlemans);
    return res.json(draftStore.getState());
  });

  // POST /draft/players — update player names (syncs from active match)
  router.post("/players", (req, res) => {
    const { p1Name, p2Name } = req.body ?? {};
    if (!p1Name || !p2Name) return res.status(400).json({ error: "p1Name and p2Name required" });
    draftStore.updatePlayerNames(p1Name, p2Name);
    return res.json(draftStore.getState());
  });

  return router;
}

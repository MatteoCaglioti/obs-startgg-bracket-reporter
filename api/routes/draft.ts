import { Router } from "express";
import path from "path";
import fs from "fs";
import { draftStore } from "../core/draftStore";
import { DraftRuleset } from "../core/draftTypes";
import { Server } from "socket.io";

function getRulesetPath(): string {
  if ((process as any).pkg) return path.join(path.dirname(process.execPath), "config", "ruleset.json");
  // __dirname = api/routes (ts-node) or api/dist/routes (compiled)
  const parent = path.resolve(__dirname, "..");
  const apiRoot = path.basename(parent) === "dist" ? path.resolve(parent, "..") : parent;
  return path.join(apiRoot, "config", "ruleset.json");
}

function loadRuleset(): DraftRuleset {
  const configPath = getRulesetPath();
  const raw = fs.readFileSync(configPath, "utf-8");
  return JSON.parse(raw) as DraftRuleset;
}

export function createDraftRouter(io: Server) {
  const router = Router();

  draftStore.subscribe(() => {
    io.emit("draft:update", draftStore.getState());
  });

  // GET /draft — current draft state
  router.get("/", (_req, res) => {
    return res.json(draftStore.getState());
  });

  // POST /draft/start — begin a new draft, goes to rps phase
  router.post("/start", (req, res) => {
    const { team1Name, team2Name } = req.body ?? {};
    try {
      const ruleset = loadRuleset();
      draftStore.start(ruleset, team1Name ?? "Team 1", team2Name ?? "Team 2");
      return res.json(draftStore.getState());
    } catch (err: any) {
      return res.status(500).json({ error: "Failed to load ruleset", details: err.message });
    }
  });

  // POST /draft/rps-winner — record who won RPS; body: { winner: 1 | 2 }
  router.post("/rps-winner", (req, res) => {
    const { winner } = req.body ?? {};
    if (winner !== 1 && winner !== 2) {
      return res.status(400).json({ error: "winner must be 1 or 2" });
    }
    draftStore.setRpsWinner(winner as 1 | 2);
    return res.json(draftStore.getState());
  });

  // POST /draft/ban — ban a character; body: { codename }
  router.post("/ban", (req, res) => {
    const { codename } = req.body ?? {};
    if (!codename) return res.status(400).json({ error: "codename is required" });
    const ok = draftStore.ban(codename);
    if (!ok) return res.status(409).json({ error: "Invalid ban" });
    return res.json(draftStore.getState());
  });

  // POST /draft/pick — pick a character; body: { codename }
  router.post("/pick", (req, res) => {
    const { codename } = req.body ?? {};
    if (!codename) return res.status(400).json({ error: "codename is required" });
    const ok = draftStore.pick(codename);
    if (!ok) return res.status(409).json({ error: "Invalid pick" });
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

  // POST /draft/restart — back to rps phase, keeping team names; reloads ruleset from disk
  router.post("/restart", (_req, res) => {
    try {
      const ruleset = loadRuleset();
      draftStore.restart(ruleset);
    } catch {
      draftStore.restart(); // fall back to existing ruleset if file unreadable
    }
    return res.json(draftStore.getState());
  });

  return router;
}


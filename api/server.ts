import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import { Server } from "socket.io";
import cors from "cors";

import { isMatchNotNull } from "./core/types";
import { assignStreamToSet } from "./services/assignStream";
import { unassignStreamFromSet } from "./services/unassignStream";
import { startSetOnStartGG } from "./services/startMatch";
import { getSets } from "./services/getSets";
import { saveScoresToStartGG } from "./services/saveResult";
import { mapSetToMatch } from "./services/mapToMatch";
import { store } from "./core/store";

import type { TournamentStream } from "./core/types";
import { getTournamentStreams } from "./services/getStreams";
import { finalSubmitResultToStartGG } from "./services/submitResult";

let streams: TournamentStream[] = [];

declare global {
  namespace NodeJS {
    interface Process {
      pkg?: any;
    }
  }
}

const app = express();

app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:3001"],
  }),
);

app.use(express.json());

const appDir = process.pkg ? path.dirname(process.execPath) : process.cwd();

const configPath = path.join(appDir, "config.json");

type AppConfig = {
  STARTGG_API_TOKEN?: string;
};

function readConfig(): AppConfig {
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(
      configPath,
      JSON.stringify({ STARTGG_API_TOKEN: "" }, null, 2),
    );
  }

  return JSON.parse(fs.readFileSync(configPath, "utf-8"));
}

function saveConfig(config: AppConfig) {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

let appConfig = readConfig();

function getStartggToken() {
  return process.env.STARTGG_API_TOKEN || appConfig.STARTGG_API_TOKEN;
}

app.get("/config", (_req, res) => {
  res.json({
    hasStartggToken: Boolean(getStartggToken()),
  });
});

app.post("/config", (req, res) => {
  const { STARTGG_API_TOKEN } = req.body;

  if (!STARTGG_API_TOKEN || typeof STARTGG_API_TOKEN !== "string") {
    return res.status(400).json({ error: "STARTGG_API_TOKEN is required" });
  }

  appConfig = {
    ...appConfig,
    STARTGG_API_TOKEN,
  };

  saveConfig(appConfig);

  res.json({ ok: true });
});

const webDistPath = path.join(__dirname, "../../web/dist");

app.use(express.static(webDistPath));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:3001"],
  },
});

io.on("connection", (socket) => {
  socket.on("subscribe", ({ streamId }) => {
    socket.join(streamId);
  });

  socket.on("unsubscribe", ({ streamId }) => {
    socket.leave(streamId);
  });
});

// ✅ STORE → SOCKET BRIDGE (THIS IS STEP 4)
store.subscribe((state, event) => {
  if (!("matchId" in event)) return;

  const match = state[event.matchId];
  if (!match?.streamId) return;

  io.to(match.streamId).emit("MATCH_UPDATE", match);
});

async function bootstrap() {
  await refreshFromStartGG();
}

async function refreshFromStartGG() {
  const slug = "test-tournament-1689";

  const sets = await getSets(slug);
  const matches = sets.map(mapSetToMatch).filter(isMatchNotNull);

  const freshStreams = await getTournamentStreams(slug);

  streams = freshStreams;
  store.mergeFromStartGG(matches);
  console.log(`Refreshed ${matches.length} matches`);
  console.log(`Refreshed ${freshStreams.length} streams`);

  return {
    matches: matches.length,
    streams: freshStreams.length,
  };
}

app.get("/matches", (req, res) => {
  res.json(store.getState());
});

app.get("/streams", (req, res) => {
  res.json(streams);
});

app.post("/assign", async (req, res) => {
  const { matchId, streamId } = req.body;

  if (!matchId || !streamId) {
    return res.status(400).json({
      error: "matchId and streamId are required",
    });
  }

  const match = store.getState()[matchId];

  if (!match) {
    return res.status(404).json({
      error: "Match not found",
    });
  }

  const streamExists = streams.some((stream) => stream.id === streamId);

  if (!streamExists) {
    return res.status(400).json({
      error: "Invalid streamId",
    });
  }

  console.log(match.status);

  if (match.status === "complete") {
    return res.status(409).json({
      error: `Match cannot be assigned from status: ${match.status}`,
    });
  }

  try {
    // 1. Push assignment to start.gg first
    await assignStreamToSet(matchId, streamId);

    // 2. If start.gg succeeds, update local state
    store.dispatch({
      type: "MATCH_ASSIGNED",
      matchId,
      streamId,
    });

    const updatedMatch = store.getState()[matchId];

    return res.json(updatedMatch);
  } catch (err) {
    console.error("Failed to assign stream on start.gg:", err);

    return res.status(502).json({
      error: "Failed to assign stream on start.gg",
    });
  }
});

app.post("/unassign", async (req, res) => {
  const { matchId } = req.body;

  if (!matchId) {
    return res.status(400).json({ error: "matchId is required" });
  }

  const match = store.getState()[matchId];

  if (!match) {
    return res.status(404).json({ error: "Match not found" });
  }

  try {
    await unassignStreamFromSet(matchId);

    store.dispatch({
      type: "MATCH_UNASSIGNED",
      matchId,
    });

    const updatedMatch = store.getState()[matchId];

    io.emit("MATCH_UPDATE", updatedMatch);

    return res.json(updatedMatch);
  } catch (err: any) {
    console.error(
      "Failed to unassign stream on start.gg:",
      err.response ?? err,
    );

    return res.status(502).json({
      error: "Failed to unassign stream on start.gg",
      details: err.response?.errors ?? err.message,
    });
  }
});

app.post("/start", async (req, res) => {
  const { matchId } = req.body;
  if (!matchId) {
    return res.status(400).json({ error: "matchId is required" });
  }

  const match = store.getState()[matchId];

  if (!match) {
    return res.status(404).json({ error: "Match not found" });
  }

  if (match.status !== "assigned") {
    return res.status(409).json({
      error: `Match cannot be started from status: ${match.status}`,
    });
  }

  try {
    await startSetOnStartGG(matchId);

    store.dispatch({
      type: "MATCH_STARTED",
      matchId,
    });

    const updatedMatch = store.getState()[matchId];

    return res.json(updatedMatch);
  } catch (err: any) {
    console.error("Failed to start match on start.gg:", err.response ?? err);

    return res.status(502).json({
      error: "Failed to start match on start.gg",
      details: err.response?.errors ?? err.message,
    });
  }
});

app.post("/updateScoreLocal", (req, res) => {
  const { matchId, score1, score2 } = req.body;

  if (!matchId) {
    return res.status(400).json({ error: "matchId is required" });
  }

  const match = store.getState()[matchId];

  if (!match) {
    return res.status(404).json({ error: "Match not found" });
  }

  if (match.status === "complete") {
    return res.status(409).json({
      error: `Cannot update score from status: ${match.status}`,
    });
  }

  store.dispatch({
    type: "SCORE_UPDATED",
    matchId,
    score1,
    score2,
  });

  return res.json(store.getState()[matchId]);
});

app.post("/saveResult", async (req, res) => {
  const { matchId } = req.body;

  const match = store.getState()[matchId];

  if (!match) {
    return res.status(404).json({ error: "Match not found" });
  }

  if (match.status === "complete") {
    return res.status(409).json({
      error: `Cannot save result from status: ${match.status}`,
    });
  }

  try {
    await saveScoresToStartGG(match);

    store.dispatch({
      type: "MATCH_RESULT_SAVED",
      matchId,
    });

    return res.json(store.getState()[matchId]);
  } catch (err: any) {
    console.error("Failed to save result:", err.response ?? err);

    return res.status(502).json({
      error: "Failed to save result to start.gg",
      details: err.response?.errors ?? err.message,
    });
  }
});

app.post("/submitFinal", async (req, res) => {
  const { matchId } = req.body;

  if (!matchId) {
    return res.status(400).json({ error: "matchId is required" });
  }

  const match = store.getState()[matchId];

  if (!match) {
    return res.status(404).json({ error: "Match not found" });
  }

  if (match.status !== "live" && match.status !== "saved") {
    return res.status(409).json({
      error: `Cannot submit final result from status: ${match.status}`,
    });
  }

  if (match.score1 === match.score2) {
    return res.status(400).json({
      error: "Cannot submit a tied result",
    });
  }

  try {
    await finalSubmitResultToStartGG(match);

    store.dispatch({
      type: "MATCH_COMPLETED",
      matchId,
    });

    return res.json(store.getState()[matchId]);
  } catch (err: any) {
    console.error("Failed to submit final result:", err.response ?? err);

    return res.status(502).json({
      error: "Failed to submit final result to start.gg",
      details: err.response?.errors ?? err.message,
    });
  }
});

app.post("/refresh", async (req, res) => {
  try {
    const result = await refreshFromStartGG();

    io.emit("STATE_SYNC", {
      matches: store.getState(),
      streams,
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    console.error("Refresh failed:", err.response ?? err);

    res.status(500).json({
      success: false,
      error: "Failed to refresh from start.gg",
      details: err.response?.errors ?? err.message,
    });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(webDistPath, "index.html"));
});

bootstrap().then(() => {
  server.listen(3001, () => {
    console.log("Server running on http://localhost:3001");
  });
});

(function () {
  "use strict";

  // ── Config ────────────────────────────────────────────────────────────────

  /** Read ?stream=<id> from URL; null = show first active match */
  const params = new URLSearchParams(window.location.search);
  const TARGET_STREAM_ID = params.get("stream") || null;
  const TARGET_DISPLAY_KEY = TARGET_STREAM_ID || "default";

  // ── DOM refs ──────────────────────────────────────────────────────────────

  const root        = document.getElementById("root");
  const p1Name      = document.getElementById("p1Name");
  const p2Name      = document.getElementById("p2Name");
  const p1Score     = document.getElementById("p1Score");
  const p2Score     = document.getElementById("p2Score");
  const p1Losers    = document.getElementById("p1Losers");
  const p2Losers    = document.getElementById("p2Losers");
  const matchLabel  = document.getElementById("matchLabel");
  const matchPill   = document.getElementById("matchPill");

  // ── State ─────────────────────────────────────────────────────────────────

  let currentMatch = null;
  let swapped = false;

  // ── Helpers ───────────────────────────────────────────────────────────────

  function flashScore(el) {
    el.classList.remove("flash");
    // Trigger reflow so the animation re-runs
    void el.offsetWidth;
    el.classList.add("flash");
  }

  function setTextFade(el, newText) {
    if (el.textContent === newText) return;
    el.classList.add("changing");
    setTimeout(() => {
      el.textContent = newText;
      el.classList.remove("changing");
    }, 200);
  }

  function updateVisibility(visible) {
    if (visible) {
      root.classList.remove("hidden");
      root.classList.add("visible");
    } else {
      root.classList.remove("visible");
      root.classList.add("hidden");
    }
  }

  function findMatch(matchMap) {
    if (!matchMap) return null;
    const matches = Object.values(matchMap);
    if (TARGET_STREAM_ID) {
      return matches.find(
        (m) => m.streamId === TARGET_STREAM_ID && m.status !== "complete"
      ) || null;
    }
    // No stream specified — prefer live, then saved, then assigned
    return (
      matches.find((m) => m.status === "live") ||
      matches.find((m) => m.status === "saved") ||
      matches.find((m) => m.status === "assigned" && m.streamId) ||
      null
    );
  }

  function renderMatch(match) {
    if (!match) {
      updateVisibility(false);
      currentMatch = null;
      return;
    }

    const isNew = !currentMatch || currentMatch.id !== match.id;

    // Determine display sides (respect swap)
    const leftPlayer  = swapped ? match.player2 : match.player1;
    const rightPlayer = swapped ? match.player1 : match.player2;
    const leftScore   = swapped ? match.score2  : match.score1;
    const rightScore  = swapped ? match.score1  : match.score2;

    // Player names
    setTextFade(p1Name, leftPlayer?.name ?? "P1");
    setTextFade(p2Name, rightPlayer?.name ?? "P2");

    // Scores
    const prevLeft  = parseInt(p1Score.textContent, 10);
    const prevRight = parseInt(p2Score.textContent, 10);

    if (isNew || leftScore !== prevLeft) {
      p1Score.textContent = String(leftScore);
      if (!isNew) flashScore(p1Score);
    }
    if (isNew || rightScore !== prevRight) {
      p2Score.textContent = String(rightScore);
      if (!isNew) flashScore(p2Score);
    }

    // Match label
    const label = match.round ? match.round.toUpperCase() : "";
    matchLabel.textContent = label;
    if (label) {
      matchPill.classList.remove("empty");
    } else {
      matchPill.classList.add("empty");
    }

    updateVisibility(true);
    currentMatch = match;
  }

  // ── Socket.io ─────────────────────────────────────────────────────────────

  const socket = io({ transports: ["websocket"] });

  socket.on("connect", () => {
    console.log("[scoreboard] connected");
  });

  socket.on("match:update", (matchMap) => {
    const match = findMatch(matchMap);
    renderMatch(match);
  });

  socket.on("scoreboard:display", (displayMap) => {
    const state = displayMap[TARGET_DISPLAY_KEY] || displayMap["default"];
    if (!state) return;

    const wasSwapped = swapped;
    swapped = state.swapped ?? false;
    updateVisibility(state.visible ?? true);

    // Re-render if swap changed
    if (wasSwapped !== swapped && currentMatch) {
      renderMatch(currentMatch);
    }
  });

  socket.on("disconnect", () => {
    console.warn("[scoreboard] disconnected — will reconnect automatically");
  });

  // Show initially as hidden until first data arrives
  root.classList.add("hidden");

})();

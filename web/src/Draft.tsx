import { useEffect, useState, useCallback } from "react";
import type { DraftState } from "./draftTypes";
import { io, Socket } from "socket.io-client";

const API_BASE = "http://localhost:3001";

// ── API helpers ──────────────────────────────────────────────────────────────

async function draftPost(path: string, body?: object): Promise<DraftState> {
  const res = await fetch(`${API_BASE}/draft${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Sub-components ───────────────────────────────────────────────────────────

interface CharCardProps {
  codename: string;
  displayName: string;
  imagePath: string;
  state: "normal" | "banned" | "picked" | "selected" | "unavailable";
  bannedBy?: 0 | 1;
  pickedBy?: 0 | 1;
  onClick?: () => void;
}

function CharCard({ displayName, imagePath, state, bannedBy, pickedBy, onClick }: CharCardProps) {
  const p1Color = "#ff7a6d";
  const p2Color = "#29b6f6";

  const borderColor =
    state === "selected"  ? "#fff" :
    state === "picked"    ? (pickedBy === 0 ? p1Color : p2Color) :
    state === "banned"    ? (bannedBy === 0 ? p1Color : p2Color) :
    "transparent";

  const opacity = state === "banned" || state === "unavailable" ? 0.35 : 1;
  const grayscale = state === "banned" || state === "unavailable" ? 1 : 0;
  const boxShadow = state === "picked"
    ? `0 0 14px ${pickedBy === 0 ? p1Color : p2Color}`
    : state === "selected"
    ? "0 0 18px rgba(255,255,255,0.7)"
    : "none";
  const cursor = onClick && state !== "banned" && state !== "unavailable" ? "pointer" : "default";

  return (
    <div
      onClick={onClick && state !== "banned" && state !== "unavailable" ? onClick : undefined}
      style={{
        position: "relative",
        border: `3px solid ${borderColor}`,
        borderRadius: 8,
        overflow: "hidden",
        opacity,
        filter: `grayscale(${grayscale})`,
        boxShadow,
        cursor,
        transition: "opacity 0.25s, box-shadow 0.25s, border-color 0.25s",
        aspectRatio: "1 / 1",
      }}
    >
      <img
        src={`${API_BASE}${imagePath}`}
        alt={displayName}
        style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top", display: "block" }}
        draggable={false}
      />
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "rgba(0,0,0,0.55)", padding: "3px 6px",
        textAlign: "center", fontSize: 13, fontWeight: 700,
        color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>
        {displayName}
      </div>
      {state === "selected" && (
        <div style={{
          position: "absolute", inset: 0,
          background: "rgba(255,255,255,0.08)",
          pointerEvents: "none",
        }} />
      )}
    </div>
  );
}

// ── Main Draft Component ─────────────────────────────────────────────────────

export default function Draft() {
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [error, setError] = useState<string | null>(null);

  const p1Color = "#ff7a6d";
  const p2Color = "#29b6f6";

  // ── Socket.io connection ──────────────────────────────────────────────────

  useEffect(() => {
    const s = io(API_BASE, { transports: ["websocket"] });
    s.on("draft:update", (state: DraftState) => setDraft(state));
    s.on("connect_error", () => setError("Cannot connect to server"));
    setSocket(s);
    return () => { s.disconnect(); };
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────

  const startDraft = useCallback(async () => {
    try {
      const state = await draftPost("/start");
      setDraft(state);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  const handleSelect = useCallback(async (codename: string) => {
    try {
      await draftPost("/select", { codename });
    } catch { /* ignored — server will reject invalid selections */ }
  }, []);

  const handleConfirm = useCallback(async () => {
    try {
      await draftPost("/confirm");
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  const handleUndo = useCallback(async () => {
    try { await draftPost("/undo"); } catch { }
  }, []);

  const handleRedo = useCallback(async () => {
    try { await draftPost("/redo"); } catch { }
  }, []);

  const handleRestart = useCallback(async () => {
    try { await draftPost("/restart"); } catch { }
  }, []);

  const handleWinner = useCallback(async (winner: 0 | 1) => {
    try { await draftPost("/match-winner", { winner }); } catch { }
  }, []);

  const handleGentlemans = useCallback(async () => {
    try { await draftPost("/gentlemans"); } catch { }
  }, []);

  // ── Derived state ─────────────────────────────────────────────────────────

  if (!draft || !draft.ruleset) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", gap: 16 }}>
        <p style={{ color: "#aaa" }}>No active draft.</p>
        <button onClick={startDraft} style={btnStyle("primary")}>Start Draft</button>
        {error && <p style={{ color: "#f66" }}>{error}</p>}
      </div>
    );
  }

  const { ruleset, phase, currPlayer, p1Name, p2Name, strikedBy, selectedCharacter, gentlemans, canUndo, canRedo, currGame } = draft;
  const chars = ruleset.characters;

  // Classify each character
  const p1Bans = new Set<string>();
  const p2Bans = new Set<string>();
  const p1Picks = new Set<string>();
  const p2Picks = new Set<string>();

  // Bans = first totalBans selections in strikedBy
  const allSelections: { codename: string; player: number }[] = [];
  const allSteps = Object.values(draft.strikedStages ?? {}) as string[][];
  allSteps.forEach((stepArr) => stepArr.forEach((c) => {
    const byP1 = strikedBy[0].includes(c);
    allSelections.push({ codename: c, player: byP1 ? 0 : 1 });
  }));

  let banCount = 0;
  for (const sel of allSelections) {
    if (banCount < ruleset.totalBans) {
      (sel.player === 0 ? p1Bans : p2Bans).add(sel.codename);
      banCount++;
    } else {
      (sel.player === 0 ? p1Picks : p2Picks).add(sel.codename);
    }
  }

  const allBanned = new Set([...p1Bans, ...p2Bans]);
  const allPicked = new Set([...p1Picks, ...p2Picks]);

  function getCharState(codename: string): CharCardProps["state"] {
    if (allBanned.has(codename)) return "banned";
    if (allPicked.has(codename)) return "picked";
    if (selectedCharacter === codename) return "selected";
    return "normal";
  }

  function getBannedBy(codename: string): 0 | 1 | undefined {
    if (p1Bans.has(codename)) return 0;
    if (p2Bans.has(codename)) return 1;
    return undefined;
  }

  function getPickedBy(codename: string): 0 | 1 | undefined {
    if (p1Picks.has(codename)) return 0;
    if (p2Picks.has(codename)) return 1;
    return undefined;
  }

  // Prompt text
  const playerName = currPlayer === 0 ? p1Name : currPlayer === 1 ? p2Name : null;
  const currPlayerColor = currPlayer === 0 ? p1Color : p2Color;

  let prompt = "";
  if (phase === "complete") {
    prompt = "Draft complete — good luck!";
  } else if (gentlemans) {
    prompt = "Gentleman's agreement — pick any character";
  } else if (phase === "ban" && playerName) {
    const needed = ruleset.strikeOrder[draft.currStep] ?? 0;
    const currStepBans = (draft.strikedStages[draft.currStep] ?? []).length;
    const remaining = needed - currStepBans;
    prompt = remaining > 0
      ? `${playerName}: ban ${remaining} character${remaining !== 1 ? "s" : ""}`
      : `${playerName}: confirm bans`;
  } else if (phase === "pick" && playerName) {
    prompt = selectedCharacter
      ? `${playerName}: confirm your pick`
      : `${playerName}: pick a character`;
  }

  // Can confirm?
  const currStepBans = (draft.strikedStages[draft.currStep] ?? []).length;
  const needed = phase === "ban" ? (ruleset.strikeOrder[draft.currStep] ?? 0) : 0;
  const canConfirm =
    phase === "pick"
      ? !!selectedCharacter
      : phase === "ban"
      ? currStepBans >= needed
      : false;

  const p1PickList = chars.filter((c) => p1Picks.has(c.codename));
  const p2PickList = chars.filter((c) => p2Picks.has(c.codename));
  const p1BanList  = chars.filter((c) => p1Bans.has(c.codename));
  const p2BanList  = chars.filter((c) => p2Bans.has(c.codename));

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#121212", color: "#fff", fontFamily: "sans-serif", overflow: "hidden" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 20px", background: "#1e1e1e", borderBottom: "1px solid #333", gap: 12, flexShrink: 0 }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 11, color: "#888", textTransform: "uppercase" }}>Game {currGame + 1}</span>
          <span style={{ fontSize: 15, fontWeight: 700 }}>
            <span style={{ color: p1Color }}>{p1Name}</span>
            <span style={{ color: "#666", margin: "0 8px" }}>vs</span>
            <span style={{ color: p2Color }}>{p2Name}</span>
          </span>
        </div>

        {/* Prompt */}
        <div style={{ flex: 1, textAlign: "center" }}>
          {playerName && phase !== "complete" && (
            <span style={{ fontSize: 16, fontWeight: 700, color: currPlayerColor }}>{prompt}</span>
          )}
          {(!playerName || phase === "complete") && (
            <span style={{ fontSize: 16, fontWeight: 700, color: "#ccc" }}>{prompt}</span>
          )}
        </div>

        {/* Controls */}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleUndo} disabled={!canUndo} style={btnStyle("ghost")}>↩ Undo</button>
          <button onClick={handleRedo} disabled={!canRedo} style={btnStyle("ghost")}>↪ Redo</button>
          <button onClick={handleGentlemans} style={btnStyle(gentlemans ? "active" : "ghost")}>🤝 Gents</button>
          <button onClick={handleRestart} style={btnStyle("danger")}>↺ Restart</button>
        </div>
      </div>

      {/* Three-panel layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", flex: 1, gap: 0, overflow: "hidden" }}>

        {/* P1 Panel */}
        <div style={{ background: "#161616", borderRight: `2px solid ${p1Color}22`, padding: 12, overflowY: "auto" }}>
          <div style={{ color: p1Color, fontWeight: 700, fontSize: 14, marginBottom: 10, borderBottom: `1px solid ${p1Color}44`, paddingBottom: 6 }}>
            {p1Name}
          </div>
          {p1PickList.length > 0 && (
            <>
              <div style={{ color: "#888", fontSize: 11, marginBottom: 6 }}>PICKS</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginBottom: 12 }}>
                {p1PickList.map((c) => (
                  <CharCard key={c.codename} {...c} state="picked" pickedBy={0} />
                ))}
              </div>
            </>
          )}
          {p1BanList.length > 0 && (
            <>
              <div style={{ color: "#888", fontSize: 11, marginBottom: 6 }}>BANS</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}>
                {p1BanList.map((c) => (
                  <CharCard key={c.codename} {...c} state="banned" bannedBy={0} />
                ))}
              </div>
            </>
          )}
          {phase === "complete" && (
            <button onClick={() => handleWinner(0)} style={{ ...btnStyle("primary"), width: "100%", marginTop: 12 }}>
              {p1Name} wins
            </button>
          )}
        </div>

        {/* Center grid */}
        <div style={{ padding: 16, overflowY: "auto", background: "#181818" }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
            gap: 10,
          }}>
            {chars.map((c) => {
              const cstate = getCharState(c.codename);
              const clickable = cstate === "normal" || cstate === "selected";
              return (
                <CharCard
                  key={c.codename}
                  {...c}
                  state={cstate}
                  bannedBy={getBannedBy(c.codename)}
                  pickedBy={getPickedBy(c.codename)}
                  onClick={clickable && currPlayer !== -1 ? () => handleSelect(c.codename) : undefined}
                />
              );
            })}
          </div>

          {/* Confirm button */}
          {canConfirm && phase !== "complete" && (
            <div style={{ textAlign: "center", marginTop: 20 }}>
              <button onClick={handleConfirm} style={{ ...btnStyle("primary"), fontSize: 18, padding: "12px 48px" }}>
                {phase === "pick" ? `Lock in ${selectedCharacter}` : "Confirm Bans"}
              </button>
            </div>
          )}
        </div>

        {/* P2 Panel */}
        <div style={{ background: "#161616", borderLeft: `2px solid ${p2Color}22`, padding: 12, overflowY: "auto" }}>
          <div style={{ color: p2Color, fontWeight: 700, fontSize: 14, marginBottom: 10, borderBottom: `1px solid ${p2Color}44`, paddingBottom: 6, textAlign: "right" }}>
            {p2Name}
          </div>
          {p2PickList.length > 0 && (
            <>
              <div style={{ color: "#888", fontSize: 11, marginBottom: 6, textAlign: "right" }}>PICKS</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginBottom: 12 }}>
                {p2PickList.map((c) => (
                  <CharCard key={c.codename} {...c} state="picked" pickedBy={1} />
                ))}
              </div>
            </>
          )}
          {p2BanList.length > 0 && (
            <>
              <div style={{ color: "#888", fontSize: 11, marginBottom: 6, textAlign: "right" }}>BANS</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}>
                {p2BanList.map((c) => (
                  <CharCard key={c.codename} {...c} state="banned" bannedBy={1} />
                ))}
              </div>
            </>
          )}
          {phase === "complete" && (
            <button onClick={() => handleWinner(1)} style={{ ...btnStyle("secondary"), width: "100%", marginTop: 12 }}>
              {p2Name} wins
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ padding: "6px 16px", background: "#5c1515", color: "#f88", fontSize: 13, flexShrink: 0 }}>{error}</div>
      )}
    </div>
  );
}

// ── Style helpers ────────────────────────────────────────────────────────────

function btnStyle(variant: "primary" | "secondary" | "ghost" | "danger" | "active"): React.CSSProperties {
  const base: React.CSSProperties = {
    border: "none",
    borderRadius: 6,
    padding: "7px 16px",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    transition: "opacity 0.15s",
  };
  const variants: Record<string, React.CSSProperties> = {
    primary:   { background: "#0066cc", color: "#fff" },
    secondary: { background: "#29b6f6", color: "#000" },
    ghost:     { background: "#2c2c2c", color: "#ccc" },
    danger:    { background: "#8b1a1a", color: "#fff" },
    active:    { background: "#2e5e2e", color: "#7ef" },
  };
  return { ...base, ...variants[variant] };
}

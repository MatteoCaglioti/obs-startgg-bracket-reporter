import { useEffect, useState, useCallback, useRef } from "react";
import type { DraftState, DraftCharacter } from "./draftTypes";
import { io, Socket } from "socket.io-client";

const API_BASE = "http://localhost:3001";
const TEAM_A_COLOR = "#ff7a6d";
const TEAM_B_COLOR = "#29b6f6";

// ── API helpers ──────────────────────────────────────────────────────────────

async function draftPost(endpoint: string, body?: object): Promise<DraftState> {
  const res = await fetch(`${API_BASE}/draft${endpoint}`, {
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

// ── Style helpers ────────────────────────────────────────────────────────────

function btn(variant: "primary" | "secondary" | "ghost" | "danger" | "teamA" | "teamB"): React.CSSProperties {
  const base: React.CSSProperties = {
    border: "none", borderRadius: 8, padding: "10px 20px",
    fontSize: 14, fontWeight: 700, cursor: "pointer",
    transition: "opacity 0.15s, transform 0.1s", minHeight: 44,
  };
  const v: Record<string, React.CSSProperties> = {
    primary:   { background: "#0066cc", color: "#fff" },
    secondary: { background: "#2c2c2c", color: "#ccc" },
    ghost:     { background: "transparent", color: "#888", border: "1px solid #333" },
    danger:    { background: "#7a1a1a", color: "#fff" },
    teamA:     { background: TEAM_A_COLOR, color: "#000" },
    teamB:     { background: TEAM_B_COLOR, color: "#000" },
  };
  return { ...base, ...v[variant] };
}

// ── Character card ────────────────────────────────────────────────────────────

type CharState = "normal" | "banned" | "pickedA" | "pickedB" | "selected";

interface CharCardProps {
  char: DraftCharacter;
  state: CharState;
  onClick?: () => void;
  size?: number;
}

function CharCard({ char, state, onClick, size = 90 }: CharCardProps) {
  const isBanned = state === "banned";
  const isPickedA = state === "pickedA";
  const isPickedB = state === "pickedB";
  const isSelected = state === "selected";
  const isUnavailable = isBanned || isPickedA || isPickedB;

  const borderColor = isSelected ? "#fff"
    : isPickedA ? TEAM_A_COLOR
    : isPickedB ? TEAM_B_COLOR
    : "transparent";

  const boxShadow = isSelected ? "0 0 20px rgba(255,255,255,0.8)"
    : isPickedA ? `0 0 12px ${TEAM_A_COLOR}`
    : isPickedB ? `0 0 12px ${TEAM_B_COLOR}`
    : "none";

  return (
    <div
      onClick={!isUnavailable && onClick ? onClick : undefined}
      title={char.displayName}
      style={{
        position: "relative",
        width: size, height: size,
        borderRadius: 8, overflow: "hidden",
        border: `2px solid ${borderColor}`,
        boxShadow,
        opacity: isBanned ? 0.35 : 1,
        filter: isBanned ? "grayscale(1)" : "none",
        cursor: !isUnavailable && onClick ? "pointer" : "default",
        transition: "opacity 0.2s, box-shadow 0.2s, border-color 0.2s",
        flexShrink: 0,
      }}
    >
      <img
        src={`${API_BASE}${char.imagePath}`}
        alt={char.displayName}
        draggable={false}
        style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top", display: "block" }}
      />
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "rgba(0,0,0,0.6)", padding: "3px 4px",
        textAlign: "center", fontSize: 10, fontWeight: 700, color: "#fff",
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>
        {char.displayName}
      </div>
      {isSelected && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.1)", pointerEvents: "none" }} />
      )}
    </div>
  );
}

// ── Slot row (picks/bans sidebar) ─────────────────────────────────────────────

function SlotRow({ chars, count, type, team }: {
  chars: DraftCharacter[];
  count: number;
  type: "pick" | "ban";
  team: "A" | "B";
}) {
  const color = team === "A" ? TEAM_A_COLOR : TEAM_B_COLOR;
  const slots = Array.from({ length: count }, (_, i) => chars[i] ?? null);

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {slots.map((c, i) => c ? (
        <CharCard
          key={c.codename}
          char={c}
          state={type === "pick" ? (team === "A" ? "pickedA" : "pickedB") : "banned"}
          size={52}
        />
      ) : (
        <div key={i} style={{
          width: 52, height: 52, borderRadius: 8,
          border: "2px dashed #333",
          background: "rgba(255,255,255,0.02)",
          flexShrink: 0,
        }} />
      ))}
    </div>
  );
}

// ── Team column ───────────────────────────────────────────────────────────────

function TeamColumn({ name, color, picks, bans, pickSlots, banSlots, allChars, isActive }: {
  name: string;
  color: string;
  picks: string[];
  bans: string[];
  pickSlots: number;
  banSlots: number;
  allChars: DraftCharacter[];
  isActive: boolean;
}) {
  const findChar = (codename: string) => allChars.find(c => c.codename === codename)!;
  const pickChars = picks.map(findChar).filter(Boolean);
  const banChars = bans.map(findChar).filter(Boolean);
  const team = color === TEAM_A_COLOR ? "A" : "B";

  return (
    <div style={{
      background: "#1a1a1a", borderRadius: 10, padding: "12px 14px",
      border: `2px solid ${isActive ? color : "#2a2a2a"}`,
      minWidth: 200, maxWidth: 280, flex: "0 0 auto",
      transition: "border-color 0.3s",
      boxShadow: isActive ? `0 0 16px ${color}44` : "none",
    }}>
      <div style={{ fontSize: 15, fontWeight: 800, color, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
        {name}
        {isActive && <span style={{ fontSize: 10, marginLeft: 8, color: "#fff", background: color, padding: "2px 6px", borderRadius: 10, verticalAlign: "middle" }}>YOUR TURN</span>}
      </div>
      <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Picks</div>
      <SlotRow chars={pickChars} count={pickSlots} type="pick" team={team as "A" | "B"} />
      <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 1, marginTop: 10, marginBottom: 6 }}>Bans</div>
      <SlotRow chars={banChars} count={banSlots} type="ban" team={team as "A" | "B"} />
    </div>
  );
}

// ── Idle phase ────────────────────────────────────────────────────────────────

function IdlePhase({ onStart, error }: { onStart: (t1: string, t2: string) => void; error: string | null }) {
  const [t1, setT1] = useState("");
  const [t2, setT2] = useState("");

  const inputStyle: React.CSSProperties = {
    background: "#1a1a1a", border: "1px solid #333", borderRadius: 8,
    color: "#fff", padding: "10px 14px", fontSize: 16, width: "100%",
    boxSizing: "border-box", outline: "none",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 24 }}>
      <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", letterSpacing: 2 }}>SF3TS 3v3 DRAFT</div>
      <div style={{ display: "flex", gap: 16, width: "100%", maxWidth: 520 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: TEAM_A_COLOR, marginBottom: 6, fontWeight: 700, textTransform: "uppercase" }}>Team 1</div>
          <input style={inputStyle} value={t1} onChange={e => setT1(e.target.value)} placeholder="Team 1 name" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: TEAM_B_COLOR, marginBottom: 6, fontWeight: 700, textTransform: "uppercase" }}>Team 2</div>
          <input style={inputStyle} value={t2} onChange={e => setT2(e.target.value)} placeholder="Team 2 name" />
        </div>
      </div>
      <button onClick={() => onStart(t1, t2)} style={{ ...btn("primary"), fontSize: 18, padding: "14px 48px", minWidth: 200 }}>
        Start Draft
      </button>
      {error && <div style={{ color: "#f88", fontSize: 13 }}>{error}</div>}
    </div>
  );
}

// ── RPS phase ─────────────────────────────────────────────────────────────────

function RpsPhase({ state, onWinner }: { state: DraftState; onWinner: (w: 1 | 2) => void }) {
  const t1 = state.pendingTeam1Name || "Team 1";
  const t2 = state.pendingTeam2Name || "Team 2";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 32 }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", textAlign: "center" }}>
        Who won Rock Paper Scissors?
      </div>
      <div style={{ fontSize: 13, color: "#888", textAlign: "center" }}>The RPS winner chooses their team name and goes first in the draft.</div>
      <div style={{ display: "flex", gap: 20 }}>
        <button onClick={() => onWinner(1)} style={{ ...btn("teamA"), fontSize: 20, padding: "16px 40px", minWidth: 180 }}>
          {t1}
        </button>
        <button onClick={() => onWinner(2)} style={{ ...btn("teamB"), fontSize: 20, padding: "16px 40px", minWidth: 180 }}>
          {t2}
        </button>
      </div>
    </div>
  );
}

// ── Complete phase ────────────────────────────────────────────────────────────

function CompletePhase({ state, onRestart }: { state: DraftState; onRestart: () => void }) {
  const { ruleset, teamAName, teamBName, teamAPicks, teamBPicks } = state;
  if (!ruleset) return null;
  const findChar = (codename: string) => ruleset.characters.find(c => c.codename === codename)!;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 32, padding: 20 }}>
      <div style={{ fontSize: 24, fontWeight: 800, color: "#fff", letterSpacing: 2 }}>DRAFT COMPLETE</div>
      <div style={{ display: "flex", gap: 40, flexWrap: "wrap", justifyContent: "center" }}>
        {([["A", teamAName, teamAPicks, TEAM_A_COLOR], ["B", teamBName, teamBPicks, TEAM_B_COLOR]] as const).map(([team, name, picks, color]) => (
          <div key={team} style={{ background: "#1a1a1a", border: `2px solid ${color}`, borderRadius: 12, padding: "20px 24px", textAlign: "center", minWidth: 220 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color, marginBottom: 16, textTransform: "uppercase" }}>{name}</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              {picks.map(codename => {
                const c = findChar(codename);
                return c ? <CharCard key={codename} char={c} state={team === "A" ? "pickedA" : "pickedB"} size={80} /> : null;
              })}
            </div>
          </div>
        ))}
      </div>
      <button onClick={onRestart} style={{ ...btn("secondary"), fontSize: 16, padding: "12px 36px" }}>
        ↺ New Draft
      </button>
    </div>
  );
}

// ── Main Draft Component ─────────────────────────────────────────────────────

export default function Draft() {
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [selectedChar, setSelectedChar] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // ── Socket.io ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const s = io(API_BASE, { transports: ["websocket", "polling"], query: { stream: "default" } });
    s.on("draft:update", (state: DraftState) => {
      setDraft(state);
      // Clear selection when phase changes or step advances
      setSelectedChar(null);
    });
    s.on("connect_error", () => setError("Cannot connect to server"));
    socketRef.current = s;

    // Fetch initial state
    fetch(`${API_BASE}/draft`).then(r => r.json()).then(setDraft).catch(() => {});

    return () => { s.disconnect(); };
  }, []);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleStart = useCallback(async (team1Name: string, team2Name: string) => {
    try {
      const state = await draftPost("/start", { team1Name, team2Name });
      setDraft(state);
      setError(null);
    } catch (e: any) { setError(e.message); }
  }, []);

  const handleRpsWinner = useCallback(async (winner: 1 | 2) => {
    try { await draftPost("/rps-winner", { winner }); }
    catch (e: any) { setError(e.message); }
  }, []);

  const handleBan = useCallback(async (codename: string) => {
    try { await draftPost("/ban", { codename }); }
    catch (e: any) { setError(e.message); }
  }, []);

  const handlePickSelect = useCallback((codename: string) => {
    setSelectedChar(prev => prev === codename ? null : codename);
  }, []);

  const handlePickConfirm = useCallback(async () => {
    if (!selectedChar) return;
    try {
      await draftPost("/pick", { codename: selectedChar });
      setSelectedChar(null);
    } catch (e: any) { setError(e.message); }
  }, [selectedChar]);

  const handleUndo = useCallback(async () => {
    try { await draftPost("/undo"); setSelectedChar(null); } catch { }
  }, []);

  const handleRedo = useCallback(async () => {
    try { await draftPost("/redo"); setSelectedChar(null); } catch { }
  }, []);

  const handleRestart = useCallback(async () => {
    try { await draftPost("/restart"); setSelectedChar(null); } catch { }
  }, []);

  // ── Loading state ──────────────────────────────────────────────────────────

  if (!draft) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0f0f0f", color: "#666" }}>
        Connecting…
      </div>
    );
  }

  const { phase, ruleset } = draft;

  const root: React.CSSProperties = {
    display: "flex", flexDirection: "column", height: "100vh",
    background: "#0f0f0f", color: "#fff", fontFamily: "'Segoe UI', sans-serif",
    overflow: "hidden",
  };

  // ── Idle ───────────────────────────────────────────────────────────────────
  if (phase === "idle") {
    return (
      <div style={root}>
        <IdlePhase onStart={handleStart} error={error} />
      </div>
    );
  }

  // ── RPS ────────────────────────────────────────────────────────────────────
  if (phase === "rps") {
    return (
      <div style={root}>
        <RpsPhase state={draft} onWinner={handleRpsWinner} />
      </div>
    );
  }

  // ── Complete ───────────────────────────────────────────────────────────────
  if (phase === "complete") {
    return (
      <div style={root}>
        <CompletePhase state={draft} onRestart={handleRestart} />
      </div>
    );
  }

  // ── Ban / Pick phases ──────────────────────────────────────────────────────
  if (!ruleset) return null;

  const {
    teamAName, teamBName,
    teamABans, teamBBans, teamAPicks, teamBPicks,
    currentTeam, canUndo, canRedo,
  } = draft;

  const allChars = ruleset.characters;
  const allBanned = new Set([...teamABans, ...teamBBans]);
  const allPicked = new Set([...teamAPicks, ...teamBPicks]);

  const bansPerTeam = { a: 0, b: 0 };
  ruleset.banOrder.forEach(t => t === 0 ? bansPerTeam.a++ : bansPerTeam.b++);

  const actingName = currentTeam === 0 ? teamAName : teamBName;
  const actingColor = currentTeam === 0 ? TEAM_A_COLOR : TEAM_B_COLOR;

  let prompt = "";
  if (phase === "ban") {
    prompt = `${actingName}: Ban a character`;
  } else if (phase === "pick") {
    prompt = selectedChar ? `${actingName}: Confirm your pick` : `${actingName}: Pick a character`;
  }

  function getCharState(codename: string): CharState {
    if (allBanned.has(codename)) return "banned";
    if (teamAPicks.includes(codename)) return "pickedA";
    if (teamBPicks.includes(codename)) return "pickedB";
    if (selectedChar === codename) return "selected";
    return "normal";
  }

  return (
    <div style={root}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 20px", background: "#161616", borderBottom: "1px solid #2a2a2a",
        flexShrink: 0, gap: 12,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>
          <span style={{ color: TEAM_A_COLOR }}>{teamAName}</span>
          <span style={{ color: "#444", margin: "0 8px" }}>vs</span>
          <span style={{ color: TEAM_B_COLOR }}>{teamBName}</span>
        </div>

        <div style={{ flex: 1, textAlign: "center" }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: actingColor }}>{prompt}</span>
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={handleUndo} disabled={!canUndo} style={{ ...btn("ghost"), opacity: canUndo ? 1 : 0.3, padding: "6px 14px" }}>↩ Undo</button>
          <button onClick={handleRedo} disabled={!canRedo} style={{ ...btn("ghost"), opacity: canRedo ? 1 : 0.3, padding: "6px 14px" }}>↪ Redo</button>
          <button onClick={handleRestart} style={{ ...btn("danger"), padding: "6px 14px" }}>↺ Restart</button>
        </div>
      </div>

      {/* Main area */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", gap: 0 }}>
        {/* Team A sidebar */}
        <div style={{ padding: "12px 10px 12px 14px", borderRight: "1px solid #2a2a2a", overflowY: "auto", flexShrink: 0 }}>
          <TeamColumn
            name={teamAName}
            color={TEAM_A_COLOR}
            picks={teamAPicks}
            bans={teamABans}
            pickSlots={ruleset.teamSize}
            banSlots={bansPerTeam.a}
            allChars={allChars}
            isActive={currentTeam === 0}
          />
        </div>

        {/* Character grid */}
        <div style={{ flex: 1, padding: 16, overflowY: "auto", background: "#111" }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))",
            gap: 10,
          }}>
            {allChars.map(c => {
              const cstate = getCharState(c.codename);
              const clickable = cstate === "normal" || (phase === "pick" && cstate === "selected");
              return (
                <CharCard
                  key={c.codename}
                  char={c}
                  state={cstate}
                  size={90}
                  onClick={clickable ? () => {
                    if (phase === "ban") handleBan(c.codename);
                    else if (phase === "pick") handlePickSelect(c.codename);
                  } : undefined}
                />
              );
            })}
          </div>

          {phase === "pick" && selectedChar && (
            <div style={{ textAlign: "center", marginTop: 20 }}>
              <button
                onClick={handlePickConfirm}
                style={{ ...btn("primary"), fontSize: 18, padding: "14px 48px" }}
              >
                Lock in {allChars.find(c => c.codename === selectedChar)?.displayName}
              </button>
            </div>
          )}
        </div>

        {/* Team B sidebar */}
        <div style={{ padding: "12px 14px 12px 10px", borderLeft: "1px solid #2a2a2a", overflowY: "auto", flexShrink: 0 }}>
          <TeamColumn
            name={teamBName}
            color={TEAM_B_COLOR}
            picks={teamBPicks}
            bans={teamBBans}
            pickSlots={ruleset.teamSize}
            banSlots={bansPerTeam.b}
            allChars={allChars}
            isActive={currentTeam === 1}
          />
        </div>
      </div>

      {error && (
        <div style={{ padding: "6px 16px", background: "#5c1515", color: "#f88", fontSize: 13, flexShrink: 0 }}>
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 10, background: "none", border: "none", color: "#f88", cursor: "pointer" }}>✕</button>
        </div>
      )}
    </div>
  );
}

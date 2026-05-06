import { useEffect, useState, useCallback } from "react";
import type { DraftState, DraftCharacter } from "./draftTypes";
import { io } from "socket.io-client";
import styles from "./Draft.module.css";

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

// ── Character card ────────────────────────────────────────────────────────────

type CharState = "normal" | "banned" | "pickedA" | "pickedB" | "selected";

interface CharCardProps {
  char: DraftCharacter;
  state: CharState;
  onClick?: () => void;
  size?: number;
}

function CharCard({ char, state, onClick, size = 90 }: CharCardProps) {
  const isBanned      = state === "banned";
  const isPickedA     = state === "pickedA";
  const isPickedB     = state === "pickedB";
  const isSelected    = state === "selected";
  const isUnavailable = isBanned || isPickedA || isPickedB;
  const isClickable   = !isUnavailable && !!onClick;

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
      onClick={isClickable ? onClick : undefined}
      title={char.displayName}
      className={`${styles.charCard} ${isClickable ? styles.charCardClickable : ""}`}
      style={{ width: size, height: size, borderColor, boxShadow, opacity: isBanned ? 0.35 : 1, filter: isBanned ? "grayscale(1)" : "none" }}
    >
      <img src={`${API_BASE}${char.imagePath}`} alt={char.displayName} draggable={false} className={styles.charCardImg} />
      <div className={styles.charCardLabel}>{char.displayName}</div>
      {isSelected && <div className={styles.charCardSelectedOverlay} />}
    </div>
  );
}

// ── Slot row ──────────────────────────────────────────────────────────────────

function SlotRow({ chars, count, type, team }: { chars: DraftCharacter[]; count: number; type: "pick" | "ban"; team: "A" | "B" }) {
  const slots = Array.from({ length: count }, (_, i) => chars[i] ?? null);
  return (
    <div className={styles.slotRow}>
      {slots.map((c, i) => c
        ? <CharCard key={c.codename} char={c} state={type === "pick" ? (team === "A" ? "pickedA" : "pickedB") : "banned"} size={52} />
        : <div key={i} className={styles.emptySlot} style={{ width: 52, height: 52 }} />
      )}
    </div>
  );
}

// ── Team column ───────────────────────────────────────────────────────────────

function TeamColumn({ name, color, picks, bans, pickSlots, banSlots, allChars, isActive }: {
  name: string; color: string; picks: string[]; bans: string[];
  pickSlots: number; banSlots: number; allChars: DraftCharacter[]; isActive: boolean;
}) {
  const findChar = (codename: string) => allChars.find(c => c.codename === codename)!;
  const team = color === TEAM_A_COLOR ? "A" : "B";
  return (
    <div className={`${styles.teamColumn} ${isActive ? styles.teamColumnActive : ""}`} style={{ "--team-color": color } as React.CSSProperties}>
      <div className={styles.teamColumnName}>
        {name}
        {isActive && <span className={styles.turnBadge}>YOUR TURN</span>}
      </div>
      <div className={styles.sectionLabel}>Picks</div>
      <SlotRow chars={picks.map(findChar).filter(Boolean)} count={pickSlots} type="pick" team={team as "A" | "B"} />
      <div className={styles.sectionLabel}>Bans</div>
      <SlotRow chars={bans.map(findChar).filter(Boolean)} count={banSlots} type="ban" team={team as "A" | "B"} />
    </div>
  );
}

// ── Idle phase ────────────────────────────────────────────────────────────────

function IdlePhase({ onStart, error }: { onStart: (t1: string, t2: string) => void; error: string | null }) {
  const [t1, setT1] = useState("");
  const [t2, setT2] = useState("");
  return (
    <div className={styles.idleRoot}>
      <div className={styles.idleTitle}>SF3TS 3v3 DRAFT</div>
      <div className={styles.idleInputRow}>
        <div className={styles.idleInputGroup} style={{ "--team-color": TEAM_A_COLOR } as React.CSSProperties}>
          <label className={styles.idleInputLabel}>Team 1</label>
          <input className={styles.idleInput} value={t1} onChange={e => setT1(e.target.value)} placeholder="Team 1 name" />
        </div>
        <div className={styles.idleInputGroup} style={{ "--team-color": TEAM_B_COLOR } as React.CSSProperties}>
          <label className={styles.idleInputLabel}>Team 2</label>
          <input className={styles.idleInput} value={t2} onChange={e => setT2(e.target.value)} placeholder="Team 2 name" />
        </div>
      </div>
      <button onClick={() => onStart(t1, t2)} className={`${styles.btn} ${styles.btnPrimary} ${styles.btnLarge}`}>
        Start Draft
      </button>
      {error && <div className={styles.errorBar}>{error}</div>}
    </div>
  );
}

// ── RPS phase ─────────────────────────────────────────────────────────────────

function RpsPhase({ state, onWinner }: { state: DraftState; onWinner: (w: 1 | 2) => void }) {
  const t1 = state.pendingTeam1Name || "Team 1";
  const t2 = state.pendingTeam2Name || "Team 2";
  return (
    <div className={styles.rpsRoot}>
      <div className={styles.rpsTitle}>Who won Rock Paper Scissors?</div>
      <div className={styles.rpsSubtitle}>The RPS winner chooses their team name and goes first in the draft.</div>
      <div className={styles.rpsBtns}>
        <button onClick={() => onWinner(1)} className={`${styles.btn} ${styles.btnTeam} ${styles.btnXlarge}`} style={{ "--team-color": TEAM_A_COLOR } as React.CSSProperties}>{t1}</button>
        <button onClick={() => onWinner(2)} className={`${styles.btn} ${styles.btnTeam} ${styles.btnXlarge}`} style={{ "--team-color": TEAM_B_COLOR } as React.CSSProperties}>{t2}</button>
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
    <div className={styles.completeRoot}>
      <div className={styles.completeTitle}>DRAFT COMPLETE</div>
      <div className={styles.completeTeams}>
        {([["A", teamAName, teamAPicks, TEAM_A_COLOR], ["B", teamBName, teamBPicks, TEAM_B_COLOR]] as const).map(([team, name, picks, color]) => (
          <div key={team} className={styles.completeTeamCard} style={{ "--team-color": color } as React.CSSProperties}>
            <div className={styles.completeTeamName}>{name}</div>
            <div className={styles.completePickRow}>
              {picks.map(codename => {
                const c = findChar(codename);
                return c ? <CharCard key={codename} char={c} state={team === "A" ? "pickedA" : "pickedB"} size={80} /> : null;
              })}
            </div>
          </div>
        ))}
      </div>
      <button onClick={onRestart} className={`${styles.btn} ${styles.btnSecondary}`} style={{ fontSize: 16, padding: "12px 36px" }}>
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

  useEffect(() => {
    const socket = io(API_BASE, { transports: ["websocket", "polling"] });
    socket.on("draft:update", (state: DraftState) => { setDraft(state); setSelectedChar(null); });
    socket.on("connect_error", () => setError("Cannot connect to server"));
    fetch(`${API_BASE}/draft`).then(r => r.json()).then(setDraft).catch(() => {});
    return () => { socket.disconnect(); };
  }, []);

  const handleStart      = useCallback(async (t1: string, t2: string) => {
    try { setDraft(await draftPost("/start", { team1Name: t1, team2Name: t2 })); setError(null); }
    catch (e: any) { setError(e.message); }
  }, []);
  const handleRpsWinner  = useCallback(async (w: 1 | 2) => { try { await draftPost("/rps-winner", { winner: w }); } catch (e: any) { setError(e.message); } }, []);
  const handleBan        = useCallback(async (c: string) => { try { await draftPost("/ban", { codename: c }); } catch (e: any) { setError(e.message); } }, []);
  const handlePickSelect = useCallback((c: string) => setSelectedChar(p => p === c ? null : c), []);
  const handlePickConfirm = useCallback(async () => {
    if (!selectedChar) return;
    try { await draftPost("/pick", { codename: selectedChar }); setSelectedChar(null); }
    catch (e: any) { setError(e.message); }
  }, [selectedChar]);
  const handleUndo    = useCallback(async () => { try { await draftPost("/undo");    setSelectedChar(null); } catch { } }, []);
  const handleRedo    = useCallback(async () => { try { await draftPost("/redo");    setSelectedChar(null); } catch { } }, []);
  const handleRestart = useCallback(async () => { try { await draftPost("/restart"); setSelectedChar(null); } catch { } }, []);

  if (!draft) return <div className={styles.connecting}>Connecting…</div>;

  const { phase, ruleset } = draft;

  if (phase === "idle")     return <div className={styles.root}><IdlePhase onStart={handleStart} error={error} /></div>;
  if (phase === "rps")      return <div className={styles.root}><RpsPhase state={draft} onWinner={handleRpsWinner} /></div>;
  if (phase === "complete") return <div className={styles.root}><CompletePhase state={draft} onRestart={handleRestart} /></div>;
  if (!ruleset)             return null;

  const { teamAName, teamBName, teamABans, teamBBans, teamAPicks, teamBPicks, currentTeam, canUndo, canRedo } = draft;
  const allChars  = ruleset.characters;
  const allBanned = new Set([...teamABans, ...teamBBans]);
  const bansPerTeam = { a: 0, b: 0 };
  ruleset.banOrder.forEach(t => t === 0 ? bansPerTeam.a++ : bansPerTeam.b++);

  const actingColor = currentTeam === 0 ? TEAM_A_COLOR : TEAM_B_COLOR;
  const actingName  = currentTeam === 0 ? teamAName    : teamBName;
  const prompt = phase === "ban"  ? `${actingName}: Ban a character`
    : selectedChar                ? `${actingName}: Confirm your pick`
    :                               `${actingName}: Pick a character`;

  function getCharState(codename: string): CharState {
    if (allBanned.has(codename))       return "banned";
    if (teamAPicks.includes(codename)) return "pickedA";
    if (teamBPicks.includes(codename)) return "pickedB";
    if (selectedChar === codename)     return "selected";
    return "normal";
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.headerMatchup}>
          <span style={{ color: TEAM_A_COLOR }}>{teamAName}</span>
          <span style={{ color: "#444", margin: "0 8px" }}>vs</span>
          <span style={{ color: TEAM_B_COLOR }}>{teamBName}</span>
        </div>
        <div className={styles.headerPrompt} style={{ color: actingColor }}>{prompt}</div>
        <div className={styles.headerActions}>
          <button onClick={handleUndo}    disabled={!canUndo} className={`${styles.btn} ${styles.btnGhost} ${styles.btnSmall}`}>↩ Undo</button>
          <button onClick={handleRedo}    disabled={!canRedo} className={`${styles.btn} ${styles.btnGhost} ${styles.btnSmall}`}>↪ Redo</button>
          <button onClick={handleRestart}                     className={`${styles.btn} ${styles.btnDanger} ${styles.btnSmall}`}>↺ Restart</button>
        </div>
      </div>

      <div className={styles.main}>
        <div className={styles.sidebar}>
          <TeamColumn name={teamAName} color={TEAM_A_COLOR} picks={teamAPicks} bans={teamABans} pickSlots={ruleset.teamSize} banSlots={bansPerTeam.a} allChars={allChars} isActive={currentTeam === 0} />
        </div>
        <div className={styles.gridArea}>
          <div className={styles.charGrid}>
            {allChars.map(c => {
              const cstate = getCharState(c.codename);
              const isClickable = cstate === "normal" || (phase === "pick" && cstate === "selected");
              return (
                <CharCard key={c.codename} char={c} state={cstate} size={90}
                  onClick={isClickable ? () => { if (phase === "ban") handleBan(c.codename); else handlePickSelect(c.codename); } : undefined}
                />
              );
            })}
          </div>
          {phase === "pick" && selectedChar && (
            <div className={styles.confirmRow}>
              <button onClick={handlePickConfirm} className={`${styles.btn} ${styles.btnPrimary} ${styles.btnLarge}`}>
                Lock in {allChars.find(c => c.codename === selectedChar)?.displayName}
              </button>
            </div>
          )}
        </div>
        <div className={styles.sidebarRight}>
          <TeamColumn name={teamBName} color={TEAM_B_COLOR} picks={teamBPicks} bans={teamBBans} pickSlots={ruleset.teamSize} banSlots={bansPerTeam.b} allChars={allChars} isActive={currentTeam === 1} />
        </div>
      </div>

      {error && (
        <div className={styles.errorBar}>
          {error}
          <button className={styles.errorDismiss} onClick={() => setError(null)}>✕</button>
        </div>
      )}
    </div>
  );
}

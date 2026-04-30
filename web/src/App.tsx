import { useEffect, useMemo, useState } from "react";
import { socket } from "./socket";
import {
  assignMatch,
  unassignMatch,
  startMatch,
  updateScore,
  getMatches,
  getStreams,
  saveResult,
  refreshStartGG,
  submitFinalResult,
} from "./api";
import type { Match, TournamentStream } from "./types";

type ActionState = {
  label: string;
  type: "idle" | "loading" | "success" | "error";
  message: string;
};

const initialActionState: ActionState = {
  label: "Ready",
  type: "idle",
  message: "Select a stream and assign a match to begin.",
};

function statusLabel(status: Match["status"]) {
  const labels: Record<Match["status"], string> = {
    idle: "Queued",
    assigned: "Assigned",
    live: "Live",
    saved: "Saved",
    complete: "Complete",
  };

  return labels[status];
}

function getWinner(match: Match) {
  if (match.score1 === match.score2) return null;
  return match.score1 > match.score2 ? match.player1.name : match.player2.name;
}

export default function App() {
  const [matches, setMatches] = useState<Record<string, Match>>({});
  const [currentMatch, setCurrentMatch] = useState<Match | null>(null);
  const [streams, setStreams] = useState<TournamentStream[]>([]);
  const [selectedStream, setSelectedStream] = useState<string>("");
  const [actionState, setActionState] =
    useState<ActionState>(initialActionState);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const selectedStreamName =
    streams.find((stream) => stream.id === selectedStream)?.name ??
    "No stream selected";

  const matchesArray = useMemo(() => Object.values(matches), [matches]);

  const availableMatches = useMemo(
    () =>
      matchesArray
        .filter((match) => !match.streamId && match.status !== "complete")
        .sort((a, b) => a.round.localeCompare(b.round)),
    [matchesArray],
  );

  useEffect(() => {
    const handleStateSync = (data: {
      matches: Record<string, Match>;
      streams: TournamentStream[];
    }) => {
      setMatches(data.matches);
      setStreams(data.streams);

      const nextMatches = Object.values(data.matches) as Match[];
      const matchForSelectedStream =
        nextMatches.find(
          (match) =>
            match.streamId === selectedStream && match.status !== "complete",
        ) ?? null;

      setCurrentMatch(matchForSelectedStream);
    };

    socket.on("STATE_SYNC", handleStateSync);

    return () => {
      socket.off("STATE_SYNC", handleStateSync);
    };
  }, [selectedStream]);

  useEffect(() => {
    async function loadInitialData() {
      setBusyAction("load");
      try {
        const [matchData, streamData] = await Promise.all([
          getMatches(),
          getStreams(),
        ]);
        setMatches(matchData);
        setStreams(streamData);
        setSelectedStream(streamData[0]?.id ?? "");
        setActionState({
          label: "Synced",
          type: "success",
          message: "Matches and streams are loaded.",
        });
      } catch (error) {
        console.error(error);
        setActionState({
          label: "Load failed",
          type: "error",
          message:
            "Could not load the dashboard data. Check the backend connection.",
        });
      } finally {
        setBusyAction(null);
      }
    }

    loadInitialData();
  }, []);

  useEffect(() => {
    const handleMatchUpdate = (match: Match) => {
      setMatches((prev) => ({ ...prev, [match.id]: match }));

      if (match.streamId === selectedStream) {
        setCurrentMatch(match);
      }
    };

    socket.on("MATCH_UPDATE", handleMatchUpdate);

    return () => {
      socket.off("MATCH_UPDATE", handleMatchUpdate);
    };
  }, [selectedStream]);

  async function runAction<T>(
    label: string,
    fn: () => Promise<T>,
    successMessage: string,
  ) {
    setBusyAction(label);
    setActionState({ label, type: "loading", message: "Working…" });

    try {
      const result = await fn();
      setActionState({
        label: "Success",
        type: "success",
        message: successMessage,
      });
      return result;
    } catch (error) {
      console.error(error);
      setActionState({
        label: "Action failed",
        type: "error",
        message: "Something went wrong. The local UI was not changed.",
      });
      return null;
    } finally {
      setBusyAction(null);
    }
  }

  async function handleRefresh() {
    await runAction(
      "Refreshing",
      refreshStartGG,
      "Bracket data refreshed from start.gg.",
    );
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    runAction(
      "Refreshing",
      refreshStartGG,
      "Bracket data refreshed from start.gg.",
    );
  }, []);

  async function handleAssign(match: Match) {
    if (!selectedStream) return;

    const updated = await runAction(
      "Assigning",
      () => assignMatch(match.id, selectedStream),
      `${match.player1.name} vs ${match.player2.name} assigned to ${selectedStreamName}.`,
    );

    if (!updated) return;
    setMatches((prev) => ({ ...prev, [updated.id]: updated }));
    setCurrentMatch(updated);
  }

  async function handleUnassign(match: Match) {
    const updated = await runAction(
      "Unassigning",
      () => unassignMatch(match.id),
      "Match returned to the available queue.",
    );

    if (!updated) return;
    setMatches((prev) => ({ ...prev, [updated.id]: updated }));
    setCurrentMatch(null);
  }

  async function handleStart(match: Match) {
    const updated = await runAction(
      "Starting",
      () => startMatch(match.id),
      "Match is now live.",
    );
    if (!updated) return;
    setMatches((prev) => ({ ...prev, [updated.id]: updated }));
    setCurrentMatch(updated);
  }

  async function handleScore(match: Match, score1: number, score2: number) {
    const updated = await runAction(
      "Updating score",
      () => updateScore(match.id, Math.max(0, score1), Math.max(0, score2)),
      "Score updated locally.",
    );

    if (!updated) return;
    setMatches((prev) => ({ ...prev, [updated.id]: updated }));
    setCurrentMatch(updated);
  }

  async function handleSave(match: Match) {
    const updated = await runAction(
      "Saving",
      () => saveResult(match.id),
      "Result saved locally.",
    );
    if (!updated) return;
    setMatches((prev) => ({ ...prev, [updated.id]: updated }));
    setCurrentMatch(updated);
  }

  async function handleSubmit(match: Match) {
    if (!confirm("Submit this result to start.gg?")) return;

    const updated = await runAction(
      "Submitting",
      async () => {
        const submitted = await submitFinalResult(match.id);
        await refreshStartGG();
        return submitted;
      },
      "Final result submitted and bracket data refreshed.",
    );

    if (!updated) return;
    setMatches((prev) => ({ ...prev, [updated.id]: updated }));
    setCurrentMatch(updated.status === "complete" ? null : updated);
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Tournament operations</p>
          <h1>Stream Control Dashboard</h1>
          <p className="hero-copy">
            Assign sets, run scores, save results, and submit finals without
            losing sight of the queue.
          </p>
        </div>
      </section>

      <section className={`status-bar status-${actionState.type}`}>
        <div>
          <span className="status-dot" />
          <strong>{actionState.label}</strong>
        </div>
        <p>{actionState.message}</p>
      </section>

      <div className="dashboard-grid">
        <section className="panel queue-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Match queue</p>
              <h2>Available Sets</h2>
            </div>
            <button
              className="button secondary"
              disabled={!!busyAction}
              onClick={handleRefresh}
            >
              {busyAction === "Refreshing" ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          <label className="field-label" htmlFor="stream-select">
            Active stream
          </label>
          <select
            id="stream-select"
            value={selectedStream}
            onChange={(event) => setSelectedStream(event.target.value)}
          >
            {streams.map((stream) => (
              <option key={stream.id} value={stream.id}>
                {stream.name}
              </option>
            ))}
          </select>

          <div className="queue-list">
            {availableMatches.length === 0 && (
              <EmptyState
                title="Queue is clear"
                body="No unassigned active sets are available right now."
              />
            )}

            {availableMatches.map((match) => (
              <MatchQueueCard
                key={match.id}
                match={match}
                disabled={!selectedStream || !!currentMatch || !!busyAction}
                onAssign={() => handleAssign(match)}
              />
            ))}
          </div>
        </section>

        <section className="panel control-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">{selectedStreamName}</p>
              <h2>Live Control</h2>
            </div>
          </div>

          {!currentMatch && (
            <EmptyState
              title="No set assigned"
              body="Choose an available set from the queue to control this stream."
            />
          )}

          {currentMatch && (
            <MatchControl
              match={currentMatch}
              busyAction={busyAction}
              onUnassign={() => handleUnassign(currentMatch)}
              onStart={() => handleStart(currentMatch)}
              onScore={(score1, score2) =>
                handleScore(currentMatch, score1, score2)
              }
              onSave={() => handleSave(currentMatch)}
              onSubmit={() => handleSubmit(currentMatch)}
            />
          )}
        </section>
      </div>
    </main>
  );
}

function MatchQueueCard({
  match,
  disabled,
  onAssign,
}: {
  match: Match;
  disabled: boolean;
  onAssign: () => void;
}) {
  return (
    <article className="match-card">
      <div className="match-card-main">
        <div>
          <span className={`pill pill-${match.status}`}>
            {statusLabel(match.status)}
          </span>
          <h3>{match.player1.name}</h3>
          <p>vs {match.player2.name}</p>
        </div>
        <span className="round-label">{match.round}</span>
      </div>
      <button className="button" disabled={disabled} onClick={onAssign}>
        Assign
      </button>
    </article>
  );
}

function MatchControl({
  match,
  busyAction,
  onUnassign,
  onStart,
  onScore,
  onSave,
  onSubmit,
}: {
  match: Match;
  busyAction: string | null;
  onUnassign: () => void;
  onStart: () => void;
  onScore: (score1: number, score2: number) => void;
  onSave: () => void;
  onSubmit: () => void;
}) {
  const winner = getWinner(match);
  const isBusy = !!busyAction;

  return (
    <div className="control-stack">
      <div className="versus-card">
        <span className={`pill pill-${match.status}`}>
          {statusLabel(match.status)}
        </span>
        <div className="players-grid">
          <PlayerScore
            name={match.player1.name}
            score={match.score1}
            isLeading={match.score1 > match.score2}
            isBusy={isBusy}
            onIncrement={() => onScore(match.score1 + 1, match.score2)}
            onDecrement={() => onScore(match.score1 - 1, match.score2)}
          />
          <div className="versus-divider">VS</div>
          <PlayerScore
            name={match.player2.name}
            score={match.score2}
            isLeading={match.score2 > match.score1}
            isBusy={isBusy}
            onIncrement={() => onScore(match.score1, match.score2 + 1)}
            onDecrement={() => onScore(match.score1, match.score2 - 1)}
          />
        </div>
        <p className="round-summary">{match.round}</p>
        <p className="winner-line">
          {winner ? `Current leader: ${winner}` : "Match is currently tied."}
        </p>
      </div>

      <div className="action-row">
        <button
          className="button secondary"
          disabled={isBusy}
          onClick={onUnassign}
        >
          Unassign
        </button>
        <button
          className="button"
          disabled={isBusy || match.status !== "assigned"}
          onClick={onStart}
        >
          Start
        </button>
        <button
          className="button"
          disabled={isBusy || match.status === "complete"}
          onClick={onSave}
        >
          Save
        </button>
        <button
          className="button danger"
          disabled={isBusy || match.status === "complete"}
          onClick={onSubmit}
        >
          Submit Final
        </button>
      </div>
    </div>
  );
}

function PlayerScore({
  name,
  score,
  isLeading,
  isBusy,
  onIncrement,
  onDecrement,
}: {
  name: string;
  score: number;
  isLeading: boolean;
  isBusy: boolean;
  onIncrement: () => void;
  onDecrement: () => void;
}) {
  return (
    <div className={`player-score ${isLeading ? "is-leading" : ""}`}>
      <span>{name}</span>
      <div className="score-stepper" aria-label={`${name} score controls`}>
        <button
          className="stepper-button"
          type="button"
          disabled={isBusy || score === 0}
          onClick={onDecrement}
          aria-label={`Decrease ${name} score`}
        >
          −
        </button>
        <strong>{score}</strong>
        <button
          className="stepper-button primary"
          type="button"
          disabled={isBusy}
          onClick={onIncrement}
          aria-label={`Increase ${name} score`}
        >
          +
        </button>
      </div>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">⌁</div>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

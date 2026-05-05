import { useEffect, useState } from "react";
import {
  assignMatch,
  unassignMatch,
  startMatch,
  updateScore,
  saveResult,
  refreshStartGG,
  submitFinalResult,
  getConfig,
  saveConfig,
} from "./api";
import type { Match, TournamentStream } from "./types";

function getStatusLabel(status: Match["status"]) {
  const labels: Record<Match["status"], string> = {
    idle: "Queued",
    assigned: "Assigned",
    live: "Live",
    saved: "Saved",
    complete: "Complete",
  };

  return labels[status];
}

export default function App() {
  const [matches, setMatches] = useState<Record<string, Match>>({});
  const [currentMatch, setCurrentMatch] = useState<Match | null>(null);
  const [streams, setStreams] = useState<TournamentStream[]>([]);
  const [selectedStream, setSelectedStream] = useState<string>("");
  const [hasConfig, setHasConfig] = useState<boolean | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [savingConfig, setSavingConfig] = useState(false);
  const [slugInput, setSlugInput] = useState("");
  const [activeStreamId, setActiveStreamId] = useState(
    selectedStream || streams[0]?.id || "",
  );
  const [isBusy, setIsBusy] = useState(true);

  const emptyStreamControlMatchComponent = () => {
    return (
      <div className="empty-state">
        <div className="empty-icon">↗</div>
        <h3>No match assigned</h3>
        <p>Assign a set from the queue to begin controlling this stream.</p>
      </div>
    );
  };

  const refreshFromStartGG = async () => {
    setIsBusy(true);

    const result = await refreshStartGG();

    const nextMatches = result.matchesData ?? result.matches;
    const nextStreams = result.streamsData ?? result.streams;

    if (Array.isArray(nextStreams)) {
      setStreams(nextStreams);
    }

    if (nextMatches) {
      setMatches(nextMatches);

      const matchesArray = Object.values(nextMatches) as Match[];

      const matchForSelectedStream =
        matchesArray.find((match) => match.streamId) ?? null;
      setActiveStreamId(
        matchForSelectedStream?.streamId || nextStreams?.[0]?.id || "",
      );

      if (matchForSelectedStream) {
        setCurrentMatch(matchForSelectedStream);
      }
    }
    setIsBusy(false);
  };

  const unassignStreamMatch = async () => {
    setIsBusy(true);
    const updatedMatch = await unassignMatch(currentMatch?.id || "");

    setMatches((prev) => ({
      ...prev,
      [updatedMatch.id]: updatedMatch,
    }));

    setCurrentMatch(null);
    setIsBusy(false);
  };

  const handleSaveConfig = async () => {
    setIsBusy(true);

    setSavingConfig(true);

    try {
      await saveConfig(tokenInput, slugInput);
      setHasConfig(true);
    } catch {
      alert("Failed to save Start.gg config");
    } finally {
      setSavingConfig(false);
    }

    setIsBusy(false);
  };

  const availableMatches = Object.values(matches).filter(
    (m) =>
      m && m.player1 && m.player2 && !m.streamId && m.status !== "complete",
  );

  useEffect(() => {
    getConfig()
      .then((data) => {
        setHasConfig(data.hasStartggToken && data.hasTournamentSlug);
      })
      .catch(() => setHasConfig(false));
  }, []);

  useEffect(() => {
    // initial load of startgg data
    const refreshData = async () => {
      try {
        if (hasConfig) {
          refreshFromStartGG();
        }
      } catch (error) {
        console.error("Error fetching initial start gg data:", error);
      }
    };

    refreshData();
  }, [hasConfig]);

  const selectedStreamName =
    streams?.find((stream) => stream.id === activeStreamId)?.name ||
    "Stream Control";

  if (hasConfig === null) {
    return <main className="app-shell">Loading...</main>;
  }

  if (!hasConfig) {
    return (
      <main className="app-shell">
        <section
          className="panel"
          style={{ maxWidth: 520, margin: "60px auto" }}
        >
          <h1>Setup Required</h1>
          <p>Enter your Start.gg API token to continue.</p>

          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="Start.gg API Token"
            style={{
              width: "100%",
              padding: 12,
              marginBottom: 12,
            }}
          />
          <input
            type="text"
            value={slugInput}
            onChange={(e) => setSlugInput(e.target.value)}
            placeholder="Tournament Slug"
            style={{
              width: "100%",
              padding: 12,
              marginBottom: 12,
            }}
          />

          <button
            className="button"
            onClick={() => {
              handleSaveConfig();
            }}
            disabled={savingConfig || !tokenInput.trim() || !slugInput.trim()}
          >
            {savingConfig ? "Saving..." : "Save Token"}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      {isBusy && (
        <div className="busy-overlay">
          <div className="busy-card">
            <span className="busy-spinner" />
            <span>Processing...</span>
          </div>
        </div>
      )}
      <section className="hero compact-hero">
        <div>
          <p className="eyebrow">Tournament operations</p>
          <h1>Stream Control Dashboard</h1>
          <p className="hero-copy">
            Same working match logic, upgraded with a cleaner control-room
            interface.
          </p>
        </div>
        <button
          className="button secondary"
          onClick={() => {
            refreshFromStartGG();
          }}
        >
          Refresh from start.gg
        </button>
      </section>

      <div className="dashboard-grid logic-first-grid">
        {/* LEFT: MATCH LIST */}
        <section className="panel queue-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Match queue</p>
              <h2>Available Matches</h2>
            </div>
          </div>

          <label className="field-label" htmlFor="stream-select">
            Choose Stream
          </label>
          <select
            id="stream-select"
            value={activeStreamId}
            onChange={(e) => setSelectedStream(e.target.value)}
          >
            {streams.map((stream) => (
              <option key={stream.id} value={stream.id}>
                {stream.name}
              </option>
            ))}
          </select>

          <div className="queue-list">
            {availableMatches.length === 0 &&
              emptyStreamControlMatchComponent()}

            {availableMatches.map((match) => (
              <article className="match-card" key={match.id}>
                <div className="match-card-main">
                  <div>
                    <span className="pill">{getStatusLabel(match.status)}</span>
                    <h3>
                      {match.player1?.name ?? "TBD"}{" "}
                      <span className="muted-text">vs</span>{" "}
                      {match.player2?.name ?? "TBD"}
                    </h3>
                    <p>{match.round}</p>
                  </div>
                </div>

                <button
                  className="button"
                  disabled={
                    !activeStreamId ||
                    currentMatch?.status === "assigned" ||
                    currentMatch?.status === "live" ||
                    currentMatch?.status === "saved"
                  }
                  onClick={async () => {
                    setIsBusy(true);
                    const updatedMatch = await assignMatch(
                      match.id,
                      activeStreamId,
                    );

                    setMatches((prev) => ({
                      ...prev,
                      [updatedMatch.id]: updatedMatch,
                    }));

                    setCurrentMatch(updatedMatch);
                    setIsBusy(false);
                  }}
                >
                  Assign
                </button>
              </article>
            ))}
          </div>
        </section>

        {/* RIGHT: STREAM CONTROL */}
        <section className="panel control-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">{selectedStreamName}</p>
              <h2>Stream Control</h2>
            </div>
            <button
              className="button ghost"
              disabled={!currentMatch}
              onClick={() => {
                unassignStreamMatch();
              }}
            >
              Unassign Stream
            </button>
          </div>

          {!currentMatch && emptyStreamControlMatchComponent()}

          {currentMatch && (
            <div className="control-stack">
              <article className="versus-card">
                <div className="match-meta-row">
                  <span className={`pill pill-${currentMatch.status}`}>
                    {getStatusLabel(currentMatch.status)}
                  </span>
                  <span className="round-label">{currentMatch.round}</span>
                </div>

                <div className="players-grid">
                  <div
                    className={`player-score ${
                      currentMatch.score1 > currentMatch.score2
                        ? "is-leading"
                        : ""
                    }`}
                  >
                    <span>{currentMatch.player1?.name ?? "TBD"}</span>
                    <strong>{currentMatch.score1}</strong>

                    <div className="score-stepper">
                      <button
                        className="stepper-button"
                        disabled={
                          currentMatch.status === "assigned" ||
                          currentMatch.score1 <= 0
                        }
                        onClick={async () => {
                          const updatedMatch = await updateScore(
                            currentMatch.id,
                            currentMatch.score1 - 1,
                            currentMatch.score2,
                          );

                          setCurrentMatch(updatedMatch);
                          setMatches((prev) => ({
                            ...prev,
                            [updatedMatch.id]: updatedMatch,
                          }));
                        }}
                        aria-label={`Decrease ${currentMatch.player1?.name ?? "TBD"} score`}
                      >
                        −
                      </button>
                      <span className="score-stepper-label">Score</span>
                      <button
                        className="stepper-button primary"
                        disabled={currentMatch.status === "assigned"}
                        onClick={async () => {
                          const updatedMatch = await updateScore(
                            currentMatch.id,
                            currentMatch.score1 + 1,
                            currentMatch.score2,
                          );

                          setCurrentMatch(updatedMatch);
                          setMatches((prev) => ({
                            ...prev,
                            [updatedMatch.id]: updatedMatch,
                          }));
                        }}
                        aria-label={`Increase ${currentMatch.player1?.name ?? "TBD"} score`}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="versus-divider">VS</div>

                  <div
                    className={`player-score ${
                      currentMatch.score2 > currentMatch.score1
                        ? "is-leading"
                        : ""
                    }`}
                  >
                    <span>{currentMatch.player2?.name ?? "TBD"}</span>
                    <strong>{currentMatch.score2}</strong>

                    <div className="score-stepper">
                      <button
                        className="stepper-button"
                        disabled={
                          currentMatch.status === "assigned" ||
                          currentMatch.score2 <= 0
                        }
                        onClick={async () => {
                          const updatedMatch = await updateScore(
                            currentMatch.id,
                            currentMatch.score1,
                            currentMatch.score2 - 1,
                          );

                          setCurrentMatch(updatedMatch);
                          setMatches((prev) => ({
                            ...prev,
                            [updatedMatch.id]: updatedMatch,
                          }));
                        }}
                        aria-label={`Decrease ${currentMatch.player2?.name ?? "TBD"} score`}
                      >
                        −
                      </button>
                      <span className="score-stepper-label">Score</span>
                      <button
                        className="stepper-button primary"
                        disabled={currentMatch.status === "assigned"}
                        onClick={async () => {
                          const updatedMatch = await updateScore(
                            currentMatch.id,
                            currentMatch.score1,
                            currentMatch.score2 + 1,
                          );

                          setCurrentMatch(updatedMatch);
                          setMatches((prev) => ({
                            ...prev,
                            [updatedMatch.id]: updatedMatch,
                          }));
                        }}
                        aria-label={`Increase ${currentMatch.player2?.name ?? "TBD"} score`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                <p className="round-summary">Status: {currentMatch.status}</p>
              </article>

              <div className="action-row">
                <button
                  className="button"
                  disabled={currentMatch.status !== "assigned"}
                  onClick={async () => {
                    setIsBusy(true);
                    const updatedMatch = await startMatch(currentMatch.id);

                    setMatches((prev) => ({
                      ...prev,
                      [updatedMatch.id]: updatedMatch,
                    }));

                    setCurrentMatch(updatedMatch);
                    setIsBusy(false);
                  }}
                >
                  Start Match
                </button>

                <button
                  className="button secondary"
                  disabled={!currentMatch || currentMatch.status === "assigned"}
                  onClick={async () => {
                    setIsBusy(true);
                    const updatedMatch = await saveResult(currentMatch.id);

                    setMatches((prev) => ({
                      ...prev,
                      [updatedMatch.id]: updatedMatch,
                    }));

                    setCurrentMatch(updatedMatch);
                    setIsBusy(false);
                  }}
                >
                  Save Result
                </button>

                <button
                  className="button danger span-2"
                  disabled={
                    !currentMatch ||
                    currentMatch.status === "assigned" ||
                    currentMatch.score1 === currentMatch.score2
                  }
                  onClick={async () => {
                    const confirmed = window.confirm(
                      "Submit this final result to start.gg?",
                    );

                    if (!confirmed) return;
                    setIsBusy(true);

                    const updatedMatch = await submitFinalResult(
                      currentMatch.id,
                    );

                    setMatches((prev) => ({
                      ...prev,
                      [updatedMatch.id]: updatedMatch,
                    }));

                    setCurrentMatch(updatedMatch);
                    unassignStreamMatch();
                    refreshFromStartGG();
                    setIsBusy(false);
                  }}
                >
                  Submit Final Result
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

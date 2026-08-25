import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import {
  assignMatch,
  createOfflineMatch,
  getConfig,
  refreshStartGG,
  resetScore,
  saveConfig,
  saveResult,
  startMatch,
  submitFinalResult,
  unassignMatch,
  updateOfflineMatch,
  updateScore,
} from "./api";
import type { Match, TournamentStream } from "./types";

type AppMode = "startgg" | "offline";
type SetupView = "choice" | AppMode;

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
  const [streams, setStreams] = useState<TournamentStream[]>([]);
  const [mode, setMode] = useState<AppMode | null>(null);
  const [setupView, setSetupView] = useState<SetupView>("choice");
  const [hasSavedToken, setHasSavedToken] = useState<boolean | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [slugInput, setSlugInput] = useState("");
  const [player1Input, setPlayer1Input] = useState("");
  const [player2Input, setPlayer2Input] = useState("");
  const [matchLabelInput, setMatchLabelInput] = useState("Offline Match");
  const [savingConfig, setSavingConfig] = useState(false);
  const [activeStreamId, setActiveStreamId] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const currentMatch = activeStreamId
    ? Object.values(matches).find((match) => match.streamId === activeStreamId) ??
      null
    : null;

  const availableMatches = Object.values(matches).filter(
    (match) =>
      match &&
      match.player1 &&
      match.player2 &&
      !match.streamId &&
      match.status !== "complete",
  );

  const selectedStreamName =
    streams.find((stream) => stream.id === activeStreamId)?.name ||
    "Stream Control";

  const loadingStateComponent = (text: string) => (
    <div className="busy-overlay">
      <div className="busy-card">
        <span className="busy-spinner" />
        <span>{text}</span>
      </div>
    </div>
  );

  const emptyStreamControlMatchComponent = (
    title = "No match assigned",
    description = "Assign a set from the queue to begin controlling this stream.",
  ) => (
    <div className="empty-state">
      <div className="empty-icon">+</div>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );

  const refreshFromStartGG = async () => {
    setIsBusy(true);

    try {
      const result = await refreshStartGG();
      const nextMatches = result.matchesData ?? result.matches;
      const nextStreams = (result.streamsData ??
        result.streams ??
        []) as TournamentStream[];

      setStreams(nextStreams);

      if (nextMatches) {
        setMatches(nextMatches);

        const matchesArray = Object.values(nextMatches) as Match[];
        const matchForSelectedStream =
          matchesArray.find((match) => match.streamId) ?? null;

        setActiveStreamId((previousStreamId) => {
          const previousStreamStillExists = nextStreams.some(
            (stream) => stream.id === previousStreamId,
          );

          return previousStreamStillExists
            ? previousStreamId
            : matchForSelectedStream?.streamId || nextStreams[0]?.id || "";
        });
      }
    } catch (error) {
      console.error("Error refreshing start.gg data:", error);
      alert("Failed to load this start.gg tournament.");
    } finally {
      setIsBusy(false);
    }
  };

  const unassignStreamMatch = async () => {
    if (!currentMatch) return;

    setIsBusy(true);

    try {
      const updatedMatch = await unassignMatch(currentMatch.id);
      setMatches((previousMatches) => ({
        ...previousMatches,
        [updatedMatch.id]: updatedMatch,
      }));
    } catch (error) {
      console.error("Error unassigning stream match:", error);
      alert("Failed to unassign the stream match.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    setIsBusy(true);

    try {
      await saveConfig(tokenInput.trim() || undefined, slugInput);
      setHasSavedToken(true);
      setMode("startgg");
      await refreshFromStartGG();
    } catch (error) {
      console.error("Failed to save start.gg configuration:", error);
      alert("Failed to save the start.gg tournament configuration.");
    } finally {
      setSavingConfig(false);
      setIsBusy(false);
    }
  };

  const handleCreateOfflineMatch = async () => {
    setIsBusy(true);

    try {
      const result = await createOfflineMatch(
        player1Input,
        player2Input,
        matchLabelInput,
      );
      const nextStreams = result.streamsData as TournamentStream[];

      setMatches(result.matchesData);
      setStreams(nextStreams);
      setActiveStreamId(nextStreams[0]?.id ?? "");
      setMatchLabelInput(
        result.matchesData["offline-match"]?.round ?? "Offline Match",
      );
      setMode("offline");
    } catch (error) {
      console.error("Failed to create offline match:", error);
      alert("Failed to start offline mode.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleScoreUpdate = async (score1: number, score2: number) => {
    if (!currentMatch) return;

    try {
      const updatedMatch = await updateScore(currentMatch.id, score1, score2);
      setMatches((previousMatches) => ({
        ...previousMatches,
        [updatedMatch.id]: updatedMatch,
      }));
      setPlayer1Input(updatedMatch.player1.name);
      setPlayer2Input(updatedMatch.player2.name);
      setMatchLabelInput(updatedMatch.round);
    } catch (error) {
      console.error("Failed to update score:", error);
      alert("Failed to update the score.");
    }
  };

  const handleUpdateOfflineMatch = async () => {
    setIsBusy(true);

    try {
      const updatedMatch = await updateOfflineMatch(
        player1Input,
        player2Input,
        matchLabelInput,
      );
      setMatches((previousMatches) => ({
        ...previousMatches,
        [updatedMatch.id]: updatedMatch,
      }));
    } catch (error) {
      console.error("Failed to update offline match:", error);
      alert("Failed to update the offline scoreboard details.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleResetScore = async () => {
    if (!currentMatch) return;

    try {
      const updatedMatch = await resetScore(currentMatch.id);
      setMatches((previousMatches) => ({
        ...previousMatches,
        [updatedMatch.id]: updatedMatch,
      }));
    } catch (error) {
      console.error("Failed to reset score:", error);
      alert("Failed to reset the score.");
    }
  };

  useEffect(() => {
    getConfig()
      .then((data) => {
        setHasSavedToken(Boolean(data.hasStartggToken));
        setSlugInput(data.tournamentSlug ?? "");
      })
      .catch(() => setHasSavedToken(false));
  }, []);

  useEffect(() => {
    const socket = io();

    socket.on("match:update", (updatedMatches: Record<string, Match>) => {
      setMatches(updatedMatches);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  if (hasSavedToken === null) {
    return loadingStateComponent("Loading...");
  }

  if (!mode) {
    return (
      <main className="app-shell setup-shell">
        {isBusy && loadingStateComponent("Processing...")}
        <section className="panel setup-panel">
          {setupView === "choice" && (
            <>
              <p className="eyebrow">Scoreboard setup</p>
              <h1>Choose a mode</h1>
              <p className="hero-copy setup-copy">
                Connect a start.gg tournament, or run the scoreboard locally
                with player names you enter yourself.
              </p>

              <div className="mode-grid">
                <button
                  className="mode-card"
                  onClick={() => setSetupView("startgg")}
                >
                  <span className="mode-card-icon">S</span>
                  <strong>Start.gg Tournament</strong>
                  <span>Load bracket matches, streams, and result tools.</span>
                </button>
                <button
                  className="mode-card"
                  onClick={() => setSetupView("offline")}
                >
                  <span className="mode-card-icon">O</span>
                  <strong>Offline Mode</strong>
                  <span>Enter two players and control scores without a bracket.</span>
                </button>
              </div>
            </>
          )}

          {setupView === "startgg" && (
            <form
              className="setup-form"
              onSubmit={(event) => {
                event.preventDefault();
                handleSaveConfig();
              }}
            >
              <button
                type="button"
                className="back-button"
                onClick={() => setSetupView("choice")}
              >
                Back
              </button>
              <p className="eyebrow">Start.gg mode</p>
              <h1>Open a tournament</h1>
              <p className="hero-copy setup-copy">
                Paste the numeric tournament ID, slug, or start.gg tournament
                URL.
              </p>

              <label className="field-label" htmlFor="tournament-slug">
                Tournament ID or slug
              </label>
              <input
                id="tournament-slug"
                type="text"
                value={slugInput}
                onChange={(event) => setSlugInput(event.target.value)}
                placeholder="123456 or tournament/my-event"
                autoFocus
              />

              <label className="field-label" htmlFor="api-token">
                Start.gg API token {hasSavedToken ? "(optional)" : ""}
              </label>
              <input
                id="api-token"
                type="password"
                value={tokenInput}
                onChange={(event) => setTokenInput(event.target.value)}
                placeholder={
                  hasSavedToken ? "Use saved token" : "Start.gg API token"
                }
              />

              <button
                className="button setup-submit"
                type="submit"
                disabled={
                  savingConfig ||
                  !slugInput.trim() ||
                  (!hasSavedToken && !tokenInput.trim())
                }
              >
                {savingConfig ? "Opening..." : "Open Tournament"}
              </button>
            </form>
          )}

          {setupView === "offline" && (
            <form
              className="setup-form"
              onSubmit={(event) => {
                event.preventDefault();
                handleCreateOfflineMatch();
              }}
            >
              <button
                type="button"
                className="back-button"
                onClick={() => setSetupView("choice")}
              >
                Back
              </button>
              <p className="eyebrow">Offline mode</p>
              <h1>Enter the players</h1>
              <p className="hero-copy setup-copy">
                The OBS scoreboard and Stream Deck score commands will use this
                match immediately.
              </p>

              <label className="field-label" htmlFor="player-one">
                Player 1
              </label>
              <input
                id="player-one"
                type="text"
                value={player1Input}
                onChange={(event) => setPlayer1Input(event.target.value)}
                placeholder="Player 1 name"
                maxLength={80}
                autoFocus
              />

              <label className="field-label" htmlFor="player-two">
                Player 2
              </label>
              <input
                id="player-two"
                type="text"
                value={player2Input}
                onChange={(event) => setPlayer2Input(event.target.value)}
                placeholder="Player 2 name"
                maxLength={80}
              />

              <label className="field-label" htmlFor="match-label">
                Match label
              </label>
              <input
                id="match-label"
                type="text"
                value={matchLabelInput}
                onChange={(event) => setMatchLabelInput(event.target.value)}
                placeholder="Offline Match"
                maxLength={80}
              />

              <button
                className="button setup-submit"
                type="submit"
                disabled={!player1Input.trim() || !player2Input.trim()}
              >
                Start Offline Match
              </button>
            </form>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      {isBusy && loadingStateComponent("Processing...")}
      <section className="hero compact-hero">
        <div>
          <p className="eyebrow">
            {mode === "offline" ? "Offline scoreboard" : "Tournament operations"}
          </p>
          <h1>
            {mode === "offline"
              ? "Scoreboard Control"
              : "Stream Control Dashboard"}
          </h1>
          <p className="hero-copy">
            {mode === "offline"
              ? "Control the live scoreboard without a start.gg tournament."
              : "Assign bracket matches, update scores, and report results."}
          </p>
        </div>
        <div className="hero-actions">
          {mode === "startgg" && (
            <button className="button secondary" onClick={refreshFromStartGG}>
              Refresh from start.gg
            </button>
          )}
          <button
            className="button ghost"
            onClick={() => {
              setMode(null);
              setSetupView("choice");
            }}
          >
            Change Mode
          </button>
        </div>
      </section>

      <div className="dashboard-grid logic-first-grid">
        <section className="panel queue-panel">
          {mode === "startgg" ? (
            <>
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
                onChange={(event) => setActiveStreamId(event.target.value)}
              >
                {streams.map((stream) => (
                  <option key={stream.id} value={stream.id}>
                    {stream.name}
                  </option>
                ))}
              </select>

              <div className="queue-list">
                {availableMatches.length === 0 &&
                  emptyStreamControlMatchComponent(
                    "No matches available",
                    "Refresh start.gg or wait for both entrants to be known.",
                  )}

                {availableMatches.map((match) => (
                  <article className="match-card" key={match.id}>
                    <div className="match-card-main">
                      <div>
                        <span className={`pill pill-${match.status}`}>
                          {getStatusLabel(match.status)}
                        </span>
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

                        try {
                          const updatedMatch = await assignMatch(
                            match.id,
                            activeStreamId,
                          );
                          setMatches((previousMatches) => ({
                            ...previousMatches,
                            [updatedMatch.id]: updatedMatch,
                          }));
                        } catch (error) {
                          console.error("Error assigning stream match:", error);
                          alert("Failed to assign the stream match.");
                        } finally {
                          setIsBusy(false);
                        }
                      }}
                    >
                      Assign
                    </button>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <div className="offline-summary">
              <p className="eyebrow">Scoreboard details</p>
              <h2>Edit Offline Match</h2>
              <form
                className="offline-editor"
                onSubmit={(event) => {
                  event.preventDefault();
                  handleUpdateOfflineMatch();
                }}
              >
                <label className="field-label" htmlFor="active-player-one">
                  Player 1
                </label>
                <input
                  id="active-player-one"
                  type="text"
                  value={player1Input}
                  onChange={(event) => setPlayer1Input(event.target.value)}
                  maxLength={80}
                />

                <label className="field-label" htmlFor="active-player-two">
                  Player 2
                </label>
                <input
                  id="active-player-two"
                  type="text"
                  value={player2Input}
                  onChange={(event) => setPlayer2Input(event.target.value)}
                  maxLength={80}
                />

                <label className="field-label" htmlFor="active-match-label">
                  Match label
                </label>
                <input
                  id="active-match-label"
                  type="text"
                  value={matchLabelInput}
                  onChange={(event) => setMatchLabelInput(event.target.value)}
                  maxLength={80}
                />

                <button
                  className="button"
                  type="submit"
                  disabled={
                    !player1Input.trim() ||
                    !player2Input.trim() ||
                    !matchLabelInput.trim()
                  }
                >
                  Update Scoreboard
                </button>
              </form>
              <p className="offline-help">
                OBS overlay: <code>http://localhost:3001/scoreboard</code>
              </p>
            </div>
          )}
        </section>

        <section className="panel control-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">{selectedStreamName}</p>
              <h2>Stream Control</h2>
            </div>
            {mode === "startgg" && (
              <button
                className="button ghost"
                disabled={!currentMatch}
                onClick={unassignStreamMatch}
              >
                Unassign Stream
              </button>
            )}
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
                        onClick={() =>
                          handleScoreUpdate(
                            currentMatch.score1 - 1,
                            currentMatch.score2,
                          )
                        }
                        aria-label={`Decrease ${currentMatch.player1?.name ?? "TBD"} score`}
                      >
                        -
                      </button>
                      <span className="score-stepper-label">Score</span>
                      <button
                        className="stepper-button primary"
                        disabled={currentMatch.status === "assigned"}
                        onClick={() =>
                          handleScoreUpdate(
                            currentMatch.score1 + 1,
                            currentMatch.score2,
                          )
                        }
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
                        onClick={() =>
                          handleScoreUpdate(
                            currentMatch.score1,
                            currentMatch.score2 - 1,
                          )
                        }
                        aria-label={`Decrease ${currentMatch.player2?.name ?? "TBD"} score`}
                      >
                        -
                      </button>
                      <span className="score-stepper-label">Score</span>
                      <button
                        className="stepper-button primary"
                        disabled={currentMatch.status === "assigned"}
                        onClick={() =>
                          handleScoreUpdate(
                            currentMatch.score1,
                            currentMatch.score2 + 1,
                          )
                        }
                        aria-label={`Increase ${currentMatch.player2?.name ?? "TBD"} score`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                <p className="round-summary">
                  Status: {getStatusLabel(currentMatch.status)}
                </p>
              </article>

              {mode === "offline" ? (
                <div className="action-row">
                  <button
                    className="button secondary span-2"
                    disabled={
                      currentMatch.score1 === 0 && currentMatch.score2 === 0
                    }
                    onClick={handleResetScore}
                  >
                    Reset Scores
                  </button>
                </div>
              ) : (
                <div className="action-row">
                  <button
                    className="button"
                    disabled={currentMatch.status !== "assigned"}
                    onClick={async () => {
                      setIsBusy(true);

                      try {
                        const updatedMatch = await startMatch(currentMatch.id);
                        setMatches((previousMatches) => ({
                          ...previousMatches,
                          [updatedMatch.id]: updatedMatch,
                        }));
                      } catch (error) {
                        console.error("Error starting stream match:", error);
                        alert("Failed to start the stream match.");
                      } finally {
                        setIsBusy(false);
                      }
                    }}
                  >
                    Start Match
                  </button>

                  <button
                    className="button secondary"
                    disabled={currentMatch.status === "assigned"}
                    onClick={async () => {
                      setIsBusy(true);

                      try {
                        const updatedMatch = await saveResult(currentMatch.id);
                        setMatches((previousMatches) => ({
                          ...previousMatches,
                          [updatedMatch.id]: updatedMatch,
                        }));
                      } catch (error) {
                        console.error(
                          "Error saving stream match result:",
                          error,
                        );
                        alert("Failed to save the stream match result.");
                      } finally {
                        setIsBusy(false);
                      }
                    }}
                  >
                    Save Result
                  </button>

                  <button
                    className="button danger span-2"
                    disabled={
                      currentMatch.status === "assigned" ||
                      currentMatch.score1 === currentMatch.score2
                    }
                    onClick={async () => {
                      const confirmed = window.confirm(
                        "Submit this final result to start.gg?",
                      );

                      if (!confirmed) return;
                      setIsBusy(true);

                      try {
                        const updatedMatch = await submitFinalResult(
                          currentMatch.id,
                        );
                        setMatches((previousMatches) => ({
                          ...previousMatches,
                          [updatedMatch.id]: updatedMatch,
                        }));
                        await refreshFromStartGG();
                      } catch (error) {
                        console.error(
                          "Error submitting stream match result:",
                          error,
                        );
                        alert("Failed to submit the stream match result.");
                      } finally {
                        setIsBusy(false);
                      }
                    }}
                  >
                    Submit Final Result
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

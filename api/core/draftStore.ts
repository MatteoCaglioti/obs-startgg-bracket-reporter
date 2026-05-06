import { DraftState, Ruleset } from "./draftTypes";

type Snapshot = Omit<DraftState, "canUndo" | "canRedo">;

function getTotalSelections(state: DraftState): number {
  return Object.values(state.strikedStages).reduce(
    (sum, arr) => sum + arr.length,
    0
  );
}

function isPickPhase(state: DraftState): boolean {
  if (!state.ruleset) return false;
  return getTotalSelections(state) >= state.ruleset.totalBans;
}

function getStrikeNumber(state: DraftState): number {
  if (!state.ruleset) return 0;
  const { strikeOrder, banCount } = state.ruleset;
  if (state.currGame === 0) {
    return strikeOrder[state.currStep] ?? 0;
  }
  return banCount ?? 0;
}

function isStepComplete(state: DraftState): boolean {
  const currBans = state.strikedStages[state.currStep] ?? [];
  const needed = getStrikeNumber(state);
  if (isPickPhase(state)) {
    // In pick phase each step picks exactly 1 (player has chosen and confirmed)
    return currBans.length > 0;
  }
  return currBans.length >= needed;
}

function applySnapshot(state: DraftState, snap: Snapshot): DraftState {
  return {
    ...snap,
    canUndo: false,
    canRedo: false,
  };
}

class DraftStore {
  private state: DraftState;
  private history: Snapshot[] = [];
  private historyIndex = -1;
  private listeners: Array<(state: DraftState) => void> = [];

  constructor() {
    this.state = this.initialState();
  }

  private initialState(): DraftState {
    return {
      matchId: null,
      p1Name: "Player 1",
      p2Name: "Player 2",
      ruleset: null,
      currGame: 0,
      currPlayer: -1,
      currStep: 0,
      phase: "ban",
      strikedStages: {},
      strikedBy: [[], []],
      charactersPicked: [],
      selectedCharacter: null,
      lastWinner: -1,
      gentlemans: false,
      canUndo: false,
      canRedo: false,
    };
  }

  private saveHistory() {
    const { canUndo: _u, canRedo: _r, ...snap } = this.state;
    // Trim redo history when a new action is taken
    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(snap as Snapshot);
    this.historyIndex = this.history.length - 1;
  }

  private recomputeUndoRedo() {
    this.state.canUndo = this.historyIndex > 0;
    this.state.canRedo = this.historyIndex < this.history.length - 1;
  }

  private emit() {
    this.recomputeUndoRedo();
    this.listeners.forEach((l) => l(this.state));
  }

  subscribe(listener: (state: DraftState) => void) {
    this.listeners.push(listener);
  }

  getState(): DraftState {
    return this.state;
  }

  /** Load ruleset and start draft (sets currPlayer = 0 to begin) */
  start(ruleset: Ruleset, matchId?: string, p1Name?: string, p2Name?: string) {
    const fresh = this.initialState();
    fresh.ruleset = ruleset;
    fresh.currPlayer = 0;
    fresh.phase = "ban";
    if (matchId) fresh.matchId = matchId;
    if (p1Name) fresh.p1Name = p1Name;
    if (p2Name) fresh.p2Name = p2Name;
    this.state = fresh;
    this.history = [];
    this.historyIndex = -1;
    this.saveHistory();
    this.emit();
  }

  /** Player selects a character */
  select(codename: string): boolean {
    if (this.state.currPlayer === -1) return false;
    if (this.state.phase === "complete") return false;

    const pick = isPickPhase(this.state);

    if (pick) {
      // In pick phase, clicking sets the highlighted selection
      if (this.state.charactersPicked.includes(codename)) return false;
      if (this.state.strikedBy[0].includes(codename) || this.state.strikedBy[1].includes(codename)) {
        // Banned character - not pickable (ban phase selections)
        const total = getTotalSelections(this.state);
        const banIdx = this.getBanIndex(codename);
        if (banIdx !== -1 && banIdx < (this.state.ruleset?.totalBans ?? 4)) return false;
      }
      this.saveHistory();
      this.state = { ...this.state, selectedCharacter: codename };
      this.emit();
      return true;
    } else {
      // Ban phase: toggle character in current step
      const currBans = this.state.strikedStages[this.state.currStep] ?? [];
      const needed = getStrikeNumber(this.state);
      const isAlreadyBanned =
        this.state.strikedBy[0].includes(codename) ||
        this.state.strikedBy[1].includes(codename);
      if (isAlreadyBanned) return false;

      const idx = currBans.indexOf(codename);
      let newBans: string[];
      let newStrikedBy: [string[], string[]] = [
        [...this.state.strikedBy[0]],
        [...this.state.strikedBy[1]],
      ];

      if (idx !== -1) {
        // Deselect
        newBans = currBans.filter((c) => c !== codename);
        newStrikedBy[this.state.currPlayer] = newStrikedBy[this.state.currPlayer].filter(
          (c) => c !== codename
        );
      } else {
        if (currBans.length >= needed) return false; // step full
        newBans = [...currBans, codename];
        newStrikedBy[this.state.currPlayer].push(codename);
      }

      this.saveHistory();
      this.state = {
        ...this.state,
        strikedStages: {
          ...this.state.strikedStages,
          [this.state.currStep]: newBans,
        },
        strikedBy: newStrikedBy,
      };
      this.emit();
      return true;
    }
  }

  private getBanIndex(codename: string): number {
    let idx = 0;
    const rounds = Object.values(this.state.strikedStages);
    for (const round of rounds) {
      for (const c of round) {
        if (c === codename) return idx;
        idx++;
      }
    }
    return -1;
  }

  /** Confirm current step and advance */
  confirm(): boolean {
    if (this.state.currPlayer === -1) return false;
    if (this.state.phase === "complete") return false;
    if (!this.state.ruleset) return false;

    const pick = isPickPhase(this.state);

    if (pick) {
      if (!this.state.selectedCharacter) return false;

      const pickedChar = this.state.selectedCharacter;
      const currStepPicks = this.state.strikedStages[this.state.currStep] ?? [];
      const newStrikedBy: [string[], string[]] = [
        [...this.state.strikedBy[0]],
        [...this.state.strikedBy[1]],
      ];
      newStrikedBy[this.state.currPlayer].push(pickedChar);

      const newCharsPicked = [...this.state.charactersPicked, pickedChar];
      const totalPicks = newCharsPicked.length;
      const isPickDone = totalPicks >= this.state.ruleset.totalPicks;

      this.saveHistory();
      this.state = {
        ...this.state,
        strikedStages: {
          ...this.state.strikedStages,
          [this.state.currStep]: [...currStepPicks, pickedChar],
        },
        strikedBy: newStrikedBy,
        charactersPicked: newCharsPicked,
        selectedCharacter: null,
        currStep: this.state.currStep + 1,
        currPlayer: isPickDone ? -1 : 1 - this.state.currPlayer,
        phase: isPickDone ? "complete" : "pick",
      };
      this.emit();
      return true;
    } else {
      // Ban phase
      const currBans = this.state.strikedStages[this.state.currStep] ?? [];
      const needed = getStrikeNumber(this.state);

      // Allow confirming a step with 0 needed (auto-advance)
      if (currBans.length < needed) return false;

      const nextStep = this.state.currStep + 1;
      const nextPlayer = 1 - this.state.currPlayer;

      // Check if next step auto-skips (0 bans needed and not yet in pick phase)
      this.saveHistory();
      this.state = {
        ...this.state,
        currStep: nextStep,
        currPlayer: nextPlayer,
        selectedCharacter: null,
      };

      // Auto-advance through any 0-ban steps until we hit a real step or pick phase
      this.autoSkipZeroSteps();
      this.emit();
      return true;
    }
  }

  private autoSkipZeroSteps() {
    if (!this.state.ruleset) return;
    while (!isPickPhase(this.state)) {
      const needed = getStrikeNumber(this.state);
      if (needed !== 0) break;
      // Auto-skip: step requires 0 bans
      this.state = {
        ...this.state,
        currStep: this.state.currStep + 1,
        currPlayer: 1 - this.state.currPlayer,
      };
    }

    // Transition phase flag to pick if now in pick phase
    if (isPickPhase(this.state) && this.state.phase === "ban") {
      this.state = { ...this.state, phase: "pick" };
    }
  }

  undo(): boolean {
    if (this.historyIndex <= 0) return false;
    this.historyIndex--;
    const snap = this.history[this.historyIndex];
    this.state = applySnapshot(this.state, snap);
    this.emit();
    return true;
  }

  redo(): boolean {
    if (this.historyIndex >= this.history.length - 1) return false;
    this.historyIndex++;
    const snap = this.history[this.historyIndex];
    this.state = applySnapshot(this.state, snap);
    this.emit();
    return true;
  }

  restart() {
    if (!this.state.ruleset) return;
    const ruleset = this.state.ruleset;
    const { matchId, p1Name, p2Name } = this.state;
    this.start(ruleset, matchId ?? undefined, p1Name, p2Name);
  }

  recordGameWinner(winner: 0 | 1) {
    if (!this.state.ruleset) return;

    this.saveHistory();
    const newStagesWon: [string[], string[]] = [
      [...(this.state.strikedBy[0] ?? []).filter(
        (c) => this.state.charactersPicked.includes(c)
      )],
      [...(this.state.strikedBy[1] ?? []).filter(
        (c) => this.state.charactersPicked.includes(c)
      )],
    ];

    const nextGame = this.state.currGame + 1;
    const fresh = this.initialState();
    fresh.ruleset = this.state.ruleset;
    fresh.matchId = this.state.matchId;
    fresh.p1Name = this.state.p1Name;
    fresh.p2Name = this.state.p2Name;
    fresh.currGame = nextGame;
    fresh.currPlayer = winner === 0 ? 1 : 0; // Loser picks first
    fresh.lastWinner = winner;
    fresh.phase = "ban";

    this.state = fresh;
    this.emit();
  }

  setGentlemans(value: boolean) {
    this.saveHistory();
    this.state = { ...this.state, gentlemans: value };
    this.emit();
  }

  updatePlayerNames(p1Name: string, p2Name: string) {
    this.state = { ...this.state, p1Name, p2Name };
    this.emit();
  }
}

export const draftStore = new DraftStore();

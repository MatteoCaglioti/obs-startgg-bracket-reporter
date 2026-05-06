import { DraftState, DraftRuleset } from "./draftTypes";

type Snapshot = Omit<DraftState, "canUndo" | "canRedo">;

const MAX_HISTORY = 50;

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
      phase: "idle",
      pendingTeam1Name: "",
      pendingTeam2Name: "",
      teamAName: "",
      teamBName: "",
      teamABans: [],
      teamBBans: [],
      teamAPicks: [],
      teamBPicks: [],
      currentStep: 0,
      currentTeam: null,
      rpsWinner: null,
      ruleset: null,
      canUndo: false,
      canRedo: false,
    };
  }

  private saveSnapshot() {
    const { canUndo: _u, canRedo: _r, ...snap } = this.state;
    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(snap as Snapshot);
    if (this.history.length > MAX_HISTORY) {
      this.history = this.history.slice(this.history.length - MAX_HISTORY);
    }
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
    return { ...this.state };
  }

  start(ruleset: DraftRuleset, team1Name: string, team2Name: string) {
    this.state = {
      ...this.initialState(),
      phase: "rps",
      ruleset,
      pendingTeam1Name: team1Name || "Team 1",
      pendingTeam2Name: team2Name || "Team 2",
    };
    this.history = [];
    this.historyIndex = -1;
    this.saveSnapshot();
    this.emit();
  }

  setRpsWinner(winner: 1 | 2) {
    if (this.state.phase !== "rps") return;
    if (!this.state.ruleset) return;

    this.saveSnapshot();
    const teamAName = winner === 1 ? this.state.pendingTeam1Name : this.state.pendingTeam2Name;
    const teamBName = winner === 1 ? this.state.pendingTeam2Name : this.state.pendingTeam1Name;

    this.state = {
      ...this.state,
      phase: "ban",
      teamAName,
      teamBName,
      rpsWinner: winner,
      currentStep: 0,
      currentTeam: this.state.ruleset.banOrder[0] as 0 | 1,
    };
    this.emit();
  }

  ban(codename: string): boolean {
    if (this.state.phase !== "ban") return false;
    if (!this.state.ruleset) return false;

    const allBanned = [...this.state.teamABans, ...this.state.teamBBans];
    const allPicked = [...this.state.teamAPicks, ...this.state.teamBPicks];
    if (allBanned.includes(codename) || allPicked.includes(codename)) return false;

    this.saveSnapshot();

    const { banOrder } = this.state.ruleset;
    const actingTeam = banOrder[this.state.currentStep];

    const newTeamABans = actingTeam === 0 ? [...this.state.teamABans, codename] : [...this.state.teamABans];
    const newTeamBBans = actingTeam === 1 ? [...this.state.teamBBans, codename] : [...this.state.teamBBans];

    const nextStep = this.state.currentStep + 1;

    if (nextStep >= banOrder.length) {
      // Transition to pick phase
      const { pickOrder } = this.state.ruleset;
      this.state = {
        ...this.state,
        teamABans: newTeamABans,
        teamBBans: newTeamBBans,
        phase: "pick",
        currentStep: 0,
        currentTeam: pickOrder[0] as 0 | 1,
      };
    } else {
      this.state = {
        ...this.state,
        teamABans: newTeamABans,
        teamBBans: newTeamBBans,
        currentStep: nextStep,
        currentTeam: banOrder[nextStep] as 0 | 1,
      };
    }

    this.emit();
    return true;
  }

  pick(codename: string): boolean {
    if (this.state.phase !== "pick") return false;
    if (!this.state.ruleset) return false;

    const allBanned = [...this.state.teamABans, ...this.state.teamBBans];
    const allPicked = [...this.state.teamAPicks, ...this.state.teamBPicks];
    if (allBanned.includes(codename) || allPicked.includes(codename)) return false;

    this.saveSnapshot();

    const { pickOrder } = this.state.ruleset;
    const actingTeam = pickOrder[this.state.currentStep];

    const newTeamAPicks = actingTeam === 0 ? [...this.state.teamAPicks, codename] : [...this.state.teamAPicks];
    const newTeamBPicks = actingTeam === 1 ? [...this.state.teamBPicks, codename] : [...this.state.teamBPicks];

    const nextStep = this.state.currentStep + 1;

    if (nextStep >= pickOrder.length) {
      this.state = {
        ...this.state,
        teamAPicks: newTeamAPicks,
        teamBPicks: newTeamBPicks,
        phase: "complete",
        currentStep: nextStep,
        currentTeam: null,
      };
    } else {
      this.state = {
        ...this.state,
        teamAPicks: newTeamAPicks,
        teamBPicks: newTeamBPicks,
        currentStep: nextStep,
        currentTeam: pickOrder[nextStep] as 0 | 1,
      };
    }

    this.emit();
    return true;
  }

  undo(): boolean {
    if (this.historyIndex <= 0) return false;
    this.historyIndex--;
    const snap = this.history[this.historyIndex];
    this.state = { ...snap, canUndo: false, canRedo: false };
    this.emit();
    return true;
  }

  redo(): boolean {
    if (this.historyIndex >= this.history.length - 1) return false;
    this.historyIndex++;
    const snap = this.history[this.historyIndex];
    this.state = { ...snap, canUndo: false, canRedo: false };
    this.emit();
    return true;
  }

  restart(newRuleset?: DraftRuleset) {
    const { ruleset: existingRuleset, pendingTeam1Name, pendingTeam2Name } = this.state;
    const ruleset = newRuleset ?? existingRuleset;
    if (!ruleset) return;
    this.state = {
      ...this.initialState(),
      phase: "rps",
      ruleset,
      pendingTeam1Name,
      pendingTeam2Name,
    };
    this.history = [];
    this.historyIndex = -1;
    this.saveSnapshot();
    this.emit();
  }
}

export const draftStore = new DraftStore();

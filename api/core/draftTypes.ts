export interface DraftCharacter {
  codename: string;
  displayName: string;
  imagePath: string;
}

export interface DraftRuleset {
  name: string;
  teamSize: number;
  banOrder: number[]; // 0=teamA, 1=teamB for each ban step
  pickOrder: number[]; // 0=teamA, 1=teamB for each pick step
  characters: DraftCharacter[];
}

export interface DraftState {
  phase: "idle" | "rps" | "ban" | "pick" | "complete";
  pendingTeam1Name: string;
  pendingTeam2Name: string;
  teamAName: string;
  teamBName: string;
  teamABans: string[];
  teamBBans: string[];
  teamAPicks: string[];
  teamBPicks: string[];
  currentStep: number;
  currentTeam: 0 | 1 | null;
  ruleset: DraftRuleset | null;
  canUndo: boolean;
  canRedo: boolean;
}


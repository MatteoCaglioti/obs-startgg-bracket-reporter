export interface DraftCharacter {
  codename: string;
  displayName: string;
  imagePath: string;
}

export interface Ruleset {
  name: string;
  characters: DraftCharacter[];
  strikeOrder: number[];
  banCount: number;
  totalBans: number;
  totalPicks: number;
  useDSR: boolean;
  useMDSR: boolean;
}

export interface DraftState {
  matchId: string | null;
  p1Name: string;
  p2Name: string;
  ruleset: Ruleset | null;
  currGame: number;
  currPlayer: number;
  currStep: number;
  phase: "ban" | "pick" | "complete";
  strikedStages: Record<number, string[]>;
  strikedBy: [string[], string[]];
  charactersPicked: string[];
  selectedCharacter: string | null;
  lastWinner: number;
  gentlemans: boolean;
  canUndo: boolean;
  canRedo: boolean;
}

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
  currPlayer: number;       // 0 = P1, 1 = P2, -1 = not started
  currStep: number;
  phase: "ban" | "pick" | "complete";
  // strikedStages[step] = array of codenames selected during that step
  strikedStages: Record<number, string[]>;
  // strikedBy[0] = all codenames selected by P1, strikedBy[1] = by P2
  strikedBy: [string[], string[]];
  // ordered list of picked characters (for all games)
  charactersPicked: string[];
  selectedCharacter: string | null;  // highlighted pick (not yet confirmed)
  lastWinner: number;                // -1 if no game won yet
  gentlemans: boolean;
  canUndo: boolean;
  canRedo: boolean;
}

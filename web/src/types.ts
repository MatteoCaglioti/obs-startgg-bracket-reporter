export type Match = {
  id: string;
  round: string;

  player1: { id: string; name: string };
  player2: { id: string; name: string };

  score1: number;
  score2: number;

  streamId: string | null;
  status: "idle" | "assigned" | "live" | "saved" | "complete";
};

export type TournamentStream = {
  id: string;
  name: string;
  source: string | null;
};

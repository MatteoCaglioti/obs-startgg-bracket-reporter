import axios from "axios";

export const assignMatch = async (matchId: string, streamId: string) => {
  const res = await axios.post(`/assign`, {
    matchId,
    streamId,
  });

  return res.data;
};

export const unassignMatch = async (matchId: string) => {
  const res = await axios.post(`/unassign`, {
    matchId,
  });

  return res.data;
};

export const startMatch = async (matchId: string) => {
  const res = await axios.post(`/start`, {
    matchId,
  });

  return res.data;
};

export const updateScore = async (
  matchId: string,
  score1: number,
  score2: number,
) => {
  const res = await axios.post(`/updateScoreLocal`, {
    matchId,
    score1,
    score2,
  });

  return res.data;
};

export const resetScore = async (matchId: string) => {
  const res = await axios.post(`/resetScore`, {
    matchId,
  });

  return res.data;
};

export const createOfflineMatch = async (
  player1Name: string,
  player2Name: string,
  matchLabel: string,
) => {
  const res = await axios.post(`/offline`, {
    player1Name,
    player2Name,
    matchLabel,
  });

  return res.data;
};

export const updateOfflineMatch = async (
  player1Name: string,
  player2Name: string,
  matchLabel: string,
) => {
  const res = await axios.post(`/offline/update`, {
    player1Name,
    player2Name,
    matchLabel,
  });

  return res.data;
};

export const getMatches = async () => {
  const res = await axios.get(`/matches`);
  return res.data;
};

export const getStreams = async () => {
  const res = await axios.get(`/streams`);
  return res.data;
};

export const saveResult = async (matchId: string) => {
  const res = await axios.post(`/saveResult`, {
    matchId,
  });

  return res.data;
};

export const submitFinalResult = async (matchId: string) => {
  const res = await axios.post(`/submitFinal`, {
    matchId,
  });

  return res.data;
};

export const refreshStartGG = async () => {
  const res = await axios.post(`/refresh`);
  return res.data;
};

export const getConfig = async () => {
  const res = await axios.get(`/config`);
  return res.data;
};

export const saveConfig = async (
  STARTGG_API_TOKEN: string | undefined,
  TOURNAMENT_SLUG: string,
) => {
  const res = await axios.post(`/config`, {
    STARTGG_API_TOKEN,
    TOURNAMENT_SLUG,
  });

  return res.data;
};

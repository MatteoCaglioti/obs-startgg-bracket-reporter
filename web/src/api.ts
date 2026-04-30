import axios from "axios";

const API = "";

export const assignMatch = async (matchId: string, streamId: string) => {
  const res = await axios.post(`${API}/assign`, {
    matchId,
    streamId,
  });

  return res.data;
};

export const unassignMatch = async (matchId: string) => {
  const res = await axios.post(`${API}/unassign`, {
    matchId,
  });

  return res.data;
};

export const startMatch = async (matchId: string) => {
  const res = await axios.post(`${API}/start`, {
    matchId,
  });

  return res.data;
};

export const updateScore = async (
  matchId: string,
  score1: number,
  score2: number,
) => {
  const res = await axios.post(`${API}/updateScoreLocal`, {
    matchId,
    score1,
    score2,
  });

  return res.data;
};

export const getMatches = async () => {
  const res = await axios.get(`${API}/matches`);
  return res.data;
};

export const getStreams = async () => {
  const res = await axios.get(`${API}/streams`);
  return res.data;
};

export const saveResult = async (matchId: string) => {
  const res = await axios.post(`${API}/saveResult`, {
    matchId,
  });

  return res.data;
};

export const submitFinalResult = async (matchId: string) => {
  const res = await axios.post(`${API}/submitFinal`, {
    matchId,
  });

  return res.data;
};

export const refreshStartGG = async () => {
  const res = await axios.post(`${API}/refresh`);
  return res.data;
};

export const getConfig = async () => {
  const res = await axios.get(`${API}/config`);
  return res.data;
};

export const saveConfig = async (
  STARTGG_API_TOKEN: string,
  TOURNAMENT_SLUG: string,
) => {
  const res = await axios.post(`${API}/config`, {
    STARTGG_API_TOKEN,
    TOURNAMENT_SLUG,
  });

  return res.data;
};

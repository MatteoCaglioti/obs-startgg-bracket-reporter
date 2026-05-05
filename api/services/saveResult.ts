import { gql } from "graphql-request";
import { startggClient } from "./startgg";
import type { Match } from "../core/types";

const UPDATE_BRACKET_SET = gql`
  mutation UpdateBracketSet($setId: ID!, $gameData: [BracketSetGameDataInput]) {
    updateBracketSet(setId: $setId, gameData: $gameData) {
      id
      state
    }
  }
`;

function buildGameData(match: Match) {
  const gameData = [];
  let gameNum = 1;

  for (let i = 0; i < match.score1; i++) {
    gameData.push({
      gameNum,
      winnerId: Number(match.player1.id),
    });
    gameNum++;
  }

  for (let i = 0; i < match.score2; i++) {
    gameData.push({
      gameNum,
      winnerId: Number(match.player2.id),
    });
    gameNum++;
  }

  return gameData;
}

export async function saveScoresToStartGG(match: Match) {
  const gameData = buildGameData(match);

  return startggClient.request(UPDATE_BRACKET_SET, {
    setId: match.id,
    gameData,
  });
}

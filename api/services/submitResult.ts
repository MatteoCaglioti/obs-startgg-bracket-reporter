import { gql } from "graphql-request";
import { startggClient } from "./startgg";
import type { Match } from "../core/types";

const RESET_SET = gql`
  mutation ResetSet($setId: ID!) {
    resetSet(setId: $setId) {
      id
      state
    }
  }
`;

const REPORT_BRACKET_SET = gql`
  mutation ReportBracketSet(
    $setId: ID!
    $winnerId: ID!
    $gameData: [BracketSetGameDataInput]
  ) {
    reportBracketSet(setId: $setId, winnerId: $winnerId, gameData: $gameData) {
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

export async function finalSubmitResultToStartGG(match: Match) {
  const winnerId =
    match.score1 > match.score2
      ? Number(match.player1.id)
      : Number(match.player2.id);

  await startggClient.request(RESET_SET, {
    setId: match.id,
  });

  return startggClient.request(REPORT_BRACKET_SET, {
    setId: match.id,
    winnerId,
    gameData: buildGameData(match),
  });
}

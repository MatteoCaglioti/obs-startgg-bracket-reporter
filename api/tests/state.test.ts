import assert from "node:assert/strict";
import test from "node:test";
import { draftStore } from "../core/draftStore";
import type { DraftRuleset } from "../core/draftTypes";
import { reducer } from "../core/reducer";
import type { Match } from "../core/types";

const ruleset: DraftRuleset = {
  name: "Test",
  teamSize: 1,
  banOrder: [0, 1],
  pickOrder: [0, 1],
  characters: [
    { codename: "A", displayName: "A", imagePath: "/a.png" },
    { codename: "B", displayName: "B", imagePath: "/b.png" },
    { codename: "C", displayName: "C", imagePath: "/c.png" },
    { codename: "D", displayName: "D", imagePath: "/d.png" },
  ],
};

test("draft undo and redo restore the adjacent state", () => {
  draftStore.restart();
  draftStore.start(ruleset, "Team A", "Team B");
  draftStore.setRpsWinner(1);
  assert.equal(draftStore.lockIn(["A"]), true);

  assert.deepEqual(draftStore.getState().teamABans, ["A"]);
  assert.equal(draftStore.getState().phase, "ban");
  assert.equal(draftStore.getState().currentStep, 1);

  assert.equal(draftStore.undo(), true);
  assert.deepEqual(draftStore.getState().teamABans, []);
  assert.equal(draftStore.getState().phase, "ban");
  assert.equal(draftStore.getState().currentStep, 0);

  assert.equal(draftStore.redo(), true);
  assert.deepEqual(draftStore.getState().teamABans, ["A"]);
  assert.equal(draftStore.getState().currentStep, 1);

  draftStore.restart();
});

test("successful final submission can complete a live match", () => {
  const match: Match = {
    id: "set-1",
    round: "Winners Final",
    player1: { id: "1", name: "Player 1" },
    player2: { id: "2", name: "Player 2" },
    score1: 3,
    score2: 1,
    streamId: "stream-1",
    status: "live",
    updatedAt: 0,
  };

  const result = reducer(
    { [match.id]: match },
    { type: "MATCH_COMPLETED", matchId: match.id },
  );

  assert.equal(result[match.id].status, "complete");
  assert.equal(result[match.id].streamId, null);
});

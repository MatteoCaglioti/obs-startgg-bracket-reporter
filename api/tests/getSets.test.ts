import assert from "node:assert/strict";
import test from "node:test";
import { getSets } from "../services/getSets";
import { startggClient } from "../services/startgg";

test("getSets fetches every tournament event page", async () => {
  const originalRequest = startggClient.request;
  const requestedPages: number[] = [];

  startggClient.request = async (_document, variables) => {
    const page = variables.page as number;
    requestedPages.push(page);

    return {
      tournament: {
        events: [
          {
            sets: {
              pageInfo: { totalPages: 2 },
              nodes: page === 1 ? [{ id: "set-1" }] : [{ id: "set-2" }],
            },
          },
          {
            sets: {
              pageInfo: { totalPages: 1 },
              nodes: page === 1 ? [{ id: "set-3" }] : [],
            },
          },
        ],
      },
    };
  };

  try {
    const sets = await getSets("tournament/test");

    assert.deepEqual(requestedPages, [1, 2]);
    assert.deepEqual(
      sets.map((set) => set.id),
      ["set-1", "set-3", "set-2"],
    );
  } finally {
    startggClient.request = originalRequest;
  }
});

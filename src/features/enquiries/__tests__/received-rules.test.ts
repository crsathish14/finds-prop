import { describe, expect, it } from "vitest";
import { movesFrom } from "../received-rules";

describe("movesFrom: the buttons an enquiry offers by its state (S6-T03)", () => {
  it("lets New be marked contacted or closed, Contacted be closed, and Closed go nowhere", () => {
    expect(movesFrom("new")).toEqual(["contacted", "closed"]);
    expect(movesFrom("contacted")).toEqual(["closed"]);
    expect(movesFrom("closed")).toEqual([]);
  });
});

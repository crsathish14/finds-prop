import { describe, expect, it } from "vitest";
import { SWEEP_AFTER_HOURS, SWEEP_BATCH } from "../constants";
import { sameSecret, sweepOrphanPhotos, type SweepStore } from "../sweep";

const TOKEN = "test-token-not-real-0123456789abcdef";

function store(options: { token?: string | null; orphans?: string[] } = {}) {
  const calls: string[] = [];
  const stand: SweepStore = {
    readToken: async () => (options.token === undefined ? TOKEN : options.token),
    listOrphans: async (hours, limit) => {
      calls.push(`list:${hours}:${limit}`);
      return options.orphans ?? [];
    },
    removeObjects: async (paths) => {
      calls.push(`remove:${paths.join(",")}`);
    },
  };
  return { stand, calls };
}

describe("UT-media-sweep: removing photo files nobody claimed (ADR-015 step 4)", () => {
  it("removes what the database lists, after 24 hours, in a bounded batch", async () => {
    const { stand, calls } = store({ orphans: ["a/b/1.jpg", "a/b/2.png"] });
    const result = await sweepOrphanPhotos(stand, TOKEN);
    expect(result).toEqual({ allowed: true, removed: 2 });
    expect(calls).toEqual([
      `list:${SWEEP_AFTER_HOURS}:${SWEEP_BATCH}`,
      "remove:a/b/1.jpg,a/b/2.png",
    ]);
    expect(SWEEP_AFTER_HOURS).toBe(24);
  });

  it("does not call the storage service when there is nothing to remove", async () => {
    const { stand, calls } = store({ orphans: [] });
    await expect(sweepOrphanPhotos(stand, TOKEN)).resolves.toEqual({ allowed: true, removed: 0 });
    expect(calls).toEqual([`list:${SWEEP_AFTER_HOURS}:${SWEEP_BATCH}`]);
  });

  it.each([
    ["no token sent", null],
    ["an empty token", ""],
    ["a wrong token", "test-token-not-real-0123456789abcdee"],
    ["a token of another length", "short"],
  ])("lets nobody in with %s, and lists and removes nothing", async (_label, sent) => {
    const { stand, calls } = store({ orphans: ["a/b/1.jpg"] });
    await expect(sweepOrphanPhotos(stand, sent)).resolves.toEqual({ allowed: false });
    expect(calls).toEqual([]);
  });

  it("lets nobody in when no token has been set", async () => {
    const { stand, calls } = store({ token: null, orphans: ["a/b/1.jpg"] });
    await expect(sweepOrphanPhotos(stand, TOKEN)).resolves.toEqual({ allowed: false });
    await expect(sweepOrphanPhotos(stand, "")).resolves.toEqual({ allowed: false });
    expect(calls).toEqual([]);
  });

  it("compares secrets exactly", () => {
    expect(sameSecret(TOKEN, TOKEN)).toBe(true);
    expect(sameSecret(TOKEN, `${TOKEN}x`)).toBe(false);
    expect(sameSecret("", TOKEN)).toBe(false);
  });
});

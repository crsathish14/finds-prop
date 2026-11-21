import { describe, expect, it } from "vitest";
import { SWEEP_AFTER_HOURS, SWEEP_BATCH } from "../constants";
import { sameSecret, sweepOrphanPhotos, type SweepStore } from "../sweep";

const TOKEN = "test-token-not-real-0123456789abcdef";

function store(
  options: {
    token?: string | null;
    orphans?: string[];
    blogFiles?: string[];
    blogFails?: boolean;
  } = {},
) {
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
    listOrphanBlogFiles: async (hours, limit) => {
      calls.push(`list-blog:${hours}:${limit}`);
      if (options.blogFails) throw new Error("rpc failed");
      return options.blogFiles ?? [];
    },
    removeBlogFiles: async (paths) => {
      calls.push(`remove-blog:${paths.join(",")}`);
    },
  };
  return { stand, calls };
}

describe("UT-media-sweep: removing photo files nobody claimed (ADR-015 step 4)", () => {
  it("removes what the database lists, after 24 hours, in a bounded batch", async () => {
    const { stand, calls } = store({ orphans: ["a/b/1.jpg", "a/b/2.png"] });
    const result = await sweepOrphanPhotos(stand, TOKEN);
    expect(result).toEqual({ allowed: true, removed: 2, blogFilesRemoved: 0 });
    expect(calls).toEqual([
      `list:${SWEEP_AFTER_HOURS}:${SWEEP_BATCH}`,
      "remove:a/b/1.jpg,a/b/2.png",
      `list-blog:${SWEEP_AFTER_HOURS}:${SWEEP_BATCH}`,
    ]);
    expect(SWEEP_AFTER_HOURS).toBe(24);
  });

  it("does not call the storage service when there is nothing to remove", async () => {
    const { stand, calls } = store({ orphans: [] });
    await expect(sweepOrphanPhotos(stand, TOKEN)).resolves.toEqual({
      allowed: true,
      removed: 0,
      blogFilesRemoved: 0,
    });
    expect(calls).toEqual([
      `list:${SWEEP_AFTER_HOURS}:${SWEEP_BATCH}`,
      `list-blog:${SWEEP_AFTER_HOURS}:${SWEEP_BATCH}`,
    ]);
  });

  it.each([
    ["no token sent", null],
    ["an empty token", ""],
    ["a wrong token", "test-token-not-real-0123456789abcdee"],
    ["a token of another length", "short"],
  ])("lets nobody in with %s, and lists and removes nothing", async (_label, sent) => {
    const { stand, calls } = store({ orphans: ["a/b/1.jpg"], blogFiles: ["blog/x/1.png"] });
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

describe("UT-media-sweep-blog: the picture files of purged articles (ADR-147)", () => {
  const files = [
    "blog/00000000-0000-4000-b000-000000000001/cover.png",
    "blog/00000000-0000-4000-b000-000000000001/a1.webp",
  ];

  it("removes the blog files the database lists, in the same bounded batch, after the photos", async () => {
    const { stand, calls } = store({ orphans: ["a/b/1.jpg"], blogFiles: files });
    await expect(sweepOrphanPhotos(stand, TOKEN)).resolves.toEqual({
      allowed: true,
      removed: 1,
      blogFilesRemoved: 2,
    });
    expect(calls).toEqual([
      `list:${SWEEP_AFTER_HOURS}:${SWEEP_BATCH}`,
      "remove:a/b/1.jpg",
      `list-blog:${SWEEP_AFTER_HOURS}:${SWEEP_BATCH}`,
      `remove-blog:${files.join(",")}`,
    ]);
  });

  it("does not call the storage service when no blog file is orphaned", async () => {
    const { stand, calls } = store({ blogFiles: [] });
    await sweepOrphanPhotos(stand, TOKEN);
    expect(calls.some((call) => call.startsWith("remove-blog"))).toBe(false);
  });

  it("removes the photos even when listing the blog files fails, and then fails the run", async () => {
    const { stand, calls } = store({ orphans: ["a/b/1.jpg"], blogFails: true });
    await expect(sweepOrphanPhotos(stand, TOKEN)).rejects.toThrow("rpc failed");
    expect(calls).toContain("remove:a/b/1.jpg");
  });
});

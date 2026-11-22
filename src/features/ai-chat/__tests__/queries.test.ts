import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// UT-ai-localities-read (ADR-128 section 5.1, R-BE-06, R-BE-11, ADR-171): the read behind `list_localities`. It runs
// `live_locality_names()` with the signed-in customer's own session (no shared cache), counts the names, and never
// reads a table. The database is a stand-in here; the integration test runs the same read against the real one.

const rpc = vi.fn();
const tag = vi.fn();
const life = vi.fn();
const error = vi.fn();
const from = vi.fn();

vi.mock("next/cache", () => ({ cacheTag: tag, cacheLife: life }));
vi.mock("@/server/supabase/server", () => ({ createServerSupabase: async () => ({ rpc, from }) }));
vi.mock("@/server/supabase/public", () => ({ createPublicSupabase: () => ({ from }) }));
vi.mock("@/server/logger", () => ({ logger: { error, warn: vi.fn() } }));
vi.mock("@/features/projects", () => ({
  PROJECTS_TAG: "projects",
  PROJECT_STATUSES: ["new_launch", "under_construction", "ready_to_move"],
}));

const { getLocalityCounts } = await import("../queries");

const NOW = new Date("2026-11-13T10:12:00.000Z");
const answer = (
  homes: (string | null)[],
  projects: string[] = [],
  complete: { homes?: boolean; projects?: boolean } = {},
) => ({
  data: {
    homes: homes.filter((name) => name !== null),
    homes_complete: complete.homes ?? true,
    projects,
    projects_complete: complete.projects ?? true,
  },
  error: null,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe("UT-ai-localities-read: what is asked for", () => {
  it("asks the sign-in-only function once, as the customer, and reads no table", async () => {
    rpc.mockResolvedValue(answer([]));
    await getLocalityCounts();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("live_locality_names");
    expect(from).not.toHaveBeenCalled();
  });

  it("is not cached: a cache is shared between visitors and this read is one customer's", async () => {
    rpc.mockResolvedValue(answer([]));
    await getLocalityCounts();
    expect(tag).not.toHaveBeenCalled();
    expect(life).not.toHaveBeenCalled();
  });
});

describe("UT-ai-localities-read: what comes back", () => {
  it("counts the localities of homes and projects, and says when it read them", async () => {
    rpc.mockResolvedValue(answer(["Velachery", "Velachery", "Adyar"], ["Adyar"]));
    expect(await getLocalityCounts()).toEqual({
      localities: [
        { name: "Adyar", homes: 1, projects: 1 },
        { name: "Velachery", homes: 2, projects: 0 },
      ],
      complete: true,
      readAt: "2026-11-13T10:12:00.000Z",
    });
  });

  it("gives an empty, complete list when nothing is listed", async () => {
    rpc.mockResolvedValue(answer([]));
    expect(await getLocalityCounts()).toEqual({
      localities: [],
      complete: true,
      readAt: "2026-11-13T10:12:00.000Z",
    });
  });

  it("says the counts are not complete when the database stopped at its cap of homes or of projects", async () => {
    rpc.mockResolvedValue(answer(["Velachery"], [], { homes: false }));
    expect((await getLocalityCounts()).complete).toBe(false);
    rpc.mockResolvedValue(answer(["Velachery"], ["Porur"], { projects: false }));
    expect((await getLocalityCounts()).complete).toBe(false);
  });
});

describe("UT-ai-localities-read: a failed read", () => {
  it("throws, and logs only the code", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "private detail" } });
    await expect(getLocalityCounts()).rejects.toThrow("localities could not be read");
    expect(error).toHaveBeenCalledWith(expect.any(String), { errorCode: "42501" });
    expect(JSON.stringify(error.mock.calls)).not.toContain("private detail");
  });

  it("throws, not an empty list, when the answer does not fit", async () => {
    rpc.mockResolvedValue({ data: { homes: "Velachery" }, error: null });
    await expect(getLocalityCounts()).rejects.toThrow("do not fit");
  });
});

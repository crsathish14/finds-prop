import { beforeEach, describe, expect, it, vi } from "vitest";

const read = vi.hoisted(() => ({
  overview: vi.fn(),
  places: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  unstable_rethrow: (problem: unknown) => {
    if (problem instanceof Error && problem.message === "NEXT_REDIRECT") throw problem;
  },
}));
vi.mock("@/features/site", () => ({ getTranslate: async () => () => "Overview" }));
vi.mock("@/features/admin-overview", () => ({
  AdminOverview: () => null,
  getAdminOverview: read.overview,
  getPlacesUsage: read.places,
  resolveOverviewRange: () => ({ range: "30", from: "2026-10-20", to: "2026-11-18" }),
}));

const { default: Page } = await import("../page");

const OVERVIEW = { listings: { total: 1 } };
const USAGE = { today: 3 };

async function render() {
  const element = await Page({ searchParams: Promise.resolve({}) });
  return (element as unknown as { props: Record<string, unknown> }).props;
}

beforeEach(() => vi.clearAllMocks());

describe("the admin dashboard page (PR 6b, ADR-134)", () => {
  it("passes the overview and the place search numbers to the screen", async () => {
    read.overview.mockResolvedValue(OVERVIEW);
    read.places.mockResolvedValue(USAGE);
    const props = await render();
    expect(props["path"]).toBe("/admin/dashboard");
    expect(props["state"]).toMatchObject({ ok: true, overview: OVERVIEW });
    expect(props["placesUsage"]).toEqual({ ok: true, usage: USAGE });
  });

  it("passes null for no calls yet, so the card shows its empty state", async () => {
    read.overview.mockResolvedValue(OVERVIEW);
    read.places.mockResolvedValue(null);
    expect((await render())["placesUsage"]).toEqual({ ok: true, usage: null });
  });

  it("still renders the overview when the place search read fails", async () => {
    read.overview.mockResolvedValue(OVERVIEW);
    read.places.mockRejectedValue({ code: "42501" });
    const props = await render();
    expect(props["state"]).toMatchObject({ ok: true, overview: OVERVIEW });
    expect(props["placesUsage"]).toEqual({ ok: false });
  });

  it("still shows the place search numbers when the overview read fails", async () => {
    read.overview.mockRejectedValue(new Error("down"));
    read.places.mockResolvedValue(USAGE);
    const props = await render();
    expect(props["state"]).toEqual({ ok: false });
    expect(props["placesUsage"]).toEqual({ ok: true, usage: USAGE });
  });

  it("reads the place search numbers for the moment of the visit", async () => {
    read.overview.mockResolvedValue(OVERVIEW);
    read.places.mockResolvedValue(null);
    await render();
    expect(read.places).toHaveBeenCalledWith(expect.any(Date));
  });

  it("lets a redirect through instead of calling it a failed read", async () => {
    read.overview.mockResolvedValue(OVERVIEW);
    read.places.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(render()).rejects.toThrow("NEXT_REDIRECT");
  });
});

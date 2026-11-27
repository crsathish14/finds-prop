import { beforeEach, describe, expect, it, vi } from "vitest";

// UT-ai-locality-centre (ADR-216): the centre of a locality comes from what we already hold: the admin's curated
// localities first, else the mean of the live projects' points in it. Never a paid lookup; a failure is no centre.

const settings = vi.hoisted(() => ({
  localities: [] as { label: string; lat: number; lng: number; radiusKm: number }[],
}));
const query = vi.hoisted(() => ({
  rows: [] as unknown[],
  error: null as null | { code: string },
  pattern: "",
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/features/site", () => ({
  getSiteSettings: async () => ({ homepage: { localities: settings.localities } }),
}));
vi.mock("@/server/supabase/server", () => ({
  createServerSupabase: async () => {
    const chain = {
      from: () => chain,
      select: () => chain,
      not: () => chain,
      ilike: (_column: string, pattern: string) => {
        query.pattern = pattern;
        return chain;
      },
      limit: async () => ({ data: query.rows, error: query.error }),
    };
    return chain;
  },
}));

const { getLocalityCentre } = await import("../reads.server");

const isVelachery = (name: string) => name.toLowerCase().includes("velachery");

beforeEach(() => {
  settings.localities = [];
  query.rows = [];
  query.error = null;
  query.pattern = "";
});

describe("UT-ai-locality-centre", () => {
  it("takes a curated locality's own point first", async () => {
    settings.localities = [{ label: "Velachery", lat: 12.98, lng: 80.22, radiusKm: 3 }];
    expect(await getLocalityCentre("Velachery", isVelachery)).toEqual({ lat: 12.98, lng: 80.22 });
    expect(query.pattern).toBe("");
  });

  it("else takes the mean of the live projects' points in that locality, and only theirs", async () => {
    query.rows = [
      { locality: "Velachery", latitude: 12.9, longitude: 80.2 },
      { locality: "Velachery Main Road", latitude: 13.1, longitude: 80.4 },
      { locality: "Adyar", latitude: 50, longitude: 50 },
    ];
    const centre = await getLocalityCentre("Velachery", isVelachery);
    expect(centre?.lat).toBeCloseTo(13.0);
    expect(centre?.lng).toBeCloseTo(80.3);
  });

  it("matches the typed words literally, so a % or _ in them is not a wildcard", async () => {
    await getLocalityCentre("50%_off", () => true);
    expect(query.pattern).toBe("%50\\%\\_off%");
  });

  it("is none when nothing holds a point, and when the read fails", async () => {
    expect(await getLocalityCentre("Velachery", isVelachery)).toBeNull();
    query.error = { code: "42501" };
    expect(await getLocalityCentre("Velachery", isVelachery)).toBeNull();
  });
});

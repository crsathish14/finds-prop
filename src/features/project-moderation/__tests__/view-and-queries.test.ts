import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/types/database.types";

vi.mock("server-only", () => ({}));
vi.mock("@/server/supabase/server", () => ({ createServerSupabase: vi.fn() }));

const { readAdminProjects } = await import("../queries");
const { toAdminProjectRows } = await import("../view");
const { PROJECT_LIST_MAX } = await import("../constants");

const ROW = {
  id: "00000000-0000-4000-c000-000000000001",
  name: "Kadal Vista",
  slug: "kadal-vista",
  locality: "OMR Navalur",
  price_min: 7800000,
  price_max: 11200000,
  cover: "a/1.jpg",
  moderation: "pending",
  published: false,
  featured: false,
  builder_id: "00000000-0000-4000-b000-000000000001",
  builder_name: "Kadal Homes",
  leads: 3,
  created_at: "2026-11-01T10:00:00+00:00",
};

function clientAnswering(answer: { data: unknown; error: { code?: string } | null }) {
  const limit = vi.fn(async () => answer);
  const rpc = vi.fn(() => ({ limit }));
  return { client: { rpc } as unknown as SupabaseClient<Database>, rpc, limit };
}

describe("UT-project-moderation-view: the admin's rows (S7-T04)", () => {
  it("turns a row from the database into the page's row", () => {
    expect(toAdminProjectRows([ROW])).toEqual({
      projects: [
        {
          id: ROW.id,
          name: "Kadal Vista",
          slug: "kadal-vista",
          locality: "OMR Navalur",
          priceMin: 7800000,
          priceMax: 11200000,
          cover: "a/1.jpg",
          moderation: "pending",
          published: false,
          featured: false,
          builderId: ROW.builder_id,
          builderName: "Kadal Homes",
          leads: 3,
        },
      ],
      skipped: 0,
    });
  });

  it("keeps an empty price and picture as none", () => {
    const { projects } = toAdminProjectRows([
      { ...ROW, price_min: null, price_max: null, cover: null },
    ]);
    expect(projects[0]).toMatchObject({ priceMin: null, priceMax: null, cover: null });
  });

  it("leaves out a row that is not in the expected shape, and counts it", () => {
    const answer = toAdminProjectRows([ROW, { ...ROW, leads: -1 }, { name: "no id" }, null]);
    expect(answer.projects).toHaveLength(1);
    expect(answer.skipped).toBe(3);
  });

  it("reads nothing as an empty list", () => {
    expect(toAdminProjectRows(null)).toEqual({ projects: [], skipped: 0 });
  });
});

describe("UT-project-moderation-queries: reading the admin's projects (S7-T04)", () => {
  it("asks for one more than the page reads, and says the list was not cut when it was not", async () => {
    const { client, rpc, limit } = clientAnswering({ data: [ROW], error: null });
    const list = await readAdminProjects(client);
    expect(rpc).toHaveBeenCalledWith("admin_project_overview");
    expect(limit).toHaveBeenCalledWith(PROJECT_LIST_MAX + 1);
    expect(list).toMatchObject({ truncated: false });
    expect(list.projects).toHaveLength(1);
  });

  it("drops the extra row and says so when the list was cut", async () => {
    const rows = Array.from({ length: PROJECT_LIST_MAX + 1 }, (_unused, index) => ({
      ...ROW,
      id: `00000000-0000-4000-c000-${String(index).padStart(12, "0")}`,
    }));
    const { client } = clientAnswering({ data: rows, error: null });
    const list = await readAdminProjects(client);
    expect(list.truncated).toBe(true);
    expect(list.projects).toHaveLength(PROJECT_LIST_MAX);
  });

  it("throws when the database says no, so the portal's error page shows it", async () => {
    const { client } = clientAnswering({ data: null, error: { code: "42501" } });
    await expect(readAdminProjects(client)).rejects.toMatchObject({ code: "42501" });
  });
});

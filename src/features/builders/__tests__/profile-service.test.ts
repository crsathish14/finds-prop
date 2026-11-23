import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { Database } from "@/types/database.types";
import { saveMyProfile } from "../profile-service";

const BUILDER = "00000000-0000-4000-b000-000000000001";

type Answer = { data: { id: string }[] | null; error: { code?: string; message?: string } | null };

/** A stand-in for the signed-in builder's client: what `my_builder()` finds, and what the update answers. */
function clientWith(options: { mine?: Answer; saved?: Answer }) {
  const written: Record<string, unknown>[] = [];
  const filters: [string, unknown][] = [];
  const mine = options.mine ?? { data: [{ id: BUILDER }], error: null };
  const saved = options.saved ?? { data: [{ id: BUILDER }], error: null };
  const client = {
    rpc: (name: string) => ({
      select: () => Promise.resolve(name === "my_builder" ? mine : { data: null, error: null }),
    }),
    from: () => ({
      update: (row: Record<string, unknown>) => {
        written.push(row);
        return {
          eq: (column: string, value: unknown) => {
            filters.push([column, value]);
            return { select: () => Promise.resolve(saved) };
          },
        };
      },
    }),
  } as unknown as SupabaseClient<Database>;
  return { client, written, filters };
}

describe("UT-builder-profile-service: saving the builder's own profile (S7-T03)", () => {
  it("writes only the profile columns to the builder's own record, a blank box as null", async () => {
    const { client, written, filters } = clientWith({});
    const done = await saveMyProfile(client, {
      name: "Kadal Homes",
      contactPerson: null,
      phone: "+919841055512",
      website: "https://kadalhomes.example",
    });
    expect(done).toEqual({ builderId: BUILDER });
    expect(filters).toEqual([["id", BUILDER]]);
    expect(written).toEqual([
      {
        name: "Kadal Homes",
        contact_person: null,
        phone: "+919841055512",
        logo_url: null,
        website: "https://kadalhomes.example",
        description: null,
        tagline: null,
        established_year: null,
        projects_delivered: null,
        logo_path: null,
      },
    ]);
  });

  it("saves the spotlight fields and a logo from the builder's own folder (ADR-179)", async () => {
    const { client, written } = clientWith({});
    await saveMyProfile(client, {
      name: "Kadal Homes",
      tagline: "Homes by the sea",
      establishedYear: 2004,
      projectsDelivered: 18,
      logoPath: `${BUILDER}/logo-1.webp`,
    });
    expect(written[0]).toMatchObject({
      tagline: "Homes by the sea",
      established_year: 2004,
      projects_delivered: 18,
      logo_path: `${BUILDER}/logo-1.webp`,
    });
  });

  it("refuses a logo from another builder's folder and writes nothing", async () => {
    const { client, written } = clientWith({});
    await expect(
      saveMyProfile(client, {
        name: "Kadal Homes",
        logoPath: "00000000-0000-4000-b000-000000000002/logo-1.webp",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    expect(written).toEqual([]);
  });

  it("finds nothing for an account with no active builder record", async () => {
    const { client, written } = clientWith({ mine: { data: [], error: null } });
    await expect(saveMyProfile(client, { name: "Kadal Homes" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(written).toEqual([]);
  });

  it("finds nothing when the database lets the update change no row", async () => {
    const { client } = clientWith({ saved: { data: [], error: null } });
    await expect(saveMyProfile(client, { name: "Kadal Homes" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("says forbidden when the database refuses the write, and gives nothing else away", async () => {
    const { client } = clientWith({
      saved: { data: null, error: { code: "42501", message: "permission denied for table" } },
    });
    await expect(saveMyProfile(client, { name: "Kadal Homes" })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "You don't have permission to do that.",
    });
  });

  it("says the profile could not be saved when the read of the record fails", async () => {
    const { client } = clientWith({ mine: { data: null, error: { code: "XX000" } } });
    await expect(saveMyProfile(client, { name: "Kadal Homes" })).rejects.toMatchObject({
      code: "INTERNAL",
    });
  });
});

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
      },
    ]);
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

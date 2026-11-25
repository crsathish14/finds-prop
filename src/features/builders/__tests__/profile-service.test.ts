import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { Database } from "@/types/database.types";
import { pictureFile, withHiddenData } from "../../../../tests/image-files";
import { saveMyProfile } from "../profile-service";

const BUILDER = "00000000-0000-4000-b000-000000000001";

type Answer = { data: { id: string }[] | null; error: { code?: string; message?: string } | null };

/**
 * A stand-in for the signed-in builder's client: what `my_builder()` finds, the logo on record, the files in the logo
 * bucket (by path), and what the update answers.
 */
function clientWith(options: {
  mine?: Answer;
  saved?: Answer;
  currentLogo?: string | null;
  files?: Record<string, Uint8Array>;
}) {
  const written: Record<string, unknown>[] = [];
  const filters: [string, unknown][] = [];
  const downloaded: string[] = [];
  const mine = options.mine ?? { data: [{ id: BUILDER }], error: null };
  const saved = options.saved ?? { data: [{ id: BUILDER }], error: null };
  const client = {
    rpc: (name: string) => ({
      select: () => Promise.resolve(name === "my_builder" ? mine : { data: null, error: null }),
    }),
    from: () => ({
      select: () => ({
        eq: () =>
          Promise.resolve({ data: [{ logo_path: options.currentLogo ?? null }], error: null }),
      }),
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
    storage: {
      from: () => ({
        download: async (path: string) => {
          downloaded.push(path);
          const found = options.files?.[path];
          return found
            ? { data: new Blob([found as BlobPart]), error: null }
            : { data: null, error: { message: "not found" } };
        },
      }),
    },
  } as unknown as SupabaseClient<Database>;
  return { client, written, filters, downloaded };
}

const NEW_LOGO = `${BUILDER}/logo-1.webp`;
const cleanLogo = async () => new Uint8Array(await pictureFile("image/webp", 20).arrayBuffer());

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
    const { client, written } = clientWith({ files: { [NEW_LOGO]: await cleanLogo() } });
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

  it("reads a new logo back from the bucket and refuses one that still has hidden data, writing nothing", async () => {
    const dirty = withHiddenData(new Uint8Array(await pictureFile("image/png", 20).arrayBuffer()));
    const { client, written, downloaded } = clientWith({ files: { [NEW_LOGO]: dirty } });
    await expect(
      saveMyProfile(client, { name: "Kadal Homes", logoPath: NEW_LOGO }),
    ).rejects.toMatchObject({
      code: "VALIDATION",
      fieldErrors: { logoPath: [{ key: "validation.logoHidden" }] },
    });
    expect(downloaded).toEqual([NEW_LOGO]);
    expect(written).toEqual([]);
  });

  it("refuses a logo that is not in the bucket or cannot be read as a picture, writing nothing", async () => {
    const missing = clientWith({ files: {} });
    await expect(
      saveMyProfile(missing.client, { name: "Kadal Homes", logoPath: NEW_LOGO }),
    ).rejects.toMatchObject({ fieldErrors: { logoPath: [{ key: "validation.invalid" }] } });
    const notAPicture = clientWith({ files: { [NEW_LOGO]: new TextEncoder().encode("<svg/>") } });
    await expect(
      saveMyProfile(notAPicture.client, { name: "Kadal Homes", logoPath: NEW_LOGO }),
    ).rejects.toMatchObject({ fieldErrors: { logoPath: [{ key: "validation.invalid" }] } });
    expect(missing.written).toEqual([]);
    expect(notAPicture.written).toEqual([]);
  });

  it("does not read the logo on record again when it is saved unchanged", async () => {
    const { client, written, downloaded } = clientWith({ currentLogo: NEW_LOGO, files: {} });
    await saveMyProfile(client, { name: "Kadal Homes", logoPath: NEW_LOGO });
    expect(downloaded).toEqual([]);
    expect(written[0]).toMatchObject({ logo_path: NEW_LOGO });
  });

  it("does not read anything for a profile saved with no logo", async () => {
    const { client, downloaded } = clientWith({});
    await saveMyProfile(client, { name: "Kadal Homes" });
    expect(downloaded).toEqual([]);
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

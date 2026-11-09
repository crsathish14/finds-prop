import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { jpeg, png, webpLossless } from "@/features/site-content/__tests__/sponsor-fixtures";
import type { Json } from "@/types/database.types";
import { adminClient, visitorClient } from "./support/clients";
import {
  removeTestAdmin,
  removeTestUser,
  signInTestAdmin,
  signInTestCustomer,
  type TestUser,
} from "./support/users";

// Outside a request there is no cookie or header store; the store below takes its client directly.
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ getAll: () => [], set: () => undefined }),
}));

const { sponsorStore } = await import("@/features/site-content/sponsors.server");
const { saveSponsorsContent } = await import("@/features/site-content/sponsor-service");
const { sponsorsInputSchema } = await import("@/features/site-content/sponsor-schemas");
const { readSiteContent } = await import("@/features/site-content/queries");
const { toSponsorAds, SPONSOR_BUCKET } = await import("@/features/site");
const { ActionError } = await import("@/server/actions/normalise-error");

async function failureOf(run: () => Promise<unknown>) {
  try {
    await run();
  } catch (error) {
    if (error instanceof ActionError) return error;
    throw error;
  }
  throw new Error("expected the call to fail");
}

const RUN = Date.now().toString(36);
const ONE = `it-sponsor-${RUN}-1`;
const TWO = `it-sponsor-${RUN}-2`;
const file = (id: string, name: string) => `sponsors/${id}/${name}`;

describe("IT-sponsors: the sponsor manager against a real database and bucket (S7-T11, FR-ADM-11)", () => {
  const admin = adminClient();
  let staff: TestUser;
  let customer: TestUser;
  let original: { key: string; value: NonNullable<Json> }[] = [];
  const uploaded: string[] = [];

  const upload = async (
    client: TestUser["client"],
    path: string,
    bytes: Uint8Array,
    type: string,
  ) => client.storage.from(SPONSOR_BUCKET).upload(path, bytes, { contentType: type, upsert: true });

  const put = async (path: string, bytes: Uint8Array, type: string) => {
    const { error } = await upload(staff.client, path, bytes, type);
    if (error) throw new Error(`Could not upload the test picture (${error.message})`);
    uploaded.push(path);
  };

  const exists = async (path: string) => {
    const { data } = await admin.storage.from(SPONSOR_BUCKET).download(path);
    return data !== null;
  };

  const storedAds = async () => {
    const { data, error } = await admin
      .from("site_settings")
      .select("value")
      .eq("key", "sponsors")
      .maybeSingle();
    if (error) throw new Error(`Could not read the sponsors (${error.code})`);
    const value = data?.value as { ads?: unknown[] } | null | undefined;
    return value?.ads ?? [];
  };

  beforeAll(async () => {
    staff = await signInTestAdmin();
    customer = await signInTestCustomer();
    const { data, error } = await admin
      .from("site_settings")
      .select("key, value")
      .in("key", ["sponsors"]);
    if (error) throw new Error(`Could not keep the settings (${error.code})`);
    original = data;
  });

  afterAll(async () => {
    await admin.from("site_settings").delete().in("key", ["sponsors"]);
    if (original.length > 0) await admin.from("site_settings").insert(original);
    if (uploaded.length > 0) await admin.storage.from(SPONSOR_BUCKET).remove(uploaded);
    await removeTestUser();
    await removeTestAdmin();
  });

  it("only the super admin may write the bucket: a customer and a visitor are refused", async () => {
    for (const client of [customer.client, visitorClient()]) {
      const { error } = await upload(client, file(ONE, "nope.png"), png(1940, 180), "image/png");
      expect(error).not.toBeNull();
    }
    expect(await exists(file(ONE, "nope.png"))).toBe(false);
  });

  it("measures the stored files itself and saves a sponsor the public side accepts", async () => {
    await put(file(ONE, "strip-d.png"), png(1940, 180, 90_000), "image/png");
    await put(file(ONE, "strip-c.jpg"), jpeg(640, 200, 40_000), "image/jpeg");
    await put(file(ONE, "panel-d.webp"), webpLossless(1048, 988, 110_000), "image/webp");
    await put(file(ONE, "panel-c.png"), png(1280, 640, 80_000), "image/png");

    const done = await saveSponsorsContent(
      sponsorStore(staff.client),
      sponsorsInputSchema.parse({
        sponsors: [
          {
            id: ONE,
            advertiser: "Integration Sponsor",
            alt: "Integration Sponsor: a test banner.",
            href: "https://sponsor.example/landing",
            active: true,
            strip: { desktop: file(ONE, "strip-d.png"), compact: file(ONE, "strip-c.jpg") },
            panel: { desktop: file(ONE, "panel-d.webp"), compact: file(ONE, "panel-c.png") },
          },
        ],
      }),
    );
    expect(done).toEqual({ count: 1, active: 1 });

    const ads = await storedAds();
    expect(ads).toHaveLength(1);
    expect(ads[0]).toMatchObject({
      id: ONE,
      advertiser: "Integration Sponsor",
      placements: ["hero", "results"],
      strip: {
        desktop: { path: file(ONE, "strip-d.png"), width: 1940, height: 180, bytes: 90_000 },
        compact: { width: 640, height: 200, bytes: 40_000 },
      },
      panel: { desktop: { width: 1048, height: 988 }, compact: { width: 1280, height: 640 } },
    });
    // The public side's own reader takes every stored sponsor: nothing was written that it would ignore.
    expect(toSponsorAds(ads, "https://project.supabase.test")).toHaveLength(1);

    const { settings, saved } = await readSiteContent(staff.client);
    expect(settings.sponsors.ads).toHaveLength(1);
    expect(saved).toBeDefined();
  });

  it("refuses a picture that was never uploaded and leaves the saved list as it was", async () => {
    const before = await storedAds();
    const failure = await failureOf(() =>
      saveSponsorsContent(
        sponsorStore(staff.client),
        sponsorsInputSchema.parse({
          sponsors: [
            {
              id: TWO,
              advertiser: "No files",
              alt: "No files",
              href: "https://sponsor.example",
              active: true,
              strip: { desktop: file(TWO, "a.png"), compact: file(TWO, "b.png") },
            },
          ],
        }),
      ),
    );
    expect(failure).toMatchObject({
      code: "VALIDATION",
      fieldErrors: {
        "sponsors.0.strip.desktop": [{ key: "validation.sponsorImageMissing" }],
        "sponsors.0.strip.compact": [{ key: "validation.sponsorImageMissing" }],
      },
    });
    expect(await storedAds()).toEqual(before);
    expect(await exists(file(ONE, "strip-d.png"))).toBe(true);
  });

  it("refuses a file whose bytes are not a picture, whatever its name says", async () => {
    await put(
      file(TWO, "fake.png"),
      new TextEncoder().encode("<script>alert(1)</script>"),
      "image/png",
    );
    await put(file(TWO, "ok.jpg"), jpeg(640, 200, 40_000), "image/jpeg");
    const failure = await failureOf(() =>
      saveSponsorsContent(
        sponsorStore(staff.client),
        sponsorsInputSchema.parse({
          sponsors: [
            {
              id: TWO,
              advertiser: "Fake",
              alt: "Fake",
              href: "https://sponsor.example",
              active: true,
              strip: { desktop: file(TWO, "fake.png"), compact: file(TWO, "ok.jpg") },
            },
          ],
        }),
      ),
    );
    expect(failure.fieldErrors).toEqual({
      "sponsors.0.strip.desktop": [{ key: "validation.sponsorImageType" }],
    });
  });

  it("takes the files of a deleted sponsor out of the bucket after saving the shorter list", async () => {
    expect(await exists(file(ONE, "panel-c.png"))).toBe(true);
    await saveSponsorsContent(
      sponsorStore(staff.client),
      sponsorsInputSchema.parse({ sponsors: [] }),
    );
    expect(await storedAds()).toEqual([]);
    for (const name of ["strip-d.png", "strip-c.jpg", "panel-d.webp", "panel-c.png"]) {
      expect(await exists(file(ONE, name))).toBe(false);
    }
  });

  it("refuses a customer and a visitor, and changes nothing", async () => {
    const before = await storedAds();
    for (const client of [customer.client, visitorClient()]) {
      const failure = await failureOf(() =>
        saveSponsorsContent(
          sponsorStore(client),
          sponsorsInputSchema.parse({
            sponsors: [
              {
                id: TWO,
                advertiser: "Hacked",
                alt: "Hacked",
                href: "https://sponsor.example",
                active: true,
              },
            ],
          }),
        ),
      );
      expect(failure.code).toBe("FORBIDDEN");
    }
    expect(await storedAds()).toEqual(before);
  });

  it("records who changed the sponsors, never what they say", async () => {
    const { data: before } = await admin
      .from("audit_log")
      .select("actor_id, diff")
      .eq("action", "cms.changed")
      .eq("entity_id", "sponsors");
    const advertiser = `Audit advertiser ${RUN}`;
    await saveSponsorsContent(
      sponsorStore(staff.client),
      sponsorsInputSchema.parse({
        sponsors: [
          {
            id: TWO,
            advertiser,
            alt: "Audit alt",
            href: "https://sponsor.example",
            active: false,
          },
        ],
      }),
    );
    const { data: after } = await admin
      .from("audit_log")
      .select("actor_id, diff")
      .eq("action", "cms.changed")
      .eq("entity_id", "sponsors");
    expect(after?.length).toBe((before?.length ?? 0) + 1);
    expect(after?.some((entry) => entry.actor_id === staff.userId)).toBe(true);
    expect(JSON.stringify(after)).not.toContain(advertiser);
  });
});

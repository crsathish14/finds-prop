import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
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

const { contentStore } = await import("@/features/site-content/service");
const { saveFooterContent, saveHeaderContent, saveHeroContent, saveHomepageContent } =
  await import("@/features/site-content/content-service");
const { footerInputSchema, headerInputSchema, heroInputSchema, homepageInputSchema } =
  await import("@/features/site-content/schemas");
const { readSiteContent } = await import("@/features/site-content/queries");
const { mergeSiteSettings } = await import("@/features/site/merge");
const { SITE_DEFAULTS } = await import("@/features/site/defaults");
const { ActionError } = await import("@/server/actions/normalise-error");

const KEYS = ["header", "hero", "homepage", "footer", "region"];
type MergeLog = Parameters<typeof mergeSiteSettings>[1];

async function failureOf(run: () => Promise<unknown>) {
  try {
    await run();
  } catch (error) {
    if (error instanceof ActionError) return error;
    throw error;
  }
  throw new Error("expected the call to fail");
}

const switches = {
  showFeatured: true,
  showProjectTypes: true,
  showDiscovery: false,
  showWhyUs: true,
  showCta: true,
};

describe("IT-site-content: the admin's site content against a real database (S7-T10, FR-ADM-10)", () => {
  const admin = adminClient();
  let staff: TestUser;
  let customer: TestUser;
  let original: { key: string; value: NonNullable<Json> }[] = [];

  const stored = async (key: string) => {
    const { data, error } = await admin
      .from("site_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    if (error) throw new Error(`Could not read the setting (${error.code})`);
    return data?.value ?? null;
  };

  const cmsEntries = async (key: string) => {
    const { data, error } = await admin
      .from("audit_log")
      .select("actor_id, diff")
      .eq("action", "cms.changed")
      .eq("entity_id", key);
    if (error) throw new Error(`Could not read the audit log (${error.code})`);
    return data;
  };

  beforeAll(async () => {
    staff = await signInTestAdmin();
    customer = await signInTestCustomer();
    const { data, error } = await admin.from("site_settings").select("key, value").in("key", KEYS);
    if (error) throw new Error(`Could not keep the settings (${error.code})`);
    original = data;
  });

  afterAll(async () => {
    await admin.from("site_settings").delete().in("key", KEYS);
    if (original.length > 0) await admin.from("site_settings").insert(original);
    await removeTestUser();
    await removeTestAdmin();
  });

  it("saves the hero under its own key, then replaces it whole: a cleared line is gone, not kept", async () => {
    const store = contentStore(staff.client);
    expect(
      await saveHeroContent(
        store,
        heroInputSchema.parse({
          eyebrow: "Homes and plots",
          title: "Find the place",
          subtitle: "Shortlist and compare",
          layout: "split",
        }),
      ),
    ).toEqual({ key: "hero" });
    expect(await stored("hero")).toEqual({
      eyebrow: "Homes and plots",
      title: "Find the place",
      subtitle: "Shortlist and compare",
      layout: "split",
    });
    await saveHeroContent(
      store,
      heroInputSchema.parse({ eyebrow: "", title: "Find the place", layout: "search_desk" }),
    );
    expect(await stored("hero")).toEqual({ title: "Find the place", layout: "search_desk" });
  });

  it("stores header, footer and homepage in the shape the public side reads, with no setting ignored", async () => {
    const store = contentStore(staff.client);
    await saveHeaderContent(
      store,
      headerInputSchema.parse({
        name: "Kadal Homes",
        links: [{ label: "Buy", href: "/properties?listingType=sale" }],
        cta: { label: "Post property", href: "/post-property" },
      }),
    );
    await saveFooterContent(
      store,
      footerInputSchema.parse({
        about: "Homes across Tamil Nadu",
        contact: { email: "hello@example.com", phone: "", address: "" },
        links: [{ label: "Contact us", href: "/contact" }],
        copyright: "© 2026",
      }),
    );
    await saveHomepageContent(
      store,
      homepageInputSchema.parse({
        ...switches,
        localities: [{ label: "Adyar", lat: "13.0067", lng: "80.2573", radiusKm: "4" }],
      }),
    );

    // Read the way a visitor does, with no sign-in, and merge it the way the site does.
    const { data, error } = await visitorClient()
      .from("site_settings")
      .select("key, value")
      .in("key", KEYS);
    expect(error).toBeNull();
    const warn = vi.fn();
    const merged = mergeSiteSettings(data ?? [], { warn } as unknown as MergeLog);
    expect(warn).not.toHaveBeenCalled();
    expect(merged.header).toEqual({
      name: "Kadal Homes",
      links: [{ label: "Buy", href: "/properties?listingType=sale" }],
      cta: { label: "Post property", href: "/post-property" },
    });
    expect(merged.footer).toEqual({
      about: "Homes across Tamil Nadu",
      contact: { email: "hello@example.com" },
      links: [{ label: "Contact us", href: "/contact" }],
      copyright: "© 2026",
    });
    expect(merged.homepage).toEqual({
      ...switches,
      localities: [{ label: "Adyar", lat: 13.0067, lng: 80.2573, radiusKm: 4 }],
    });
  });

  it("opens the editor on the saved values over the defaults, and says which settings were ever saved", async () => {
    await admin.from("site_settings").delete().eq("key", "footer");
    await saveHeroContent(
      contentStore(staff.client),
      heroInputSchema.parse({ title: "Editor read", layout: "split" }),
    );
    const content = await readSiteContent(staff.client);
    expect(content.settings.hero).toEqual({ title: "Editor read", layout: "split" });
    expect(content.settings.footer).toEqual(SITE_DEFAULTS.footer);
    expect(content.saved).toMatchObject({ hero: true, footer: false });
  });

  it("refuses a locality outside the launch area and leaves the saved homepage as it was", async () => {
    const before = await stored("homepage");
    const error = await failureOf(() =>
      saveHomepageContent(
        contentStore(staff.client),
        homepageInputSchema.parse({
          ...switches,
          localities: [{ label: "Mumbai", lat: "19.076", lng: "72.8777", radiusKm: "3" }],
        }),
      ),
    );
    expect(error).toMatchObject({
      code: "VALIDATION",
      fieldErrors: { "localities.0.lat": [{ key: "validation.outsideRegion" }] },
    });
    expect(await stored("homepage")).toEqual(before);
  });

  it("uses the saved launch area when one exists", async () => {
    await admin.from("site_settings").upsert({
      key: "region",
      value: { bounds: { south: 18, west: 72, north: 20, east: 73 } },
    });
    await expect(
      saveHomepageContent(
        contentStore(staff.client),
        homepageInputSchema.parse({
          ...switches,
          localities: [{ label: "Mumbai", lat: "19.076", lng: "72.8777", radiusKm: "3" }],
        }),
      ),
    ).resolves.toEqual({ key: "homepage" });
  });

  it("refuses a customer and a visitor on every setting, and changes nothing", async () => {
    await saveHeroContent(
      contentStore(staff.client),
      heroInputSchema.parse({ title: "Only the admin writes", layout: "search_desk" }),
    );
    const before = await stored("hero");
    for (const client of [customer.client, visitorClient()]) {
      const store = contentStore(client);
      for (const attempt of [
        () => saveHeroContent(store, heroInputSchema.parse({ title: "Hacked", layout: "split" })),
        () => saveHeaderContent(store, headerInputSchema.parse({ links: [] })),
        () => saveFooterContent(store, footerInputSchema.parse({ links: [] })),
        () =>
          saveHomepageContent(store, homepageInputSchema.parse({ ...switches, localities: [] })),
      ]) {
        expect(await failureOf(attempt)).toMatchObject({ code: "FORBIDDEN" });
      }
    }
    expect(await stored("hero")).toEqual(before);
  });

  it("records who changed which setting, never what it now says, and nothing for a save that changes nothing", async () => {
    const title = `Audit title ${Date.now()}`;
    const store = contentStore(staff.client);
    const input = heroInputSchema.parse({ title, layout: "search_desk" });
    const entriesBefore = (await cmsEntries("hero")).length;
    await saveHeroContent(store, input);
    const entries = await cmsEntries("hero");
    expect(entries.length).toBe(entriesBefore + 1);
    expect(entries.some((entry) => entry.actor_id === staff.userId)).toBe(true);
    expect(JSON.stringify(entries)).not.toContain(title);
    await saveHeroContent(store, input);
    expect((await cmsEntries("hero")).length).toBe(entries.length);
  });
});

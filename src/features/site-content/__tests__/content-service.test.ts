import { describe, expect, it } from "vitest";
import { SITE_DEFAULTS } from "@/features/site/defaults";
import { ActionError } from "@/server/actions/normalise-error";
import {
  contentModulesValue,
  disclaimersValue,
  footerValue,
  headerValue,
  heroValue,
  homepageValue,
  isOutside,
  mapContentError,
  saveContentModulesContent,
  saveDisclaimersContent,
  saveFooterContent,
  saveHeaderContent,
  saveHeroContent,
  saveHomepageContent,
  saveSponsoredBuildersContent,
  saveTopDevelopersContent,
  type ContentStore,
  type RegionBounds,
} from "../content-service";
import {
  contentModulesInputSchema,
  disclaimersInputSchema,
  footerInputSchema,
  headerInputSchema,
  heroInputSchema,
  homepageInputSchema,
  sponsoredBuildersInputSchema,
  topDevelopersInputSchema,
} from "../schemas";

function fakeStore(bounds: RegionBounds = SITE_DEFAULTS.region.bounds) {
  const writes: { key: string; value: Record<string, unknown> }[] = [];
  const store: ContentStore = {
    write: (key, value) => {
      writes.push({ key, value });
      return Promise.resolve();
    },
    readBounds: () => Promise.resolve(bounds),
  };
  return { store, writes };
}

const switches = {
  showFeatured: true,
  showProjectTypes: false,
  showDiscovery: true,
  showWhyUs: true,
  showCta: false,
};

describe("UT-site-content-service: what is stored (S7-T10)", () => {
  it("stores a header without the keys that hold nothing", () => {
    const value = headerValue(
      headerInputSchema.parse({
        name: "",
        links: [{ label: "Buy", href: "/properties" }],
        cta: { label: "", href: "" },
      }),
    );
    expect(value).toEqual({ links: [{ label: "Buy", href: "/properties" }] });
  });

  it("stores a header with its name and button", () => {
    const value = headerValue(
      headerInputSchema.parse({
        name: "Find Prop",
        links: [],
        cta: { label: "Post property", href: "/post-property" },
      }),
    );
    expect(value).toEqual({
      name: "Find Prop",
      links: [],
      cta: { label: "Post property", href: "/post-property" },
    });
  });

  it("stores a footer's contact only when one of its boxes is filled", () => {
    const empty = footerValue(
      footerInputSchema.parse({ contact: { address: "", email: "", phone: "" }, links: [] }),
    );
    expect(empty).toEqual({ links: [] });
    const some = footerValue(
      footerInputSchema.parse({
        about: "About us",
        contact: { address: "", email: "hello@example.com", phone: "" },
        links: [{ label: "Contact us", href: "/contact" }],
        copyright: "© 2026",
      }),
    );
    expect(some).toEqual({
      about: "About us",
      contact: { email: "hello@example.com" },
      links: [{ label: "Contact us", href: "/contact" }],
      copyright: "© 2026",
    });
  });

  it("stores the hero's words and layout, leaving a cleared line out", () => {
    expect(
      heroValue(heroInputSchema.parse({ eyebrow: "", title: "Find a home", layout: "split" })),
    ).toEqual({ title: "Find a home", layout: "split" });
  });

  it("stores all five switches, even the ones that are off, and the localities in order", () => {
    const value = homepageValue(
      homepageInputSchema.parse({
        ...switches,
        localities: [
          { label: "Adyar", lat: "13.0067", lng: "80.2573", radiusKm: "4" },
          { label: "Porur", lat: "13.0382", lng: "80.1565", radiusKm: "3" },
        ],
      }),
    );
    expect(value).toEqual({
      ...switches,
      localities: [
        { label: "Adyar", lat: 13.0067, lng: 80.2573, radiusKm: 4 },
        { label: "Porur", lat: 13.0382, lng: 80.1565, radiusKm: 3 },
      ],
    });
  });
});

describe("UT-site-content-service: saving (S7-T10)", () => {
  it("writes each setting under its own key and answers which one", async () => {
    const { store, writes } = fakeStore();
    expect(await saveHeaderContent(store, headerInputSchema.parse({ links: [] }))).toEqual({
      key: "header",
    });
    expect(await saveFooterContent(store, footerInputSchema.parse({ links: [] }))).toEqual({
      key: "footer",
    });
    expect(
      await saveHeroContent(store, heroInputSchema.parse({ title: "Hi", layout: "search_desk" })),
    ).toEqual({ key: "hero" });
    expect(
      await saveHomepageContent(store, homepageInputSchema.parse({ ...switches, localities: [] })),
    ).toEqual({ key: "homepage" });
    expect(writes.map((write) => write.key)).toEqual(["header", "footer", "hero", "homepage"]);
  });

  it("stores only what the public side would accept (so a setting never falls back to the defaults)", async () => {
    const { store, writes } = fakeStore();
    await saveHeroContent(store, heroInputSchema.parse({ title: "Hi", layout: "split" }));
    expect(writes[0]?.value).toEqual({ title: "Hi", layout: "split" });
  });

  it("refuses a locality outside the launch area before writing, naming its latitude box", async () => {
    const { store, writes } = fakeStore();
    const input = homepageInputSchema.parse({
      ...switches,
      localities: [
        { label: "Adyar", lat: "13.0067", lng: "80.2573", radiusKm: "3" },
        { label: "Mumbai", lat: "19.076", lng: "72.8777", radiusKm: "3" },
      ],
    });
    const error = await saveHomepageContent(store, input).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ActionError);
    expect(error).toMatchObject({
      code: "VALIDATION",
      fieldErrors: { "localities.1.lat": [{ key: "validation.outsideRegion" }] },
    });
    expect(writes).toEqual([]);
  });

  it("uses the saved launch area, not only the built-in one", async () => {
    const { store } = fakeStore({ south: 18, west: 72, north: 20, east: 73 });
    const input = homepageInputSchema.parse({
      ...switches,
      localities: [{ label: "Mumbai", lat: "19.076", lng: "72.8777", radiusKm: "3" }],
    });
    await expect(saveHomepageContent(store, input)).resolves.toEqual({ key: "homepage" });
  });

  it("counts a point on the edge of the area as inside", () => {
    const bounds = SITE_DEFAULTS.region.bounds;
    expect(isOutside(bounds.south, bounds.west, bounds)).toBe(false);
    expect(isOutside(bounds.north, bounds.east, bounds)).toBe(false);
    expect(isOutside(bounds.south - 0.001, bounds.west, bounds)).toBe(true);
  });
});

describe("UT-site-content-service: database failures (S7-T10)", () => {
  it.each([
    ["42501", "FORBIDDEN"],
    ["23514", "VALIDATION"],
    ["22P02", "VALIDATION"],
    ["23502", "VALIDATION"],
    ["XX000", "INTERNAL"],
    [undefined, "INTERNAL"],
  ] as const)("turns database code %s into %s", (code, expected) => {
    expect(mapContentError({ code }).code).toBe(expected);
  });
});

describe("UT-site-content-service: the content module switches (ADR-143, FR-ADM-16)", () => {
  it("stores the three switches as given", () => {
    const value = contentModulesValue(
      contentModulesInputSchema.parse({ blog: false, faq: true, careers: false }),
    );
    expect(value).toEqual({ blog: false, faq: true, careers: false });
  });

  it("writes the content_modules setting and says which one it saved", async () => {
    const { store, writes } = fakeStore();
    const done = await saveContentModulesContent(store, {
      blog: true,
      faq: false,
      careers: true,
    });
    expect(done).toEqual({ key: "content_modules" });
    expect(writes).toEqual([
      { key: "content_modules", value: { blog: true, faq: false, careers: true } },
    ]);
  });

  it("refuses a switch that is missing or not a true or false", () => {
    expect(contentModulesInputSchema.safeParse({ blog: true, faq: true }).success).toBe(false);
    expect(
      contentModulesInputSchema.safeParse({ blog: "yes", faq: true, careers: true }).success,
    ).toBe(false);
  });
});

describe("UT-site-content-service: the disclaimers (ADR-152)", () => {
  it("stores the two texts as typed, leaving out a blank one", () => {
    const input = disclaimersInputSchema.parse({
      footer: "  Prices vary.\r\nCheck first.  ",
      aiSearch: "   ",
    });
    expect(disclaimersValue(input)).toEqual({ footer: "Prices vary.\nCheck first." });
  });

  it("saves the row named disclaimers, in the shape the site reads", async () => {
    const { store, writes } = fakeStore();
    const done = await saveDisclaimersContent(
      store,
      disclaimersInputSchema.parse({ footer: "One", aiSearch: "Two" }),
    );
    expect(done).toEqual({ key: "disclaimers" });
    expect(writes).toEqual([{ key: "disclaimers", value: { footer: "One", aiSearch: "Two" } }]);
  });

  it("saves an empty row when both are cleared, so nothing shows", async () => {
    const { store, writes } = fakeStore();
    await saveDisclaimersContent(store, disclaimersInputSchema.parse({ footer: "", aiSearch: "" }));
    expect(writes).toEqual([{ key: "disclaimers", value: {} }]);
  });

  it("refuses a text over 600 characters and control characters, accepts exactly 600", () => {
    expect(disclaimersInputSchema.safeParse({ footer: "a".repeat(601) }).success).toBe(false);
    expect(disclaimersInputSchema.safeParse({ footer: "a".repeat(600) }).success).toBe(true);
    expect(disclaimersInputSchema.safeParse({ aiSearch: "bad\u0007text" }).success).toBe(false);
    expect(disclaimersInputSchema.safeParse({ aiSearch: "tab\there" }).success).toBe(false);
  });
});

const ID = (index: number) => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;

describe("UT-top-developers: the chosen developers of the home page", () => {
  it("writes the top_developers setting with the ids in order", async () => {
    const { store, writes } = fakeStore();
    const done = await saveTopDevelopersContent(store, { builderIds: [ID(2), ID(1)] });
    expect(done).toEqual({ key: "top_developers" });
    expect(writes).toEqual([{ key: "top_developers", value: { builderIds: [ID(2), ID(1)] } }]);
  });

  it("takes none (the home page then picks by itself) and ten, but not eleven", () => {
    expect(topDevelopersInputSchema.safeParse({ builderIds: [] }).success).toBe(true);
    const ten = Array.from({ length: 10 }, (_, index) => ID(index + 1));
    expect(topDevelopersInputSchema.safeParse({ builderIds: ten }).success).toBe(true);
    expect(topDevelopersInputSchema.safeParse({ builderIds: [...ten, ID(11)] }).success).toBe(
      false,
    );
  });

  it("refuses a repeated id and a value that is not an id", () => {
    expect(topDevelopersInputSchema.safeParse({ builderIds: [ID(1), ID(1)] }).success).toBe(false);
    expect(topDevelopersInputSchema.safeParse({ builderIds: ["not-an-id"] }).success).toBe(false);
  });
});

describe("UT-sponsored-builders: who the Featured card and the Spotlight draw from (ADR-191)", () => {
  it("writes the sponsored_builders setting with both lists", async () => {
    const { store, writes } = fakeStore();
    const done = await saveSponsoredBuildersContent(store, {
      featured: [ID(2), ID(1)],
      spotlight: [ID(3)],
    });
    expect(done).toEqual({ key: "sponsored_builders" });
    expect(writes).toEqual([
      { key: "sponsored_builders", value: { featured: [ID(2), ID(1)], spotlight: [ID(3)] } },
    ]);
  });

  it("takes none and ten in each list, but not eleven, a repeat or something that is not an id", () => {
    const ten = Array.from({ length: 10 }, (_, index) => ID(index + 1));
    const ok = (featured: string[], spotlight: string[] = []) =>
      sponsoredBuildersInputSchema.safeParse({ featured, spotlight }).success;
    expect(ok([])).toBe(true);
    expect(ok(ten, ten)).toBe(true);
    expect(ok([...ten, ID(11)])).toBe(false);
    expect(ok([], [...ten, ID(11)])).toBe(false);
    expect(ok([ID(1), ID(1)])).toBe(false);
    expect(ok(["not-an-id"])).toBe(false);
    expect(sponsoredBuildersInputSchema.safeParse({ featured: [] }).success).toBe(false);
  });
});

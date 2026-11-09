import { describe, expect, it } from "vitest";
import { SITE_DEFAULTS } from "@/features/site/defaults";
import { ActionError } from "@/server/actions/normalise-error";
import {
  footerValue,
  headerValue,
  heroValue,
  homepageValue,
  isOutside,
  mapContentError,
  saveFooterContent,
  saveHeaderContent,
  saveHeroContent,
  saveHomepageContent,
  type ContentStore,
  type RegionBounds,
} from "../content-service";
import {
  footerInputSchema,
  headerInputSchema,
  heroInputSchema,
  homepageInputSchema,
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

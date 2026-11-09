import { describe, expect, it } from "vitest";
import type { ZodError } from "zod";
import { toFieldErrors } from "@/server/actions/field-errors";
import {
  footerInputSchema,
  headerInputSchema,
  heroInputSchema,
  homepageInputSchema,
} from "../schemas";

const place = { label: "Adyar", lat: "13.0067", lng: "80.2573", radiusKm: "3" };
const switches = {
  showFeatured: true,
  showProjectTypes: true,
  showDiscovery: true,
  showWhyUs: true,
  showCta: false,
};

function keysFor(result: { success: boolean; error?: ZodError }, field: string) {
  if (result.success || !result.error) return [];
  return (toFieldErrors(result.error)[field] ?? []).map((entry) => entry.key);
}

describe("UT-schemas-site-content: header (S7-T10)", () => {
  it("trims the words, clears a blank name and a blank button", () => {
    const parsed = headerInputSchema.parse({
      name: "   ",
      links: [{ label: "  Buy ", href: "/properties?listingType=sale" }],
      cta: { label: "", href: "" },
    });
    expect(parsed.name).toBeNull();
    expect(parsed.cta).toBeNull();
    expect(parsed.links).toEqual([{ label: "Buy", href: "/properties?listingType=sale" }]);
  });

  it("accepts a page on this site and an https address, nothing else", () => {
    const ok = (href: string) =>
      headerInputSchema.safeParse({ links: [{ label: "A", href }] }).success;
    expect(ok("/projects")).toBe(true);
    expect(ok("https://example.com/about")).toBe(true);
    expect(ok("javascript:alert(1)")).toBe(false);
    expect(ok("data:text/html,x")).toBe(false);
    expect(ok("//evil.example")).toBe(false);
    expect(ok("/\\evil.example")).toBe(false);
    expect(ok("http://example.com")).toBe(false);
    expect(ok("https://")).toBe(false);
    expect(ok("/with space")).toBe(false);
  });

  it("names the box a bad link sits in, with the link-target key", () => {
    const result = headerInputSchema.safeParse({ links: [{ label: "A", href: "ftp://x" }] });
    expect(keysFor(result, "links.0.href")).toEqual(["validation.linkTarget"]);
  });

  it("refuses a button with only one of its two boxes filled", () => {
    const result = headerInputSchema.safeParse({ links: [], cta: { label: "Post", href: "" } });
    expect(keysFor(result, "cta.href")).toEqual(["validation.required"]);
  });

  it("holds the header to 12 links", () => {
    const links = Array.from({ length: 13 }, (_, index) => ({ label: `L${index}`, href: "/a" }));
    expect(headerInputSchema.safeParse({ links }).success).toBe(false);
    expect(headerInputSchema.safeParse({ links: links.slice(0, 12) }).success).toBe(true);
  });
});

describe("UT-schemas-site-content: footer (S7-T10)", () => {
  it("clears empty contact boxes and checks the email", () => {
    const parsed = footerInputSchema.parse({
      about: "",
      contact: { address: "", email: "", phone: " +91 90000 00000 " },
      links: [],
      copyright: "",
    });
    expect(parsed.about).toBeNull();
    expect(parsed.contact).toEqual({ address: null, email: null, phone: "+91 90000 00000" });
    expect(
      keysFor(
        footerInputSchema.safeParse({ contact: { email: "nope" }, links: [] }),
        "contact.email",
      ),
    ).toEqual(["validation.emailInvalid"]);
  });

  it("keeps the lines of the about text and holds it to 400 characters", () => {
    expect(footerInputSchema.parse({ about: " one\ntwo ", links: [] }).about).toBe("one\ntwo");
    expect(footerInputSchema.safeParse({ about: "x".repeat(401), links: [] }).success).toBe(false);
  });
});

describe("UT-schemas-site-content: hero (S7-T10)", () => {
  it("needs a headline and a known layout", () => {
    expect(keysFor(heroInputSchema.safeParse({ title: "  ", layout: "split" }), "title")).toEqual([
      "validation.required",
    ]);
    expect(heroInputSchema.safeParse({ title: "Hi", layout: "diagonal" }).success).toBe(false);
    expect(heroInputSchema.parse({ title: " Hi ", layout: "split", eyebrow: "" })).toMatchObject({
      title: "Hi",
      eyebrow: null,
    });
  });

  it("says how long the headline may be when it is too long", () => {
    const result = heroInputSchema.safeParse({ title: "x".repeat(121), layout: "split" });
    expect(keysFor(result, "title")).toEqual(["validation.tooLong"]);
  });
});

describe("UT-schemas-site-content: homepage (S7-T10)", () => {
  it("reads typed coordinates as numbers and rounds them to six decimals", () => {
    const parsed = homepageInputSchema.parse({
      ...switches,
      localities: [{ ...place, lat: " 13.00671234 ", lng: "80.2573" }],
    });
    expect(parsed.localities[0]).toEqual({
      label: "Adyar",
      lat: 13.006712,
      lng: 80.2573,
      radiusKm: 3,
    });
  });

  it("tells a blank coordinate (required) from a word (not a number)", () => {
    const blank = homepageInputSchema.safeParse({
      ...switches,
      localities: [{ ...place, lat: "" }],
    });
    expect(keysFor(blank, "localities.0.lat")).toEqual(["validation.required"]);
    const word = homepageInputSchema.safeParse({
      ...switches,
      localities: [{ ...place, lng: "east" }],
    });
    expect(keysFor(word, "localities.0.lng")).toEqual(["validation.numberInvalid"]);
  });

  it("refuses a latitude or longitude that cannot exist, and a radius of nothing", () => {
    const bad = (extra: Record<string, string>) =>
      homepageInputSchema.safeParse({ ...switches, localities: [{ ...place, ...extra }] }).success;
    expect(bad({ lat: "91" })).toBe(false);
    expect(bad({ lng: "-181" })).toBe(false);
    expect(bad({ radiusKm: "0" })).toBe(false);
    expect(bad({ radiusKm: "101" })).toBe(false);
  });

  it("holds the list to 8 localities", () => {
    const many = (count: number) =>
      Array.from({ length: count }, (_, index) => ({ ...place, label: `Place ${index}` }));
    expect(homepageInputSchema.safeParse({ ...switches, localities: many(9) }).success).toBe(false);
    expect(homepageInputSchema.safeParse({ ...switches, localities: many(8) }).success).toBe(true);
  });

  it("puts a repeated label on the later row, whatever its case", () => {
    const result = homepageInputSchema.safeParse({
      ...switches,
      localities: [place, { ...place, label: "Velachery" }, { ...place, label: "  adyar " }],
    });
    expect(keysFor(result, "localities.2.label")).toEqual(["validation.localityLabelTaken"]);
    expect(keysFor(result, "localities.0.label")).toEqual([]);
  });

  it("needs every switch to be a yes or a no", () => {
    expect(
      homepageInputSchema.safeParse({ ...switches, showCta: "on", localities: [] }).success,
    ).toBe(false);
  });
});

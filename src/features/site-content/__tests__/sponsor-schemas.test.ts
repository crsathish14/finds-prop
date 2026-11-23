import { describe, expect, it } from "vitest";
import { toFieldErrors } from "@/server/actions/field-errors";
import { SPONSORS_MAX } from "../constants";
import { sponsorsInputSchema } from "../sponsor-schemas";

const ID = "ad-one";
const sponsor = (over: Record<string, unknown> = {}) => ({
  id: ID,
  advertiser: "Sample Developer",
  alt: "Sample Developer: new launch apartments in Velachery.",
  href: "https://sampledeveloper.example/velachery",
  active: true,
  ...over,
});

function problems(input: unknown) {
  const result = sponsorsInputSchema.safeParse(input);
  if (result.success) return {};
  return toFieldErrors(result.error);
}

describe("UT-sponsors-schema: what the Sponsors save sends (S7-T11)", () => {
  it("accepts a sponsor with no pictures yet, and a list that is empty", () => {
    expect(sponsorsInputSchema.safeParse({ sponsors: [sponsor()] }).success).toBe(true);
    expect(sponsorsInputSchema.safeParse({ sponsors: [] }).success).toBe(true);
  });

  it("accepts both pictures of a format, and trims and tidies the words", () => {
    const parsed = sponsorsInputSchema.parse({
      sponsors: [
        sponsor({
          advertiser: "  Sample   Developer ",
          strip: {
            desktop: `sponsors/${ID}/strip-desktop-1.webp`,
            compact: `sponsors/${ID}/strip-compact-1.png`,
          },
          panel: null,
        }),
      ],
    });
    expect(parsed.sponsors[0]?.advertiser).toBe("Sample Developer");
    expect(parsed.sponsors[0]?.strip?.compact).toBe(`sponsors/${ID}/strip-compact-1.png`);
    expect(parsed.sponsors[0]?.panel).toBeUndefined();
  });

  it("treats a format with both pictures blank as no format", () => {
    const parsed = sponsorsInputSchema.parse({
      sponsors: [sponsor({ strip: { desktop: "", compact: "  " } })],
    });
    expect(parsed.sponsors[0]?.strip).toBeUndefined();
  });

  it("needs the pair: one picture of a format without the other names the missing one", () => {
    expect(
      problems({
        sponsors: [
          sponsor({ panel: { desktop: `sponsors/${ID}/panel-desktop-1.jpg`, compact: "" } }),
        ],
      }),
    ).toEqual({ "sponsors.0.panel.compact": [{ key: "validation.required" }] });
  });

  it("names the advertiser, the alt text and the link when they are missing", () => {
    expect(problems({ sponsors: [sponsor({ advertiser: "", alt: " ", href: "" })] })).toEqual({
      "sponsors.0.advertiser": [{ key: "validation.required" }],
      "sponsors.0.alt": [{ key: "validation.required" }],
      "sponsors.0.href": [{ key: "validation.required" }],
    });
  });

  it.each([
    "http://sampledeveloper.example",
    "javascript:alert(1)",
    "//sampledeveloper.example",
    "https://user:pass@sampledeveloper.example",
    "sampledeveloper.example",
  ])("refuses the link %s: only a plain https address is a destination", (href) => {
    expect(problems({ sponsors: [sponsor({ href })] })).toEqual({
      "sponsors.0.href": [{ key: "validation.linkInvalid" }],
    });
  });

  it.each([
    `sponsors/${ID}/../other/strip.png`,
    `sponsors/${ID}/strip.svg`,
    `sponsors/${ID}/strip.png.exe`,
    "/etc/passwd.png",
    `listing-photos/${ID}/strip.png`,
    "https://elsewhere.example/strip.png",
  ])("refuses the picture path %s", (path) => {
    expect(
      problems({
        sponsors: [sponsor({ strip: { desktop: path, compact: `sponsors/${ID}/c.png` } })],
      }),
    ).toHaveProperty("sponsors.0.strip.desktop");
  });

  it("refuses a picture that lives in another sponsor's folder", () => {
    expect(
      problems({
        sponsors: [
          sponsor({
            strip: { desktop: "sponsors/ad-two/strip.png", compact: `sponsors/${ID}/c.png` },
          }),
        ],
      }),
    ).toEqual({ "sponsors.0.strip.desktop": [{ key: "validation.invalid" }] });
  });

  it("refuses a repeated id and more than the limit", () => {
    expect(problems({ sponsors: [sponsor(), sponsor()] })).toEqual({
      "sponsors.1.id": [{ key: "validation.invalid" }],
    });
    const many = Array.from({ length: SPONSORS_MAX + 1 }, (_, index) =>
      sponsor({ id: `ad-${index}` }),
    );
    expect(sponsorsInputSchema.safeParse({ sponsors: many }).success).toBe(false);
  });
});

describe("UT-sponsors-schema: the Showcase and Cinematic fields (ADR-182)", () => {
  it("links to a project by its slug with no address, and names a missing slug", () => {
    const parsed = sponsorsInputSchema.parse({
      sponsors: [sponsor({ link: "project", projectSlug: " Aranya-Heights ", href: "" })],
    });
    expect(parsed.sponsors[0]).toMatchObject({ link: "project", projectSlug: "aranya-heights" });
    expect(parsed.sponsors[0]?.href).toBeUndefined();
    expect(problems({ sponsors: [sponsor({ link: "project", href: "" })] })).toEqual({
      "sponsors.0.projectSlug": [{ key: "validation.required" }],
    });
    expect(
      problems({ sponsors: [sponsor({ link: "project", projectSlug: "not a slug" })] }),
    ).toEqual({ "sponsors.0.projectSlug": [{ key: "validation.invalid" }] });
  });

  it("takes a style, and refuses one it does not know", () => {
    expect(sponsorsInputSchema.parse({ style: "cinematic", sponsors: [] }).style).toBe("cinematic");
    expect(sponsorsInputSchema.parse({ sponsors: [] }).style).toBeUndefined();
    expect(sponsorsInputSchema.safeParse({ style: "banner", sponsors: [] }).success).toBe(false);
  });

  it("reads empty Showcase and Cinematic boxes as no value, and refuses lines that are too long", () => {
    const parsed = sponsorsInputSchema.parse({
      sponsors: [
        sponsor({
          brand: " Meridian  Homes ",
          showcase: { project: "Aranya Heights", price: "" },
          cinematic: { headline: " " },
        }),
      ],
    });
    expect(parsed.sponsors[0]).toMatchObject({
      brand: "Meridian Homes",
      showcase: { project: "Aranya Heights", price: null },
      cinematic: { headline: null },
    });
    expect(
      problems({ sponsors: [sponsor({ cinematic: { headline: "a".repeat(41) } })] }),
    ).toHaveProperty(["sponsors.0.cinematic.headline"]);
  });

  it("keeps the photo inside the sponsor's own folder", () => {
    expect(problems({ sponsors: [sponsor({ photo: "sponsors/other/photo.jpg" })] })).toEqual({
      "sponsors.0.photo": [{ key: "validation.invalid" }],
    });
    expect(
      sponsorsInputSchema.safeParse({ sponsors: [sponsor({ photo: `sponsors/${ID}/photo.jpg` })] })
        .success,
    ).toBe(true);
  });
});

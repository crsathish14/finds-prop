import { describe, expect, it } from "vitest";
import { sponsorEditViewsOf } from "../sponsor-view";

const URL = "https://project.supabase.test";

const picture = (path: string, extra: Record<string, unknown> = {}) => ({
  path,
  width: 1940,
  height: 180,
  ...extra,
});

describe("UT-sponsors-view: the stored sponsors as the editor shows them (S7-T11)", () => {
  it("builds each picture's address from our own storage and keeps the order", () => {
    const { sponsors, skipped } = sponsorEditViewsOf(
      [
        {
          id: "b",
          advertiser: "Second",
          active: false,
          alt: "Second banner",
          href: "https://b.example",
        },
        {
          id: "a",
          advertiser: "First",
          active: true,
          alt: "First banner",
          href: "https://a.example",
          strip: {
            desktop: picture("sponsors/a/d.webp", { bytes: 96_000 }),
            compact: picture("sponsors/a/c.png", { bytes: 41_000, width: 640, height: 200 }),
          },
        },
      ],
      URL,
    );
    expect(skipped).toBe(0);
    expect(sponsors.map((one) => one.id)).toEqual(["b", "a"]);
    expect(sponsors[1]?.strip?.desktop).toEqual({
      path: "sponsors/a/d.webp",
      url: `${URL}/storage/v1/object/public/site-assets/sponsors/a/d.webp`,
      width: 1940,
      height: 180,
      bytes: 96_000,
      type: "image/webp",
    });
    expect(sponsors[1]?.strip?.compact.type).toBe("image/png");
    expect(sponsors[0]?.strip).toBeUndefined();
  });

  it("opens a sponsor saved before the editor with an empty name and no weight on its pictures", () => {
    const { sponsors } = sponsorEditViewsOf(
      [
        {
          id: "old",
          active: true,
          alt: "Old banner",
          href: "https://old.example",
          panel: {
            desktop: picture("sponsors/old/p.jpg"),
            compact: picture("sponsors/old/q.jpeg"),
          },
        },
      ],
      URL,
    );
    expect(sponsors[0]?.advertiser).toBe("");
    expect(sponsors[0]?.panel?.desktop.bytes).toBeNull();
    expect(sponsors[0]?.panel?.compact.type).toBe("image/jpeg");
  });

  it("leaves out what it cannot read and a repeated id, and counts them", () => {
    const good = { id: "a", active: true, alt: "x", href: "https://a.example" };
    const { sponsors, skipped } = sponsorEditViewsOf(
      [good, good, "junk", null, { id: "", active: true, alt: "", href: "" }, { id: "z" }],
      URL,
    );
    expect(sponsors.map((one) => one.id)).toEqual(["a"]);
    expect(skipped).toBe(5);
  });
});

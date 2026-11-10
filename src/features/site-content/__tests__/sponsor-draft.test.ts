import { describe, expect, it } from "vitest";
import { SPONSOR_BUCKET } from "@/features/site";
import { SPONSOR_IMAGE_BUCKET, SPONSORS_MAX } from "../constants";
import {
  adsOf,
  canAddSponsor,
  countsOf,
  draftProblems,
  draftsOf,
  emptyDraft,
  hasProblems,
  heroViewOf,
  layoutWarningOf,
  payloadOf,
  serverProblemsOf,
  slotOf,
  statusOf,
  withSponsorActive,
  withSponsorAdded,
  withSponsorMoved,
  withSponsorRemoved,
  withSponsorReplaced,
  type DraftPicture,
  type SlotKey,
  type SponsorDraft,
} from "../sponsor-draft";
import { sponsorEditViewsOf } from "../sponsor-view";

const SUPABASE = "https://project.supabase.test";

const stored = (path: string, width: number, height: number): DraftPicture => ({
  kind: "stored",
  path,
  url: `${SUPABASE}/${path}`,
  width,
  height,
  bytes: 50_000,
  type: "image/webp",
});

const withStrip = (id: string): SponsorDraft["pictures"] => ({
  "strip-desktop": stored(`sponsors/${id}/sd.webp`, 1940, 180),
  "strip-phone": stored(`sponsors/${id}/sp.webp`, 640, 200),
});
const withPanel = (id: string): SponsorDraft["pictures"] => ({
  "panel-desktop": stored(`sponsors/${id}/pd.webp`, 1048, 988),
  "panel-phone": stored(`sponsors/${id}/pp.webp`, 1280, 640),
});

/** Only one picture of a slot (a format with its other half missing). */
function justOne(key: SlotKey, pictures: SponsorDraft["pictures"]): SponsorDraft["pictures"] {
  const picture = pictures[key];
  return picture ? { [key]: picture } : {};
}

function sponsor(id: string, extra: Partial<SponsorDraft> = {}): SponsorDraft {
  return {
    ...emptyDraft(id),
    advertiser: `Advertiser ${id}`,
    alt: `Banner of ${id}`,
    href: `https://${id}.example`,
    ...extra,
  };
}

describe("UT-sponsor-draft: the sponsor list the Hero page works on (S7-T11)", () => {
  it("names the four slots as the form does, with the stored device name", () => {
    expect(slotOf("strip-desktop")).toEqual({ format: "strip", device: "desktop" });
    expect(slotOf("strip-phone")).toEqual({ format: "strip", device: "compact" });
    expect(slotOf("panel-phone")).toEqual({ format: "panel", device: "compact" });
  });

  it("keeps the public bucket's name in step with the public side", () => {
    expect(SPONSOR_IMAGE_BUCKET).toBe(SPONSOR_BUCKET);
  });

  it("opens on the stored sponsors in their order, with both pictures of each format as stored slots", () => {
    const { sponsors } = sponsorEditViewsOf(
      [
        {
          id: "a",
          advertiser: "Alpha",
          active: true,
          alt: "Alpha banner",
          href: "https://a.example",
          strip: {
            desktop: { path: "sponsors/a/d.webp", width: 1940, height: 180, bytes: 90_000 },
            compact: { path: "sponsors/a/c.png", width: 640, height: 200 },
          },
        },
        { id: "b", active: false, alt: "Beta banner", href: "https://b.example" },
      ],
      SUPABASE,
    );
    const drafts = draftsOf(sponsors);
    expect(drafts.map((one) => one.id)).toEqual(["a", "b"]);
    expect(drafts[0]?.pictures["strip-desktop"]).toMatchObject({
      kind: "stored",
      path: "sponsors/a/d.webp",
      url: `${SUPABASE}/storage/v1/object/public/site-assets/sponsors/a/d.webp`,
      bytes: 90_000,
    });
    expect(drafts[0]?.pictures["strip-phone"]).toMatchObject({ bytes: null, type: "image/png" });
    expect(drafts[1]?.advertiser).toBe("");
    expect(drafts[1]?.pictures).toEqual({});
  });

  it("starts a new sponsor with Active on and nothing else", () => {
    expect(emptyDraft("x")).toEqual({
      id: "x",
      advertiser: "",
      alt: "",
      href: "",
      active: true,
      pictures: {},
    });
  });

  it("says needs images until a format has both pictures, and shows the switch after that", () => {
    expect(statusOf(sponsor("a"))).toBe("needs_images");
    const half = sponsor("a", { pictures: justOne("strip-desktop", withStrip("a")) });
    expect(statusOf(half)).toBe("needs_images");
    expect(statusOf(sponsor("a", { pictures: withStrip("a") }))).toBe("active");
    expect(statusOf(sponsor("a", { pictures: withPanel("a"), active: false }))).toBe("inactive");
  });

  it("counts sponsors and active sponsors", () => {
    expect(countsOf([sponsor("a"), sponsor("b", { active: false }), sponsor("c")])).toEqual({
      total: 3,
      active: 2,
    });
  });

  describe("the changes", () => {
    const list = [sponsor("a"), sponsor("b"), sponsor("c")];

    it("adds at the end, once, and stops at the most allowed", () => {
      expect(withSponsorAdded(list, sponsor("d")).map((one) => one.id)).toEqual([
        "a",
        "b",
        "c",
        "d",
      ]);
      expect(withSponsorAdded(list, sponsor("a"))).toHaveLength(3);
      const full = Array.from({ length: SPONSORS_MAX }, (_, index) => sponsor(`s${index}`));
      expect(canAddSponsor(full)).toBe(false);
      expect(canAddSponsor(full.slice(1))).toBe(true);
      expect(withSponsorAdded(full, sponsor("extra"))).toHaveLength(SPONSORS_MAX);
    });

    it("replaces a sponsor in its place and removes one", () => {
      const changed = withSponsorReplaced(list, { ...sponsor("b"), advertiser: "Changed" });
      expect(changed.map((one) => one.advertiser)).toEqual([
        "Advertiser a",
        "Changed",
        "Advertiser c",
      ]);
      expect(withSponsorRemoved(list, "b").map((one) => one.id)).toEqual(["a", "c"]);
      expect(withSponsorRemoved(list, "zzz")).toHaveLength(3);
    });

    it("moves a sponsor one place, and not past either end", () => {
      expect(withSponsorMoved(list, "b", "up").map((one) => one.id)).toEqual(["b", "a", "c"]);
      expect(withSponsorMoved(list, "b", "down").map((one) => one.id)).toEqual(["a", "c", "b"]);
      expect(withSponsorMoved(list, "a", "up").map((one) => one.id)).toEqual(["a", "b", "c"]);
      expect(withSponsorMoved(list, "c", "down").map((one) => one.id)).toEqual(["a", "b", "c"]);
      expect(withSponsorMoved(list, "nope", "up")).toHaveLength(3);
    });

    it("switches one sponsor on or off and leaves the others, and the old list, alone", () => {
      const off = withSponsorActive(list, "b", false);
      expect(off.map((one) => one.active)).toEqual([true, false, true]);
      expect(list.every((one) => one.active)).toBe(true);
    });
  });

  describe("checks before sending", () => {
    it("finds nothing wrong with a complete sponsor", () => {
      expect(hasProblems(draftProblems(sponsor("a", { pictures: withStrip("a") })))).toBe(false);
    });

    it("asks for the three boxes, and refuses a link that is not https or has a password", () => {
      expect(draftProblems(emptyDraft("a")).boxes).toEqual({
        advertiser: "validation.required",
        alt: "validation.required",
        href: "validation.required",
      });
      expect(draftProblems(sponsor("a", { href: "http://a.example" })).boxes.href).toBe(
        "validation.linkInvalid",
      );
      expect(draftProblems(sponsor("a", { href: "https://user:pw@a.example" })).boxes.href).toBe(
        "validation.linkInvalid",
      );
      expect(draftProblems(sponsor("a", { href: "not a link" })).boxes.href).toBe(
        "validation.linkInvalid",
      );
    });

    it("holds the boxes to their lengths", () => {
      expect(draftProblems(sponsor("a", { advertiser: "x".repeat(81) })).boxes.advertiser).toBe(
        "validation.invalid",
      );
      expect(draftProblems(sponsor("a", { alt: "x".repeat(201) })).boxes.alt).toBe(
        "validation.invalid",
      );
    });

    it("asks for the other picture when a format has only one", () => {
      const only = sponsor("a", { pictures: justOne("panel-phone", withPanel("a")) });
      expect(draftProblems(only).slots).toEqual({ "panel-desktop": "validation.required" });
      const other = sponsor("a", { pictures: justOne("strip-desktop", withStrip("a")) });
      expect(draftProblems(other).slots).toEqual({ "strip-phone": "validation.required" });
    });
  });

  describe("what is sent", () => {
    it("sends the whole list in order, with the stored paths of a ready format and none for a format with nothing", () => {
      const payload = payloadOf([
        sponsor("a", { pictures: { ...withStrip("a"), ...withPanel("a") } }),
        sponsor("b", { active: false }),
      ]);
      expect(payload.sponsors.map((one) => one.id)).toEqual(["a", "b"]);
      expect(payload.sponsors[0]).toEqual({
        id: "a",
        advertiser: "Advertiser a",
        alt: "Banner of a",
        href: "https://a.example",
        active: true,
        strip: { desktop: "sponsors/a/sd.webp", compact: "sponsors/a/sp.webp" },
        panel: { desktop: "sponsors/a/pd.webp", compact: "sponsors/a/pp.webp" },
      });
      expect(payload.sponsors[1]).not.toHaveProperty("strip");
      expect(payload.sponsors[1]).not.toHaveProperty("panel");
    });

    it("does not send a picture that is only chosen (it has to be put in the bucket first)", () => {
      const chosen: DraftPicture = {
        kind: "chosen",
        file: new File(["x"], "a.png"),
        url: "blob:x",
        width: 1940,
        height: 180,
        bytes: 1,
        type: "image/png",
        fit: "cover",
      };
      const payload = payloadOf([sponsor("a", { pictures: { "strip-desktop": chosen } })]);
      expect(payload.sponsors[0]).not.toHaveProperty("strip");
    });

    it("puts the server's problems on the sponsor, the box or the slot they belong to", () => {
      const list = [sponsor("a"), sponsor("b")];
      const found = serverProblemsOf(list, {
        "sponsors.1.href": "link",
        "sponsors.1.strip.compact": "small",
        "sponsors.0.panel.desktop": "shape",
        "sponsors.0": "list",
        "sponsors.9.alt": "nobody",
        "other.1.alt": "ignored",
      });
      expect(found.b).toEqual({ boxes: { href: "link" }, slots: { "strip-phone": "small" } });
      expect(found.a).toEqual({ boxes: {}, slots: { "panel-desktop": "shape" }, list: "list" });
      expect(Object.keys(found)).toHaveLength(2);
    });
  });

  describe("the picture of the hero and the warnings", () => {
    const strips = sponsor("a", { pictures: withStrip("a") });
    const both = sponsor("b", { pictures: { ...withStrip("b"), ...withPanel("b") } });
    const bare = sponsor("c");

    it("hands the public selection rules the same pictures the admin sees", () => {
      const ads = adsOf([both]);
      expect(ads[0]).toMatchObject({ id: "b", active: true, placements: ["hero", "results"] });
      expect(ads[0]?.panel?.compact).toMatchObject({ width: 1280, height: 640 });
      expect(ads[0]?.strip?.desktop.src).toBe(`${SUPABASE}/sponsors/b/sd.webp`);
      expect(adsOf([bare])[0]).not.toHaveProperty("strip");
    });

    it("shows the first sponsor that can show in the layout, in the admin's order", () => {
      const view = heroViewOf([bare, strips, both], "search_desk");
      expect(view.coverage.shown).toEqual(["a", "b"]);
      expect(view.banner?.desktop).toBe(`${SUPABASE}/sponsors/a/sd.webp`);
      expect(view.first).toEqual({ advertiser: "Advertiser a", shown: 2 });
      expect(heroViewOf([strips, both], "split").first).toEqual({
        advertiser: "Advertiser b",
        shown: 1,
      });
    });

    it("says why there is no banner: no sponsors, or none with the format", () => {
      expect(heroViewOf([], "split")).toMatchObject({ banner: null, reason: "no_sponsors" });
      expect(heroViewOf([strips], "split")).toMatchObject({
        banner: null,
        reason: "none_eligible",
      });
    });

    it("leaves out a sponsor that is switched off", () => {
      const off = sponsor("a", { pictures: withStrip("a"), active: false });
      expect(heroViewOf([off], "search_desk").banner).toBeNull();
    });

    it("warns when no sponsor can show, when some cannot, and not otherwise", () => {
      expect(layoutWarningOf(heroViewOf([strips], "split").coverage)).toEqual({
        kind: "none_can_show",
        format: "panel",
      });
      expect(layoutWarningOf(heroViewOf([strips, both, bare], "split").coverage)).toEqual({
        kind: "some_missing",
        format: "panel",
        missing: 2,
        active: 3,
      });
      expect(layoutWarningOf(heroViewOf([both], "split").coverage)).toBeNull();
      expect(layoutWarningOf(heroViewOf([], "search_desk").coverage)).toBeNull();
      expect(
        layoutWarningOf(heroViewOf([sponsor("a", { active: false })], "split").coverage),
      ).toBeNull();
    });
  });
});

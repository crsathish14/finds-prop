import { describe, expect, it, vi } from "vitest";
import { emptyDraft, type ChosenDraftPicture, type SponsorDraft } from "../sponsor-draft";
import type { SponsorStorage } from "../sponsor-storage";
import {
  checkPicture,
  chosenPictureOf,
  newSponsorId,
  randomToken,
  uploadChosen,
} from "../sponsor-upload";
import { jpeg, notAPicture, png, webpLossy } from "./sponsor-fixtures";

const fileOf = (bytes: Uint8Array, name = "banner", type = "image/png"): File =>
  new File([bytes as BlobPart], name, { type });

describe("UT-sponsor-upload: checking a picture and sending it (S7-T11)", () => {
  describe("checkPicture", () => {
    it("takes a picture at twice the slot, filling it", async () => {
      const check = await checkPicture(fileOf(webpLossy(1940, 180, 90_000)), "strip-desktop");
      expect(check).toMatchObject({ ok: true, fit: "cover", bytes: 90_000 });
      expect(check.ok && check.info).toEqual({ type: "image/webp", width: 1940, height: 180 });
    });

    it("takes a near miss and says it will be shown whole", async () => {
      // 1940 x 240 is about 20% too tall for the desktop strip: inside 30%, outside 8%.
      const check = await checkPicture(fileOf(png(1940, 240)), "strip-desktop");
      expect(check).toMatchObject({ ok: true, fit: "contain" });
    });

    it("refuses a file that is not a PNG, JPEG or WebP whatever its name or declared type says", async () => {
      const check = await checkPicture(
        fileOf(notAPicture(), "banner.png", "image/png"),
        "strip-desktop",
      );
      expect(check).toMatchObject({ ok: false, problem: "type", info: null });
    });

    it("refuses a picture over 150 KB, one under twice the slot, and one of the wrong shape", async () => {
      expect(
        await checkPicture(fileOf(png(1940, 180, 150 * 1024 + 1)), "strip-desktop"),
      ).toMatchObject({
        ok: false,
        problem: "size",
      });
      expect(await checkPicture(fileOf(jpeg(300, 150)), "panel-phone")).toMatchObject({
        ok: false,
        problem: "small",
      });
      expect(await checkPicture(fileOf(png(1940, 1000)), "strip-desktop")).toMatchObject({
        ok: false,
        problem: "shape",
      });
    });

    it("judges each slot by its own size", async () => {
      expect((await checkPicture(fileOf(png(640, 200)), "strip-phone")).ok).toBe(true);
      expect((await checkPicture(fileOf(png(640, 200)), "strip-desktop")).ok).toBe(false);
    });

    it("builds a chosen picture from a good check", async () => {
      const file = fileOf(png(1280, 640));
      const check = await checkPicture(file, "panel-phone");
      if (!check.ok) throw new Error("the picture should pass");
      expect(chosenPictureOf(file, check, "blob:preview")).toMatchObject({
        kind: "chosen",
        file,
        url: "blob:preview",
        width: 1280,
        height: 640,
        type: "image/png",
        fit: "cover",
      });
    });
  });

  describe("ids and names", () => {
    it("makes a different token each time, of letters and digits only", () => {
      expect(randomToken()).toMatch(/^[0-9a-f]{16}$/);
      expect(randomToken()).not.toBe(randomToken());
    });

    it("makes an id that fits the stored shape", () => {
      expect(newSponsorId(() => "abc123")).toBe("sp-abc123");
      expect(newSponsorId()).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
    });
  });

  describe("uploadChosen", () => {
    const chosen = (type: ChosenDraftPicture["type"]): ChosenDraftPicture => ({
      kind: "chosen",
      file: new File(["x"], "f"),
      url: "blob:preview",
      width: 1940,
      height: 180,
      bytes: 100,
      type,
      fit: "cover",
    });
    const stored = {
      kind: "stored" as const,
      path: "sponsors/sp/old.webp",
      url: "https://x/old.webp",
      width: 640,
      height: 200,
      bytes: 10,
      type: "image/webp" as const,
    };
    const draft = (pictures: SponsorDraft["pictures"]): SponsorDraft => ({
      ...emptyDraft("sp"),
      pictures,
    });
    const names = () => {
      let count = 0;
      return () => `n${++count}`;
    };

    it("sends each chosen picture under the sponsor's folder with an ending that matches its type, and keeps the rest", async () => {
      const upload = vi.fn().mockResolvedValue(true);
      const storage: SponsorStorage = { upload, remove: vi.fn() };
      const result = await uploadChosen(
        draft({
          "strip-desktop": chosen("image/webp"),
          "strip-phone": stored,
          "panel-desktop": chosen("image/jpeg"),
        }),
        storage,
        names(),
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.uploaded).toEqual(["sponsors/sp/n1.webp", "sponsors/sp/n2.jpg"]);
      expect(upload).toHaveBeenCalledTimes(2);
      expect(upload.mock.calls[0]?.[0]).toBe("sponsors/sp/n1.webp");
      expect(result.draft.pictures["strip-desktop"]).toMatchObject({
        kind: "stored",
        path: "sponsors/sp/n1.webp",
        url: "blob:preview",
      });
      expect(result.draft.pictures["strip-phone"]).toBe(stored);
      expect(result.draft.pictures["panel-desktop"]).toMatchObject({ path: "sponsors/sp/n2.jpg" });
    });

    it("sends nothing when no picture is new", async () => {
      const upload = vi.fn();
      const result = await uploadChosen(draft({ "strip-phone": stored }), {
        upload,
        remove: vi.fn(),
      });
      expect(result).toMatchObject({ ok: true, uploaded: [] });
      expect(upload).not.toHaveBeenCalled();
    });

    it("stops at the first picture that cannot be sent and names it and the files already sent", async () => {
      const upload = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
      const result = await uploadChosen(
        draft({
          "strip-desktop": chosen("image/png"),
          "strip-phone": chosen("image/png"),
          "panel-desktop": chosen("image/png"),
        }),
        { upload, remove: vi.fn() },
        names(),
      );
      expect(result).toEqual({ ok: false, slot: "strip-phone", uploaded: ["sponsors/sp/n1.png"] });
      expect(upload).toHaveBeenCalledTimes(2);
    });
  });
});

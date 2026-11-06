// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  announceDraftOnce,
  DRAFT_MAX_AGE_MS,
  DRAFT_MAX_ANSWERS,
  DRAFT_MAX_TEXT,
  dropDraft,
  resetDraftsForTests,
  saveDraft,
  takeDraft,
} from "../form-draft";

const PAGE = "/properties/3-bhk-velachery";

beforeEach(() => {
  window.sessionStorage.clear();
  resetDraftsForTests();
  vi.restoreAllMocks();
});

describe("form-draft: answers kept while the visitor signs in again (S5-T07)", () => {
  it("keeps the answers for this page and gives them back, removing them from storage", () => {
    saveDraft("enquiry", PAGE, { name: "Priya Raman", message: "Hello" });
    expect(window.sessionStorage.length).toBe(1);
    expect(takeDraft("enquiry", PAGE)).toEqual({ name: "Priya Raman", message: "Hello" });
    expect(window.sessionStorage.length).toBe(0);
  });

  it("gives the very same answers each time it is asked, as a page that draws again and again needs", () => {
    saveDraft("enquiry", PAGE, { name: "Priya Raman" });
    const first = takeDraft("enquiry", PAGE);
    expect(takeDraft("enquiry", PAGE)).toBe(first);
    expect(takeDraft("project-lead", PAGE)).toBeNull();
    expect(takeDraft("project-lead", PAGE)).toBeNull();
  });

  it("says the answers were kept only once, however many forms on the page ask", () => {
    saveDraft("enquiry", PAGE, { name: "Priya Raman" });
    expect(announceDraftOnce("enquiry", PAGE)).toBe(true);
    expect(announceDraftOnce("enquiry", PAGE)).toBe(false);
  });

  it("keeps each form on each page apart", () => {
    saveDraft("enquiry", PAGE, { name: "Priya Raman" });
    expect(takeDraft("enquiry", "/properties/another-home")).toBeNull();
    expect(takeDraft("project-lead", PAGE)).toBeNull();
    expect(takeDraft("enquiry", PAGE)).toEqual({ name: "Priya Raman" });
  });

  it("keeps text, ticked boxes and ticked choices", () => {
    saveDraft("form", PAGE, { name: "Priya", agree: true, parking: ["Gym", "Garden"] });
    expect(takeDraft("form", PAGE)).toEqual({
      name: "Priya",
      agree: true,
      parking: ["Gym", "Garden"],
    });
  });

  it("drops answers older than 30 minutes", () => {
    saveDraft("enquiry", PAGE, { name: "Priya Raman" }, 1_000);
    expect(takeDraft("enquiry", PAGE, 1_000 + DRAFT_MAX_AGE_MS + 1)).toBeNull();
    expect(window.sessionStorage.length).toBe(0);
  });

  it("still gives answers that are just inside 30 minutes", () => {
    saveDraft("enquiry", PAGE, { name: "Priya Raman" }, 1_000);
    expect(takeDraft("enquiry", PAGE, 1_000 + DRAFT_MAX_AGE_MS)).toEqual({
      name: "Priya Raman",
    });
  });

  it("cuts long answers and keeps at most 20 answers", () => {
    const many: Record<string, string> = {};
    for (let index = 0; index < DRAFT_MAX_ANSWERS + 5; index += 1) many["field" + index] = "x";
    saveDraft("form", PAGE, { ...many, long: "y".repeat(DRAFT_MAX_TEXT + 100) });
    const values = takeDraft("form", PAGE) ?? {};
    expect(Object.keys(values)).toHaveLength(DRAFT_MAX_ANSWERS);
    saveDraft("form2", PAGE, { long: "y".repeat(DRAFT_MAX_TEXT + 100) });
    expect(String(takeDraft("form2", PAGE)?.["long"]).length).toBe(DRAFT_MAX_TEXT);
  });

  it("ignores something in storage that is not a draft, and removes it", () => {
    window.sessionStorage.setItem("findsprop:draft:enquiry:" + PAGE, "not json");
    expect(takeDraft("enquiry", PAGE)).toBeNull();
    resetDraftsForTests();
    window.sessionStorage.setItem(
      "findsprop:draft:enquiry:" + PAGE,
      JSON.stringify({ at: Date.now(), values: { name: { nested: true } } }),
    );
    expect(takeDraft("enquiry", PAGE)).toBeNull();
    expect(window.sessionStorage.length).toBe(0);
  });

  it("keeps answers saved after an earlier read of the same page, as the next visit needs", () => {
    expect(takeDraft("enquiry", PAGE)).toBeNull();
    saveDraft("enquiry", PAGE, { name: "Priya Raman" });
    expect(takeDraft("enquiry", PAGE)).toEqual({ name: "Priya Raman" });
  });

  it("forgets the answers once the form is sent", () => {
    saveDraft("enquiry", PAGE, { name: "Priya Raman" });
    dropDraft("enquiry", PAGE);
    expect(takeDraft("enquiry", PAGE)).toBeNull();
  });

  it("does nothing, and does not throw, when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => saveDraft("enquiry", PAGE, { name: "Priya Raman" })).not.toThrow();
    expect(takeDraft("enquiry", PAGE)).toBeNull();
  });
});

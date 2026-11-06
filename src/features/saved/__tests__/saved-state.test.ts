// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  read: vi.fn(),
  save: vi.fn(),
  unsave: vi.fn(),
}));
const notes = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock("../actions", () => ({
  readSavedHomes: actions.read,
  saveHomeAction: actions.save,
  unsaveHomeAction: actions.unsave,
}));
vi.mock("@/lib/notify", () => ({ notify: notes }));

const state = await import("../saved-state");

const SIGNED_IN = { ok: true, data: { signedIn: true, shortIds: ["aaaaaaaa"] } };
const SIGNED_OUT = { ok: true, data: { signedIn: false, shortIds: [] } };
const OK = { ok: true, data: { saved: true } };
const REFUSED = { ok: false, code: "FORBIDDEN" };

beforeEach(() => {
  state.resetSavedForTests();
  actions.read.mockReset();
  actions.save.mockReset();
  actions.unsave.mockReset();
  notes.success.mockReset();
  notes.error.mockReset();
  window.sessionStorage.clear();
});

describe("saved-state: the visitor's saved homes in the browser (S5-T01)", () => {
  it("reads who is signed in and which homes they saved, once", async () => {
    actions.read.mockResolvedValue(SIGNED_IN);
    await state.ensureSavedLoaded("saved");
    await state.ensureSavedLoaded("saved");
    expect(actions.read).toHaveBeenCalledTimes(1);
    const snapshot = state.getSavedSnapshot();
    expect(snapshot.ready).toBe(true);
    expect(snapshot.signedIn).toBe(true);
    expect(snapshot.saved.has("aaaaaaaa")).toBe(true);
  });

  it("a signed-in tap saves at once and keeps it when the server agrees", async () => {
    actions.read.mockResolvedValue(SIGNED_IN);
    actions.save.mockResolvedValue(OK);
    const outcome = await state.toggleSaved("bbbbbbbb", "/auth", vi.fn());
    expect(outcome).toBe("saved");
    expect(actions.save).toHaveBeenCalledWith({ shortId: "bbbbbbbb" });
    expect(state.getSavedSnapshot().saved.has("bbbbbbbb")).toBe(true);
  });

  it("a second tap on a saved home removes it", async () => {
    actions.read.mockResolvedValue(SIGNED_IN);
    actions.unsave.mockResolvedValue({ ok: true, data: { saved: false } });
    const outcome = await state.toggleSaved("aaaaaaaa", "/auth", vi.fn());
    expect(outcome).toBe("removed");
    expect(actions.unsave).toHaveBeenCalledWith({ shortId: "aaaaaaaa" });
    expect(state.getSavedSnapshot().saved.has("aaaaaaaa")).toBe(false);
  });

  it("puts the set back when the server refuses the change", async () => {
    actions.read.mockResolvedValue(SIGNED_IN);
    actions.save.mockResolvedValue(REFUSED);
    const outcome = await state.toggleSaved("bbbbbbbb", "/auth", vi.fn());
    expect(outcome).toBe("failed");
    expect(state.getSavedSnapshot().saved.has("bbbbbbbb")).toBe(false);
  });

  it("sends a signed-out visitor to sign in, and remembers the home for this tab", async () => {
    actions.read.mockResolvedValue(SIGNED_OUT);
    const go = vi.fn();
    const outcome = await state.toggleSaved("bbbbbbbb", "/auth?gate=save", go);
    expect(outcome).toBe("signed-out");
    expect(go).toHaveBeenCalledWith("/auth?gate=save");
    expect(actions.save).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem("findsprop:pending-save:v1")).toBe("bbbbbbbb");
  });

  it("saves the remembered home once after the visitor comes back signed in, with a word", async () => {
    window.sessionStorage.setItem("findsprop:pending-save:v1", "bbbbbbbb");
    actions.read.mockResolvedValue(SIGNED_IN);
    actions.save.mockResolvedValue(OK);
    await state.ensureSavedLoaded("Saved to your dashboard");
    expect(actions.save).toHaveBeenCalledWith({ shortId: "bbbbbbbb" });
    expect(notes.success).toHaveBeenCalledWith("Saved to your dashboard");
    expect(window.sessionStorage.getItem("findsprop:pending-save:v1")).toBeNull();
  });

  it("does not save a remembered home for a visitor who is still signed out", async () => {
    window.sessionStorage.setItem("findsprop:pending-save:v1", "bbbbbbbb");
    actions.read.mockResolvedValue(SIGNED_OUT);
    await state.ensureSavedLoaded("x");
    expect(actions.save).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem("findsprop:pending-save:v1")).toBe("bbbbbbbb");
  });

  it("reads again after a failed read, rather than keeping the failure", async () => {
    actions.read.mockResolvedValueOnce({ ok: false, code: "UPSTREAM_FAILED" });
    actions.read.mockResolvedValueOnce(SIGNED_OUT);
    expect(await state.ensureSavedLoaded("x")).toBe(false);
    expect(await state.ensureSavedLoaded("x")).toBe(true);
    expect(actions.read).toHaveBeenCalledTimes(2);
  });

  it("a tap before the read has finished waits for it, then acts", async () => {
    actions.read.mockResolvedValue(SIGNED_OUT);
    const go = vi.fn();
    const outcome = await state.toggleSaved("cccccccc", "/auth", go);
    expect(outcome).toBe("signed-out");
    expect(go).toHaveBeenCalledTimes(1);
  });
});

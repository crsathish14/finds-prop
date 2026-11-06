// @vitest-environment jsdom
import { act, fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import { resetSavedForTests } from "../saved-state";

const actions = vi.hoisted(() => ({ read: vi.fn(), save: vi.fn(), unsave: vi.fn() }));
vi.mock("../actions", () => ({
  readSavedHomes: actions.read,
  saveHomeAction: actions.save,
  unsaveHomeAction: actions.unsave,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({}) }));

const { SaveHomeAction, SaveHomeButton } = await import("../save-home.client");

beforeEach(() => {
  resetSavedForTests();
  actions.read.mockReset();
  actions.save.mockReset();
  actions.unsave.mockReset();
});

describe("SaveHomeButton: the heart on a card", () => {
  it("is not pressed until the visitor's saved homes are known, then shows what they saved", async () => {
    actions.read.mockResolvedValue({ ok: true, data: { signedIn: true, shortIds: ["aaaaaaaa"] } });
    renderWithMessages(<SaveHomeButton shortId="aaaaaaaa" />);
    expect(screen.getByRole("button", { name: "Save to shortlist" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await act(async () => undefined);
    expect(await screen.findByRole("button", { name: "Remove from saved homes" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("saves a home when a signed-in visitor taps it", async () => {
    actions.read.mockResolvedValue({ ok: true, data: { signedIn: true, shortIds: [] } });
    actions.save.mockResolvedValue({ ok: true, data: { saved: true } });
    renderWithMessages(<SaveHomeButton shortId="bbbbbbbb" />);
    await act(async () => undefined);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save to shortlist" }));
    });
    expect(actions.save).toHaveBeenCalledWith({ shortId: "bbbbbbbb" });
    expect(
      await screen.findByRole("button", { name: "Remove from saved homes" }),
    ).toBeInTheDocument();
  });
});

describe("SaveHomeAction: the save button on a property page", () => {
  it("names the action, and says Saved once it is", async () => {
    actions.read.mockResolvedValue({ ok: true, data: { signedIn: true, shortIds: ["aaaaaaaa"] } });
    renderWithMessages(<SaveHomeAction shortId="aaaaaaaa" />);
    expect(await screen.findByRole("button", { name: "Saved" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("offers Save home to a visitor who has not saved it", async () => {
    actions.read.mockResolvedValue({ ok: true, data: { signedIn: true, shortIds: [] } });
    renderWithMessages(<SaveHomeAction shortId="aaaaaaaa" />);
    expect(await screen.findByRole("button", { name: "Save home" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});

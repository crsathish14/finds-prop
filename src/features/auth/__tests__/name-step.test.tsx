// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/i18n/messages/en.json";
import type { ActionResult } from "@/types/action";
import { renderWithMessages } from "../../../../tests/render-intl";
import { saveProfileName } from "../actions";
import { NameStep, type NameReason } from "../name-step.client";

// The action reaches the server; the test stands in for it.
vi.mock("../actions", () => ({ saveProfileName: vi.fn() }));

const words = en.auth.name;
const save = vi.mocked(saveProfileName);
const onDone = vi.fn();

const field = () => screen.getByLabelText(new RegExp(words.label));
const continueButton = () => screen.getByRole("button", { name: new RegExp(`^${words.save}$`) });

function answer(result: ActionResult<{ name: string }>) {
  save.mockResolvedValueOnce(result);
}

function renderName(reason: NameReason = "signup") {
  return renderWithMessages(<NameStep reason={reason} onDone={onDone} />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("name step: after the first sign-in (ADD-04)", () => {
  it("asks what to call the visitor, in one labelled and required field", () => {
    renderName();
    expect(screen.getByRole("heading", { level: 1, name: words.title })).toBeInTheDocument();
    expect(screen.getByText(words.lead)).toBeInTheDocument();
    expect(field()).toHaveAttribute("autocomplete", "name");
    expect(field()).toHaveAttribute("maxlength", "80");
    expect(field()).toHaveAttribute("aria-required", "true");
    expect(field()).toHaveAttribute("placeholder", words.placeholder);
    expect(screen.getByText("0 / 80")).toBeInTheDocument();
  });

  it("counts the characters as the visitor types", async () => {
    renderName();
    await userEvent.type(field(), "Priya Raman");
    expect(screen.getByText("11 / 80")).toBeInTheDocument();
  });

  it("lets the visitor skip, and says they will be asked again", async () => {
    renderName();
    expect(screen.getByText(words.askAgain)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: words.skip }));
    expect(onDone).toHaveBeenCalledOnce();
    expect(save).not.toHaveBeenCalled();
  });
});

describe("name step: when posting or enquiring needs a name", () => {
  it.each<[NameReason, string, string]>([
    ["post", words.postTitle, words.postLead],
    ["enquire", words.enquireTitle, words.enquireLead],
  ])("shows the %s wording, with Back instead of Skip", (reason, title, lead) => {
    renderName(reason);
    expect(screen.getByRole("heading", { level: 1, name: title })).toBeInTheDocument();
    expect(screen.getByText(lead)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: words.back })).toHaveAttribute("href", "/");
    expect(screen.queryByRole("button", { name: words.skip })).not.toBeInTheDocument();
    expect(screen.queryByText(words.askAgain)).not.toBeInTheDocument();
  });
});

describe("name step: the name", () => {
  it.each(["P", "   ", "  P  "])(
    "says it is too short for %j, and asks nothing of the server",
    async (typed) => {
      renderName();
      if (typed) await userEvent.type(field(), typed);
      await userEvent.click(continueButton());
      expect(screen.getByText(en.validation.nameTooShort)).toBeInTheDocument();
      expect(field()).toHaveAttribute("aria-invalid", "true");
      expect(save).not.toHaveBeenCalled();
    },
  );

  it("clears the message as soon as the visitor edits the name", async () => {
    renderName();
    await userEvent.type(field(), "P");
    await userEvent.click(continueButton());
    await userEvent.type(field(), "r");
    expect(screen.queryByText(en.validation.nameTooShort)).not.toBeInTheDocument();
  });

  it("saves the name as typed, then hands over to the next step", async () => {
    answer({ ok: true, data: { name: "Priya Raman" } });
    renderName();
    await userEvent.type(field(), "Priya Raman");
    await userEvent.click(continueButton());
    expect(save).toHaveBeenCalledWith({ name: "Priya Raman" });
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
  });

  it("shows Saving, and turns the field and Skip off, while it waits", async () => {
    let finish: (result: ActionResult<{ name: string }>) => void = () => undefined;
    save.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    renderName();
    await userEvent.type(field(), "Priya Raman");
    await userEvent.click(continueButton());
    expect(await screen.findByRole("button", { name: words.saving })).toBeDisabled();
    expect(field()).toBeDisabled();
    expect(screen.getByRole("button", { name: words.skip })).toBeDisabled();
    expect(save).toHaveBeenCalledOnce();
    finish({ ok: true, data: { name: "Priya Raman" } });
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });

  it("shows the server's verdict on the name, in words from en.json", async () => {
    answer({
      ok: false,
      code: "VALIDATION",
      fieldErrors: { name: [{ key: "validation.tooLong", values: { maximum: 80 } }] },
    });
    renderName();
    await userEvent.type(field(), "Priya Raman");
    await userEvent.click(continueButton());
    expect(await screen.findByText("Use at most 80 characters.")).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
  });

  it("keeps the name and says something went wrong when saving fails", async () => {
    answer({ ok: false, code: "INTERNAL", requestId: "req-1" });
    renderName();
    await userEvent.type(field(), "Priya Raman");
    await userEvent.click(continueButton());
    expect(await screen.findByText(en.errors.INTERNAL)).toBeInTheDocument();
    expect(field()).toHaveValue("Priya Raman");
    expect(await screen.findByRole("button", { name: words.save })).toBeEnabled();
    expect(onDone).not.toHaveBeenCalled();
  });

  it("says the visitor must sign in when the session is gone", async () => {
    answer({ ok: false, code: "UNAUTHENTICATED" });
    renderName();
    await userEvent.type(field(), "Priya Raman");
    await userEvent.click(continueButton());
    expect(await screen.findByText(en.errors.UNAUTHENTICATED)).toBeInTheDocument();
  });
});

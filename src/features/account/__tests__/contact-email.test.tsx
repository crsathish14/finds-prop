// @vitest-environment jsdom
import { act, fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/i18n/messages/en.json";
import type { ActionResult } from "@/types/action";
import { renderWithMessages } from "../../../../tests/render-intl";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("@/lib/notify", () => ({ notify: toast }));

const { ContactEmail } = await import("../contact-email.client");

const card = en.domain.contactEmailCard;
const words = en.account.dashboard.contactEmail;

type Saved = ActionResult<{ email: string }>;
const saved = (email = "owner@example.test"): Saved => ({ ok: true, data: { email } });

beforeEach(() => {
  vi.clearAllMocks();
});

function type(value: string) {
  fireEvent.change(screen.getByLabelText(card.label), { target: { value } });
}

async function save() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: card.save }));
  });
}

describe("ContactEmail: the dashboard card for the email enquiries are mailed to (ADR-184)", () => {
  it("shows the prompt when the account has no address", () => {
    renderWithMessages(<ContactEmail email={null} save={vi.fn()} />);
    expect(screen.getByRole("heading", { level: 2, name: card.promptTitle })).toBeVisible();
  });

  it("saves the typed address and then shows it with Change, with a short confirmation", async () => {
    const save_ = vi.fn(async () => saved());
    renderWithMessages(<ContactEmail email={null} save={save_} />);
    type("Owner@Example.Test");
    await save();
    expect(save_).toHaveBeenCalledWith({ email: "Owner@Example.Test" });
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Enquiries about your homes are emailed to owner@example.test",
      }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: card.change })).toBeVisible();
    expect(toast.success).toHaveBeenCalledWith(words.savedToast);
  });

  it("does not call the server for an empty box or an address that is plainly not one", async () => {
    const save_ = vi.fn();
    renderWithMessages(<ContactEmail email={null} save={save_} />);
    await save();
    expect(screen.getByText(en.validation.contactEmailRequired)).toBeVisible();
    type("owner at example");
    await save();
    expect(screen.getByText(en.validation.emailInvalid)).toBeVisible();
    expect(save_).not.toHaveBeenCalled();
  });

  it("changes a saved address: Change opens the box with it, Cancel puts the saved one back", async () => {
    renderWithMessages(<ContactEmail email="owner@example.test" save={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: card.change }));
    expect(screen.getByLabelText(card.label)).toHaveValue("owner@example.test");
    fireEvent.click(screen.getByRole("button", { name: card.cancel }));
    expect(screen.queryByLabelText(card.label)).toBeNull();
    expect(screen.getByText(/owner@example\.test/)).toBeVisible();
  });

  it("shows the server's refusal of the address next to the box and keeps what was typed", async () => {
    const save_ = vi.fn(async (): Promise<Saved> => ({
      ok: false,
      code: "VALIDATION",
      fieldErrors: { email: [{ key: "validation.emailTaken" }] },
    }));
    renderWithMessages(<ContactEmail email={null} save={save_} />);
    type("owner@example.test");
    await save();
    expect(screen.getByText(en.validation.emailTaken)).toBeVisible();
    expect(screen.getByLabelText(card.label)).toHaveValue("owner@example.test");
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("says so when the save failed for another reason, and when the request did not get through", async () => {
    const refused = vi.fn(async (): Promise<Saved> => ({
      ok: false,
      code: "RATE_LIMITED",
      retryAfter: 600,
    }));
    const view = renderWithMessages(<ContactEmail email={null} save={refused} />);
    type("owner@example.test");
    await save();
    expect(screen.getByRole("alert")).toHaveTextContent(/Too many attempts/);
    view.unmount();
    const offline = vi.fn(async (): Promise<Saved> => {
      throw new Error("offline");
    });
    renderWithMessages(<ContactEmail email={null} save={offline} />);
    type("owner@example.test");
    await save();
    expect(screen.getByRole("alert")).toHaveTextContent(words.failed);
  });
});

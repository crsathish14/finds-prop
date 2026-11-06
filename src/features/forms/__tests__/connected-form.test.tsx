// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import messages from "@/i18n/messages/en.json";
import type { ActionResult } from "@/types/action";
import { renderWithMessages } from "../../../../tests/render-intl";
import { ConnectedForm, type SubmitFormAction } from "../connected-form.client";
import { CONTACT_FORM } from "../contact-form";

const words = messages.domain.dynamicForm;

const OK: ActionResult<{ received: true }> = { ok: true, data: { received: true } };

function setup(send: SubmitFormAction) {
  renderWithMessages(
    <ConnectedForm
      form={CONTACT_FORM}
      send={send}
      source="/contact"
      consent="consent line"
      sent={<p>It was sent</p>}
    />,
  );
}

async function fillAndSend() {
  await userEvent.type(screen.getByLabelText(/Your name/), "Priya Raman");
  await userEvent.type(screen.getByLabelText(/Mobile/), "98400 12345");
  await userEvent.click(screen.getByRole("button", { name: "Send message" }));
}

describe("ConnectedForm: the contact form connected to the action (S5-T05)", () => {
  it("sends the form's slug, the answers, the page and a one-time key, then shows the confirmation", async () => {
    const send = vi.fn<SubmitFormAction>().mockResolvedValue(OK);
    setup(send);
    await fillAndSend();
    await waitFor(() => expect(screen.getByText("It was sent")).toBeVisible());
    expect(send).toHaveBeenCalledTimes(1);
    const input = send.mock.calls[0]?.[0];
    expect(input).toMatchObject({
      formSlug: "contact",
      source: "/contact",
      values: { name: "Priya Raman", mobile: "98400 12345", email: "", interest: "", message: "" },
    });
    expect(input?.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
    expect(input).not.toHaveProperty("projectSlug");
  });

  it("uses the form's own button words", () => {
    setup(vi.fn<SubmitFormAction>());
    expect(screen.getByRole("button", { name: "Send message" })).toBeVisible();
  });

  it("puts the server's field messages beside the fields and keeps what was typed", async () => {
    const send = vi.fn<SubmitFormAction>().mockResolvedValue({
      ok: false,
      code: "VALIDATION",

      fieldErrors: { mobile: [{ key: "validation.phoneInvalid" }] },
    });
    setup(send);
    await fillAndSend();
    await waitFor(() => expect(screen.getByLabelText(/Mobile/)).toBeInvalid());
    expect(screen.getByLabelText(/Mobile/)).toHaveAccessibleDescription(
      messages.validation.phoneInvalid,
    );
    expect(screen.getByLabelText(/Your name/)).toHaveValue("Priya Raman");
    expect(screen.queryByText("It was sent")).not.toBeInTheDocument();
  });

  it("says the limit is reached, with the form kept", async () => {
    const send = vi
      .fn<SubmitFormAction>()
      .mockResolvedValue({ ok: false, code: "RATE_LIMITED", retryAfter: 1800 });
    setup(send);
    await fillAndSend();
    await waitFor(() => expect(screen.getByText(words.rateLimit.title)).toBeVisible());
    expect(screen.getByLabelText(/Your name/)).toHaveValue("Priya Raman");
  });

  it("says it could not send for any other answer, and when the request itself failed", async () => {
    const send = vi
      .fn<SubmitFormAction>()
      .mockResolvedValueOnce({ ok: false, code: "INTERNAL" })
      .mockRejectedValueOnce(new Error("offline"));
    setup(send);
    await fillAndSend();
    await waitFor(() => expect(screen.getByText(words.failed.title)).toBeVisible());
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() => expect(send).toHaveBeenCalledTimes(2));
    expect(screen.getByText(words.failed.title)).toBeVisible();
  });

  it("sends the same key again for a retry, so a retry stores one submission", async () => {
    const send = vi
      .fn<SubmitFormAction>()
      .mockResolvedValueOnce({ ok: false, code: "INTERNAL" })
      .mockResolvedValueOnce(OK);
    setup(send);
    await fillAndSend();
    await waitFor(() => expect(screen.getByText(words.failed.title)).toBeVisible());
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() => expect(screen.getByText("It was sent")).toBeVisible());
    expect(send.mock.calls[1]?.[0].idempotencyKey).toBe(send.mock.calls[0]?.[0].idempotencyKey);
  });

  it("names the project page when the form is shown on one", async () => {
    const send = vi.fn<SubmitFormAction>().mockResolvedValue(OK);
    renderWithMessages(
      <ConnectedForm
        form={CONTACT_FORM}
        send={send}
        source="/projects/kadal-vista"
        projectSlug="kadal-vista"
        sent={<p>It was sent</p>}
      />,
    );
    await fillAndSend();
    await waitFor(() => expect(send).toHaveBeenCalled());
    expect(send.mock.calls[0]?.[0]).toMatchObject({ projectSlug: "kadal-vista" });
  });
});

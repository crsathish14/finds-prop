// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/i18n/messages/en.json";
import { renderWithMessages } from "../../../../tests/render-intl";

const submitProjectLead = vi.hoisted(() => vi.fn());
const trackProjectEvent = vi.hoisted(() => vi.fn());
vi.mock("../actions", () => ({ submitProjectLead, trackProjectEvent }));

const { ProjectLeadPanel } = await import("../project-lead-panel.client");
const { ProjectViewTracker } = await import("../project-view-tracker.client");

const words = en.projects.page.lead;
const PANEL = (
  <ProjectLeadPanel
    slug="kadal-vista"
    developerName="Kadal Homes"
    phone="+91 98••• ••345"
    visitDateMin="2026-11-06"
    visitDateMax="2027-11-06"
  />
);

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(new RegExp(`^${label}`)), { target: { value } });
}
const send = (name: string) => fireEvent.click(screen.getByRole("button", { name }));
/** The card is busy until the action has finished; a second click before that does nothing. */
const idle = (name: string) =>
  waitFor(() =>
    expect(screen.getByRole("button", { name })).not.toHaveAttribute("aria-busy", "true"),
  );

beforeEach(() => {
  vi.clearAllMocks();
  submitProjectLead.mockResolvedValue({ ok: true, data: { received: true } });
  trackProjectEvent.mockResolvedValue({ ok: true, data: { recorded: true } });
});

describe("ProjectLeadPanel: the card connected to the action (S4-T09 D1b)", () => {
  it("sends the request with the project, a one-time key and no phone, then shows the thank-you note", async () => {
    renderWithMessages(PANEL);
    type(words.name, "Priya Raman");
    type(words.message, "Is a 3 BHK left?");
    send(words.send);
    await waitFor(() => expect(screen.getByText(words.sent.title)).toBeInTheDocument());
    const input = submitProjectLead.mock.calls[0]?.[0];
    expect(input).toMatchObject({
      slug: "kadal-vista",
      kind: "enquiry",
      name: "Priya Raman",
      message: "Is a 3 BHK left?",
    });
    expect(input.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
    expect(input).not.toHaveProperty("phone");
    expect(input).not.toHaveProperty("visitDate");
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("sends the date with a site visit", async () => {
    renderWithMessages(PANEL);
    fireEvent.click(screen.getByRole("radio", { name: words.siteVisit }));
    type(words.name, "Priya Raman");
    type(words.visitDate, "2026-11-20");
    send(words.requestVisit);
    await waitFor(() => expect(submitProjectLead).toHaveBeenCalled());
    expect(submitProjectLead.mock.calls[0]?.[0]).toMatchObject({
      kind: "site_visit",
      visitDate: "2026-11-20",
    });
  });

  it("checks the form first: a short name and a missing date are marked and nothing is sent", () => {
    renderWithMessages(PANEL);
    fireEvent.click(screen.getByRole("radio", { name: words.siteVisit }));
    type(words.name, "P");
    send(words.requestVisit);
    expect(screen.getByText(en.validation.nameTooShort)).toBeInTheDocument();
    expect(screen.getByText(en.validation.required)).toBeInTheDocument();
    expect(submitProjectLead).not.toHaveBeenCalled();
  });

  it("marks a date outside the window without a round trip", () => {
    renderWithMessages(PANEL);
    fireEvent.click(screen.getByRole("radio", { name: words.siteVisit }));
    type(words.name, "Priya Raman");
    type(words.visitDate, "2020-01-01");
    send(words.requestVisit);
    expect(screen.getByText(en.validation.visitDateRange)).toBeInTheDocument();
    expect(submitProjectLead).not.toHaveBeenCalled();
  });

  it("draws the field messages the server sends back, and keeps the form as typed", async () => {
    submitProjectLead.mockResolvedValue({
      ok: false,
      code: "VALIDATION",
      fieldErrors: { email: [{ key: "validation.emailInvalid" }] },
    });
    renderWithMessages(PANEL);
    type(words.name, "Priya Raman");
    send(words.send);
    await waitFor(() => expect(screen.getByText(en.validation.emailInvalid)).toBeInTheDocument());
    expect(screen.getByLabelText(new RegExp(`^${words.name}`))).toHaveValue("Priya Raman");
  });

  it("says to wait a little when the visitor has sent too many", async () => {
    submitProjectLead.mockResolvedValue({ ok: false, code: "RATE_LIMITED", retryAfter: 1800 });
    renderWithMessages(PANEL);
    type(words.name, "Priya Raman");
    send(words.send);
    await waitFor(() => expect(screen.getByText(words.rateLimit.title)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: words.send })).toBeInTheDocument();
  });

  it("says to try again for any other failure, and when the request does not get through", async () => {
    submitProjectLead.mockResolvedValueOnce({ ok: false, code: "INTERNAL" });
    renderWithMessages(PANEL);
    type(words.name, "Priya Raman");
    send(words.send);
    await waitFor(() => expect(screen.getByText(words.failed)).toBeInTheDocument());
    await idle(words.send);
    submitProjectLead.mockRejectedValueOnce(new Error("offline"));
    send(words.send);
    await waitFor(() => expect(submitProjectLead).toHaveBeenCalledTimes(2));
    expect(screen.getByText(words.failed)).toBeInTheDocument();
  });

  it("uses the same key for a retry of the same form, so one lead is stored", async () => {
    submitProjectLead.mockResolvedValueOnce({ ok: false, code: "INTERNAL" });
    renderWithMessages(PANEL);
    type(words.name, "Priya Raman");
    send(words.send);
    await waitFor(() => expect(screen.getByText(words.failed)).toBeInTheDocument());
    await idle(words.send);
    send(words.send);
    await waitFor(() => expect(submitProjectLead).toHaveBeenCalledTimes(2));
    expect(submitProjectLead.mock.calls[1]?.[0].idempotencyKey).toBe(
      submitProjectLead.mock.calls[0]?.[0].idempotencyKey,
    );
  });
});

describe("ProjectViewTracker: recording that the page was opened (S4-T09 D1b)", () => {
  it("records one view for the project, draws nothing, and not again on a re-render", () => {
    const { container, rerender } = render(<ProjectViewTracker slug="kadal-vista" />);
    expect(container).toBeEmptyDOMElement();
    expect(trackProjectEvent).toHaveBeenCalledWith({ slug: "kadal-vista", event: "view" });
    rerender(<ProjectViewTracker slug="kadal-vista" />);
    expect(trackProjectEvent).toHaveBeenCalledTimes(1);
  });

  it("does not show or throw an error when the view cannot be recorded", async () => {
    trackProjectEvent.mockRejectedValue(new Error("offline"));
    const { container } = render(<ProjectViewTracker slug="kadal-vista" />);
    await Promise.resolve();
    expect(container).toBeEmptyDOMElement();
  });
});

describe("the consent line under Send (S5-T06)", () => {
  it("names the developer the request goes to, with a link to the privacy page", () => {
    renderWithMessages(PANEL);
    expect(
      screen.getByText(/Your name, phone number and message go to Kadal Homes and Find Prop/),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: words.consentPrivacy })).toHaveAttribute(
      "href",
      "/privacy",
    );
  });
});

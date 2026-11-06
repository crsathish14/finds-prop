// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/i18n/messages/en.json";
import { ActionError } from "@/server/actions/normalise-error";

const verifiedPhoneDigits = vi.hoisted(() => vi.fn());
vi.mock("../service", () => ({ verifiedPhoneDigits }));
vi.mock("../actions", () => ({ submitProjectLead: vi.fn(), trackProjectEvent: vi.fn() }));
const getProjectForm = vi.hoisted(() => vi.fn());
const submitProjectForm = vi.hoisted(() => vi.fn());
vi.mock("@/features/forms", async () => ({
  getProjectForm,
  submitProjectForm,
  ConnectedForm: (await import("@/features/forms/connected-form.client")).ConnectedForm,
}));
const logError = vi.hoisted(() => vi.fn());
vi.mock("@/server/logger", () => ({ logger: { error: logError } }));

const { ProjectEnquirySlot } = await import("../enquiry-slot");

const words = en.projects.page.lead;
const links = { signInHref: "/auth?gate=enquire&redirect=%2Fp", createAccountHref: "/auth" };

async function show() {
  const element = await ProjectEnquirySlot({
    slug: "kadal-vista",
    developerName: "Kadal Homes",
    ...links,
  });
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      {element}
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  getProjectForm.mockResolvedValue(null);
});

const ASSIGNED = {
  slug: "vista-visit",
  name: "Vista visit",
  kind: "site_visit",
  placement: "project_specific",
  projectId: null,
  buttonText: "Book a visit",
  successMessage: "See you soon",
  fields: [
    { label: "Your name", key: "name", type: "text", required: true },
    { label: "Mobile", key: "mobile", type: "text", required: true },
    { label: "Preferred day", key: "visit_date", type: "date", required: false },
  ],
};

describe("ProjectEnquirySlot: gate or form, by who is looking (S4-T09 D1b)", () => {
  it("shows the gate to a visitor with no verified phone, without logging an error", async () => {
    verifiedPhoneDigits.mockRejectedValue(
      new ActionError("FORBIDDEN", "no phone", { reason: "PHONE_NOT_VERIFIED" }),
    );
    await show();
    expect(screen.getByText(words.gate.leadIn)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: words.gate.signIn })).toHaveAttribute(
      "href",
      links.signInHref,
    );
    expect(logError).not.toHaveBeenCalled();
  });

  it("shows the gate, and logs, when the sign-in cannot be read for another reason", async () => {
    verifiedPhoneDigits.mockRejectedValue(new Error("boom"));
    await show();
    expect(screen.getByText(words.gate.leadIn)).toBeInTheDocument();
    expect(logError).toHaveBeenCalled();
  });

  it("shows the form with the account's phone masked and locked for a visitor with a verified phone", async () => {
    verifiedPhoneDigits.mockResolvedValue("919840012345");
    await show();
    const phone = screen.getByLabelText(new RegExp(`^${words.phone}`));
    expect(phone).toHaveValue("+91 98••• ••345");
    expect(phone).toHaveAttribute("readonly");
    expect(screen.queryByText(words.gate.leadIn)).toBeNull();
    expect(screen.getByRole("button", { name: words.send })).toBeInTheDocument();
  });

  it("does not read the project's form for a visitor who sees the gate", async () => {
    verifiedPhoneDigits.mockRejectedValue(
      new ActionError("FORBIDDEN", "no phone", { reason: "PHONE_NOT_VERIFIED" }),
    );
    getProjectForm.mockResolvedValue(ASSIGNED);
    await show();
    expect(getProjectForm).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Book a visit" })).toBeNull();
  });

  it("shows the project's assigned form in the same card, with the account's phone masked and locked", async () => {
    verifiedPhoneDigits.mockResolvedValue("919840012345");
    getProjectForm.mockResolvedValue(ASSIGNED);
    await show();
    expect(getProjectForm).toHaveBeenCalledWith("kadal-vista");
    expect(screen.getByRole("heading", { name: words.title })).toBeInTheDocument();
    const phone = screen.getByLabelText(/Mobile/);
    expect(phone).toHaveValue("+91 98••• ••345");
    expect(phone).toHaveAttribute("readonly");
    expect(phone).toHaveAccessibleDescription(words.phoneHint);
    expect(screen.getByRole("button", { name: "Book a visit" })).toBeInTheDocument();
    // The built-in card's own controls are not drawn.
    expect(screen.queryByRole("radio", { name: words.siteVisit })).toBeNull();
    expect(screen.getByText(/Kadal Homes and Find Prop/)).toBeInTheDocument();
  });

  it("falls back to the built-in card when the project shows no form (the form read is null)", async () => {
    verifiedPhoneDigits.mockResolvedValue("919840012345");
    getProjectForm.mockResolvedValue(null);
    await show();
    expect(screen.getByRole("button", { name: words.send })).toBeInTheDocument();
    expect(screen.getByLabelText(new RegExp(`^${words.phone}`))).toHaveValue("+91 98••• ••345");
  });
});

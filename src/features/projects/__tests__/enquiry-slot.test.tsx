// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/i18n/messages/en.json";
import { ActionError } from "@/server/actions/normalise-error";

const verifiedPhoneDigits = vi.hoisted(() => vi.fn());
vi.mock("../service", () => ({ verifiedPhoneDigits }));
vi.mock("../actions", () => ({ submitProjectLead: vi.fn(), trackProjectEvent: vi.fn() }));
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

beforeEach(() => vi.clearAllMocks());

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
});

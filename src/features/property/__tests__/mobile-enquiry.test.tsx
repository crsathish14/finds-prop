// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/i18n/messages/en.json";
import { resetDraftsForTests, saveDraft } from "@/lib/form-draft";
import { renderWithMessages } from "../../../../tests/render-intl";
import { MobileEnquiry } from "../mobile-enquiry.client";

vi.mock("@/lib/notify", () => ({ notify: { info: vi.fn() } }));

const card = en.domain.enquiry;

function show() {
  renderWithMessages(
    <MobileEnquiry
      signedIn
      signInHref="/auth?gate=enquire"
      createAccountHref="/auth"
      connection={{
        shortId: "k3x9a2bd",
        send: vi.fn(async () => ({ ok: true as const, data: { received: true as const } })),
        prefill: { phone: "919840012345" },
        enquiriesHref: "/dashboard?tab=sent",
      }}
      rupees={7_500_000}
      listingType="sale"
    />,
  );
}

beforeEach(() => {
  window.sessionStorage.clear();
  resetDraftsForTests();
});

describe("MobileEnquiry: coming back from signing in again (S5-T07)", () => {
  it("keeps the sheet closed when nothing was kept", () => {
    show();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens the sheet with the kept answers already in it", async () => {
    saveDraft("enquiry", window.location.pathname, {
      name: "Priya Raman",
      message: "Is it still free?",
    });
    show();
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    expect(screen.getByRole("textbox", { name: /Your name/ })).toHaveValue("Priya Raman");
    expect(screen.getByLabelText(/Message/)).toHaveValue("Is it still free?");
    expect(screen.getByLabelText(/Phone/)).toHaveValue("919840012345");
    expect(screen.getByRole("button", { name: card.form.send })).toBeInTheDocument();
  });
});

// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import type { ActionResult } from "@/types/action";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/notify", () => ({ notify: toast }));

const { PostingGate } = await import("../posting-gate.client");
const { YourDrafts } = await import("../drafts.client");

type Send = React.ComponentProps<typeof PostingGate>["send"];

const sent = (email: string): ActionResult<{ email: string; resendAfter: number }> => ({
  ok: true,
  data: { email, resendAfter: 60 },
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PostingGate: verify your email to post a property (S6-T02, ADD-03)", () => {
  function open(overrides: { send?: Send; resend?: Send; pendingEmail?: string | null } = {}) {
    const send = overrides.send ?? (vi.fn(async ({ email }) => sent(email)) as unknown as Send);
    const resend = overrides.resend ?? (vi.fn(async ({ email }) => sent(email)) as unknown as Send);
    renderWithMessages(
      <PostingGate
        pendingEmail={overrides.pendingEmail ?? null}
        send={send}
        resend={resend}
        browseHref="/"
      />,
    );
    return { send, resend };
  }

  it("asks for the address, with the reassurance and a way out", () => {
    open();
    expect(
      screen.getByRole("heading", { level: 1, name: "Verify your email to post a property" }),
    ).toBeVisible();
    expect(screen.getByLabelText("Email address")).toBeVisible();
    expect(
      screen.getByText(
        "Nothing you've entered is lost. You'll come back to this step of your listing.",
      ),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Not now, back to browsing" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("checks the shape first, then sends the link and shows Check your email as a status", async () => {
    const { send } = open();
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "nope" } });
    fireEvent.click(screen.getByRole("button", { name: "Send verification link" }));
    expect(
      await screen.findByText("Enter a valid email address, like name@example.com."),
    ).toBeVisible();
    expect(send).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "priya@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send verification link" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Check your email");
    expect(send).toHaveBeenCalledWith({ email: "priya@example.com" });
    expect(screen.getByText(/We sent a link to priya@example.com/)).toBeVisible();
    expect(
      screen.getByText("This page updates by itself once the email is verified."),
    ).toBeVisible();
    expect(screen.getByText(/Send again in/)).toBeVisible();
  });

  it("starts on Check your email when a link was already sent, and asks the server again on return", async () => {
    open({ pendingEmail: "priya@example.com" });
    expect(screen.getByRole("status")).toHaveTextContent("Check your email");
    window.dispatchEvent(new Event("focus"));
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
  });

  it("does not say why an address cannot be used, only that it could not", async () => {
    open({
      send: vi.fn(async () => ({
        ok: false,
        code: "VALIDATION",
        fieldErrors: { email: [{ key: "validation.emailTaken" }] },
      })) as unknown as Send,
    });
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "taken@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send verification link" }));
    expect(
      await screen.findByText("We couldn't use that email. Try a different address."),
    ).toBeVisible();
  });

  it("shows a general failure in words and keeps the form", async () => {
    open({
      send: vi.fn(async () => ({
        ok: false,
        code: "RATE_LIMITED",
        retryAfter: 600,
      })) as unknown as Send,
    });
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "priya@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send verification link" }));
    expect(await screen.findByRole("alert")).toBeVisible();
    expect(screen.getByLabelText("Email address")).toHaveValue("priya@example.com");
  });
});

describe("YourDrafts: the listings someone has started (S6-T02, FR-ACC-08)", () => {
  const drafts = [
    {
      id: "00000000-0000-4000-9000-000000000001",
      title: "3 BHK apartment",
      place: "Velachery",
      kind: "sale" as const,
      propertyType: "apartment" as const,
      saved: "7 Nov 2026",
    },
    {
      id: "00000000-0000-4000-9000-000000000002",
      title: null,
      place: null,
      kind: null,
      propertyType: null,
      saved: "5 Nov 2026",
    },
  ];

  function open(remove = vi.fn(async () => ({ ok: true as const, data: { listingId: "x" } }))) {
    renderWithMessages(<YourDrafts drafts={drafts} remove={remove} />);
    return remove;
  }

  it("lists each draft with its place and date, and the one with no title as untitled", () => {
    open();
    expect(screen.getByRole("heading", { name: "Your drafts" })).toBeVisible();
    expect(screen.getByText("For sale · Apartment · Velachery")).toBeVisible();
    expect(screen.getByText("Saved 7 Nov 2026")).toBeVisible();
    expect(screen.getAllByText(/Untitled draft/).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Continue Untitled draft" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Continue 3 BHK apartment" })).toHaveAttribute(
      "href",
      "/post-property/00000000-0000-4000-9000-000000000001",
    );
  });

  it("shows nothing when there are no drafts", () => {
    const { container } = renderWithMessages(<YourDrafts drafts={[]} remove={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("asks before deleting, says the photos go too, and only then deletes and refreshes", async () => {
    const remove = open();
    fireEvent.click(screen.getByRole("button", { name: "Delete 3 BHK apartment" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Delete this draft?")).toBeVisible();
    expect(
      within(dialog).getByText("Its photos are deleted too. This can't be undone."),
    ).toBeVisible();
    expect(remove).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete draft" }));
    await waitFor(() =>
      expect(remove).toHaveBeenCalledWith({ listingId: "00000000-0000-4000-9000-000000000001" }),
    );
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith("Draft deleted");
  });

  it("keeps the draft when Keep it is chosen, and says so when the delete fails", async () => {
    const remove = open();
    fireEvent.click(screen.getByRole("button", { name: "Delete 3 BHK apartment" }));
    fireEvent.click(await screen.findByRole("button", { name: "Keep it" }));
    expect(remove).not.toHaveBeenCalled();

    const failing = vi.fn(async () => ({ ok: false as const, code: "INTERNAL" as const }));
    renderWithMessages(<YourDrafts drafts={drafts.slice(0, 1)} remove={failing} />);
    const [secondView] = screen
      .getAllByRole("button", { name: "Delete 3 BHK apartment" })
      .slice(-1);
    if (!secondView) throw new Error("the second list has no Delete button");
    fireEvent.click(secondView);
    fireEvent.click(await screen.findByRole("button", { name: "Delete draft" }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("We couldn't delete the draft. Please try again."),
    );
  });
});

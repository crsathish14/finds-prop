// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import en from "@/i18n/messages/en.json";
import type { ActionResult } from "@/types/action";
import type { ReceivedActions } from "../received.client";
import type { EnquiryStatus, ReceivedEnquiry } from "../view";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/notify", () => ({ notify: toast }));

const { ReceivedBoard } = await import("../received.client");

const words = en.account.dashboard.received;
const NOW = Date.parse("2026-11-08T10:00:00Z");

const enquiry = (id: string, extra: Partial<ReceivedEnquiry> = {}): ReceivedEnquiry => ({
  id,
  receivedAt: "2026-11-08T08:00:00Z",
  status: "new",
  name: `Sender ${id}`,
  phone: "9841055512",
  email: "sender@example.test",
  message: "Is it still available?",
  home: { title: "Flat in Adyar", href: "/properties/flat-in-adyar-abcd2345" },
  ...extra,
});

const moved = (
  status: EnquiryStatus,
): ActionResult<{ enquiryId: string; status: EnquiryStatus }> => ({
  ok: true,
  data: { enquiryId: "a", status },
});

function open(
  options: { enquiries?: ReceivedEnquiry[]; setStatus?: ReceivedActions["setStatus"] } = {},
) {
  const setStatus = options.setStatus ?? vi.fn(async (input) => moved(input.status));
  renderWithMessages(
    <ReceivedBoard
      enquiries={options.enquiries ?? [enquiry("a")]}
      now={NOW}
      empty={<p>nothing here</p>}
      actions={{ setStatus }}
    />,
  );
  return { setStatus };
}

const button = (label: string, name: string) =>
  screen.getByRole("button", { name: `${label} ${name}` });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ReceivedBoard: what the owner sees (S6-T03)", () => {
  it("shows who asked, the phone and email as links, the home as a link, how long ago, the state and the words", () => {
    open();
    const row = within(screen.getByRole("list", { name: words.listLabel })).getByRole("listitem");
    expect(within(row).getByText("Sender a", { selector: "b" })).toBeVisible();
    expect(within(row).getByRole("link", { name: "9841055512" })).toHaveAttribute(
      "href",
      "tel:9841055512",
    );
    expect(within(row).getByRole("link", { name: "sender@example.test" })).toHaveAttribute(
      "href",
      "mailto:sender@example.test",
    );
    expect(within(row).getByRole("link", { name: "Flat in Adyar" })).toHaveAttribute(
      "href",
      "/properties/flat-in-adyar-abcd2345",
    );
    expect(within(row).getByText(/2 hours ago/)).toBeVisible();
    expect(within(row).getByText(en.status.enquiry.new)).toBeVisible();
    expect(within(row).getByText("Is it still available?")).toBeVisible();
  });

  it("names a home that is not open to the public as plain text, and one that is gone in words", () => {
    open({
      enquiries: [
        enquiry("a", { home: { title: "Flat in Adyar", href: null } }),
        enquiry("b", { home: null }),
      ],
    });
    expect(screen.queryByRole("link", { name: "Flat in Adyar" })).toBeNull();
    expect(screen.getByText("Flat in Adyar", { selector: "span" })).toBeVisible();
    expect(screen.getByText(words.homeGone)).toBeVisible();
  });

  it("has no email link without an email", () => {
    open({ enquiries: [enquiry("a", { email: null })] });
    expect(screen.queryByRole("link", { name: /@/ })).toBeNull();
  });

  it("draws the buttons of each state: New both, Contacted Close only, Closed none", () => {
    open({
      enquiries: [
        enquiry("a"),
        enquiry("b", { status: "contacted" }),
        enquiry("c", { status: "closed" }),
      ],
    });
    expect(button(words.contacted, "Sender a")).toBeVisible();
    expect(button(words.closed, "Sender a")).toBeVisible();
    expect(screen.queryByRole("button", { name: `${words.contacted} Sender b` })).toBeNull();
    expect(button(words.closed, "Sender b")).toBeVisible();
    expect(screen.queryByRole("button", { name: new RegExp("Sender c") })).toBeNull();
  });

  it("shows the empty state the page gave when there are none", () => {
    open({ enquiries: [] });
    expect(screen.getByText("nothing here")).toBeVisible();
  });
});

describe("ReceivedBoard: moving an enquiry on (S6-T03)", () => {
  it("marks it contacted at once, says so in a toast and reads the page again", async () => {
    const { setStatus } = open();
    fireEvent.click(button(words.contacted, "Sender a"));
    await waitFor(() =>
      expect(setStatus).toHaveBeenCalledWith({ enquiryId: "a", status: "contacted" }),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(words.toastContacted));
    expect(router.refresh).toHaveBeenCalledTimes(1);
    const row = screen.getByRole("listitem");
    expect(within(row).getByText(en.status.enquiry.contacted)).toBeVisible();
    expect(within(row).queryByRole("button", { name: `${words.contacted} Sender a` })).toBeNull();
    expect(within(row).getByRole("button", { name: `${words.closed} Sender a` })).toBeVisible();
  });

  it("closes it, and then it has no buttons", async () => {
    const { setStatus } = open();
    fireEvent.click(button(words.closed, "Sender a"));
    await waitFor(() =>
      expect(setStatus).toHaveBeenCalledWith({ enquiryId: "a", status: "closed" }),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(words.toastClosed));
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("says nothing was changed, with Try again, when the call fails; Try again asks again", async () => {
    const setStatus = vi
      .fn<ReceivedActions["setStatus"]>()
      .mockResolvedValueOnce({ ok: false, code: "UPSTREAM_FAILED" })
      .mockResolvedValueOnce(moved("contacted"));
    open({ setStatus });
    fireEvent.click(button(words.contacted, "Sender a"));
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(words.failedTitle)).toBeVisible();
    expect(screen.getByText(en.status.enquiry.new)).toBeVisible();
    fireEvent.click(within(alert).getByRole("button", { name: words.retry }));
    await waitFor(() => expect(setStatus).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(toast.success).toHaveBeenCalledTimes(1);
  });

  it("tells the owner it already moved, and reads the page again, on a conflict", async () => {
    const setStatus = vi.fn(async () => ({ ok: false as const, code: "CONFLICT" as const }));
    open({ setStatus });
    fireEvent.click(button(words.closed, "Sender a"));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(words.changed));
    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

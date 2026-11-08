// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import en from "@/i18n/messages/en.json";
import type { ActionResult } from "@/types/action";
import type { MyListingsActions } from "../my-listings.client";
import type { MyListing } from "../view";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/notify", () => ({ notify: toast }));

const { MyListingsBoard } = await import("../my-listings.client");

const words = en.account.dashboard.listings;
const NOW = Date.parse("2026-11-08T10:00:00+05:30");
const ID_LIVE = "00000000-0000-4000-9000-000000000001";
const ID_RENT = "00000000-0000-4000-9000-000000000002";
const ID_WAIT = "00000000-0000-4000-9000-000000000003";
const ID_NO = "00000000-0000-4000-9000-000000000004";
const ID_SOLD = "00000000-0000-4000-9000-000000000005";

const listing = (id: string, extra: Partial<MyListing> = {}): MyListing => ({
  id,
  shortId: `abcd234${id.slice(-1)}`,
  slug: "flat-in-adyar",
  status: "approved",
  listingType: "sale",
  propertyType: "apartment",
  title: `Flat number ${id.slice(-1)}`,
  price: 12_500_000,
  locality: "Adyar",
  rejectionReason: null,
  createdAt: "2026-11-06T10:00:00+05:30",
  coverUrl: null,
  ...extra,
});

const ok = (): ActionResult<{ listingId: string }> => ({ ok: true, data: { listingId: ID_LIVE } });
const closed = (): ActionResult<{ listingId: string; shortId: string; status: string }> => ({
  ok: true,
  data: { listingId: ID_LIVE, shortId: "abcd2341", status: "sold" },
});

function open(
  options: {
    listings?: MyListing[];
    close?: MyListingsActions["close"];
    remove?: MyListingsActions["remove"];
  } = {},
) {
  const close = options.close ?? vi.fn(async () => closed());
  const remove = options.remove ?? vi.fn(async () => ok());
  renderWithMessages(
    <MyListingsBoard
      listings={options.listings ?? [listing(ID_LIVE), listing(ID_RENT, { listingType: "rent" })]}
      now={NOW}
      empty={<p>nothing here</p>}
      actions={{ close, remove }}
    />,
  );
  return { close, remove };
}

/** The item at an index, or a failure that says so (the lint rules do not allow `!`). */
const at = (items: HTMLElement[], index: number): HTMLElement => {
  const found = items[index];
  if (!found) throw new Error(`no item at ${index}`);
  return found;
};

const button = (label: string, title: string) =>
  screen.getByRole("button", { name: `${label} ${title}` });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MyListingsBoard: what the owner sees and can do (S6-T03)", () => {
  it("lists each listing with its price, place, posted time, kind and state", () => {
    open();
    const list = screen.getByRole("list", { name: words.listLabel });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(within(at(rows, 0)).getByText("₹1.25 Cr")).toBeVisible();
    expect(within(at(rows, 0)).getByText("Adyar")).toBeVisible();
    expect(within(at(rows, 0)).getByText("Posted 2 days ago")).toBeVisible();
    expect(within(at(rows, 0)).getByText(words.sale)).toBeVisible();
    expect(within(at(rows, 0)).getByText(en.status.listing.live)).toBeVisible();
    expect(within(at(rows, 1)).getByText("₹1.25 Cr/mo")).toBeVisible();
    expect(within(at(rows, 1)).getByText(words.rent)).toBeVisible();
    expect(screen.getByText(words.footnote)).toBeVisible();
  });

  it("says posted today for a listing posted within the day, and Not provided with no price", () => {
    open({
      listings: [listing(ID_LIVE, { createdAt: "2026-11-08T08:00:00+05:30", price: null })],
    });
    expect(screen.getByText(words.postedToday)).toBeVisible();
    expect(screen.getByText(words.notProvided)).toBeVisible();
  });

  it("links the title only while Live, and gives Live the close button and Delete", () => {
    open({
      listings: [
        listing(ID_LIVE),
        listing(ID_WAIT, { status: "pending" }),
        listing(ID_SOLD, { status: "sold" }),
      ],
    });
    expect(screen.getByRole("link", { name: "Flat number 1" })).toHaveAttribute(
      "href",
      "/properties/flat-in-adyar-abcd2341",
    );
    expect(screen.queryByRole("link", { name: "Flat number 3" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Flat number 5" })).toBeNull();
    expect(button(words.sold, "Flat number 1")).toBeVisible();
    expect(button(words.delete, "Flat number 1")).toBeVisible();
    expect(screen.queryByRole("button", { name: `${words.sold} Flat number 3` })).toBeNull();
    expect(button(words.delete, "Flat number 3")).toBeVisible();
    expect(screen.queryByRole("button", { name: `${words.sold} Flat number 5` })).toBeNull();
    expect(button(words.delete, "Flat number 5")).toBeVisible();
  });

  it("offers Mark as rented, not Mark as sold, on a rental", () => {
    open({ listings: [listing(ID_RENT, { listingType: "rent" })] });
    expect(button(words.rented, "Flat number 2")).toBeVisible();
    expect(screen.queryByRole("button", { name: `${words.sold} Flat number 2` })).toBeNull();
  });

  it("shows the waiting note for a listing in review and the admin's reason for one not approved", () => {
    open({
      listings: [
        listing(ID_WAIT, { status: "pending" }),
        listing(ID_NO, { status: "rejected", rejectionReason: "Add a photo of the home." }),
      ],
    });
    expect(screen.getByText(words.waiting)).toBeVisible();
    expect(screen.getByText("Reason: Add a photo of the home.")).toBeVisible();
    expect(screen.getByText(en.status.listing.notApproved)).toBeVisible();
  });

  it("shows the empty state the page gave when there are no listings", () => {
    open({ listings: [] });
    expect(screen.getByText("nothing here")).toBeVisible();
  });
});

describe("MyListingsBoard: marking sold or rented (S6-T03)", () => {
  it("asks first, and leaves everything alone when the owner keeps the listing live", () => {
    const { close } = open();
    fireEvent.click(button(words.sold, "Flat number 1"));
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText(words.confirmSoldTitle)).toBeVisible();
    expect(
      within(dialog).getByText(
        '"Flat number 1" will be removed from search results. You can\'t undo this.',
      ),
    ).toBeVisible();
    fireEvent.click(within(dialog).getByRole("button", { name: words.keepLive }));
    expect(close).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("closes the listing as sold when confirmed, says so in a toast, shows Sold and reads the page again", async () => {
    const { close } = open();
    fireEvent.click(button(words.sold, "Flat number 1"));
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: words.sold }),
    );
    await waitFor(() =>
      expect(close).toHaveBeenCalledWith({ listingId: ID_LIVE, outcome: "sold" }),
    );
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(words.toastSoldTitle, {
        description: words.toastClosedText,
      }),
    );
    expect(router.refresh).toHaveBeenCalledTimes(1);
    const row = at(screen.getAllByRole("listitem"), 0);
    expect(within(row).getByText(en.status.listing.sold)).toBeVisible();
    expect(within(row).queryByRole("button", { name: new RegExp(words.sold) })).toBeNull();
    expect(screen.queryByRole("link", { name: "Flat number 1" })).toBeNull();
  });

  it("closes a rental as rented", async () => {
    const { close } = open();
    fireEvent.click(button(words.rented, "Flat number 2"));
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: words.rented }),
    );
    await waitFor(() =>
      expect(close).toHaveBeenCalledWith({ listingId: ID_RENT, outcome: "rented" }),
    );
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(words.toastRentedTitle, {
        description: words.toastClosedText,
      }),
    );
  });

  it("says nothing was changed, with Try again, when the call fails; Try again asks again without a new question", async () => {
    const close = vi
      .fn<MyListingsActions["close"]>()
      .mockResolvedValueOnce({ ok: false, code: "UPSTREAM_FAILED" })
      .mockResolvedValueOnce(closed());
    open({ close });
    fireEvent.click(button(words.sold, "Flat number 1"));
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: words.sold }),
    );
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(words.failedTitle)).toBeVisible();
    expect(within(alert).getByText(words.failedText)).toBeVisible();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(router.refresh).not.toHaveBeenCalled();
    fireEvent.click(within(alert).getByRole("button", { name: words.retry }));
    await waitFor(() => expect(close).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(toast.success).toHaveBeenCalledTimes(1);
  });

  it("tells the owner the listing changed, and reads the page again, when it was already closed or gone", async () => {
    const close = vi.fn(async () => ({ ok: false as const, code: "CONFLICT" as const }));
    open({ close });
    fireEvent.click(button(words.sold, "Flat number 1"));
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: words.sold }),
    );
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(words.changed));
    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("MyListingsBoard: deleting (S6-T03)", () => {
  it("asks first, naming the listing and what goes with it", () => {
    const { remove } = open();
    fireEvent.click(button(words.delete, "Flat number 1"));
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText(words.confirmDeleteTitle)).toBeVisible();
    expect(within(dialog).getByText(/Flat number 1.*permanently deleted/)).toBeVisible();
    fireEvent.click(within(dialog).getByRole("button", { name: words.cancel }));
    expect(remove).not.toHaveBeenCalled();
  });

  it("deletes when confirmed: the row goes, a toast says so, and the page is read again", async () => {
    const { remove } = open();
    fireEvent.click(button(words.delete, "Flat number 1"));
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: words.confirmDelete }),
    );
    await waitFor(() => expect(remove).toHaveBeenCalledWith({ listingId: ID_LIVE }));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(words.toastDeletedTitle, {
        description: words.toastDeletedText,
      }),
    );
    expect(screen.queryByText("Flat number 1", { selector: "p" })).toBeNull();
    expect(screen.queryByText("Flat number 1", { selector: "a" })).toBeNull();
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("shows the empty state once the last listing is deleted", async () => {
    open({ listings: [listing(ID_LIVE)] });
    fireEvent.click(button(words.delete, "Flat number 1"));
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: words.confirmDelete }),
    );
    expect(await screen.findByText("nothing here")).toBeVisible();
  });

  it("keeps the row and says nothing was changed when the delete fails", async () => {
    const remove = vi.fn(async () => ({ ok: false as const, code: "INTERNAL" as const }));
    open({ remove });
    fireEvent.click(button(words.delete, "Flat number 1"));
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: words.confirmDelete }),
    );
    expect(await screen.findByRole("alert")).toBeVisible();
    expect(screen.getByRole("button", { name: `${words.delete} Flat number 1` })).toBeVisible();
    expect(toast.success).not.toHaveBeenCalled();
  });
});

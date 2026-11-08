// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import type { ActionResult } from "@/types/action";
import en from "@/i18n/messages/en.json";
import type { ListingsBoardActions } from "../listings-board.client";
import type { QueueFilters } from "../schemas";
import { encodeCursor } from "../cursor";
import type { QueueCounts, QueueItem } from "../view";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/notify", () => ({ notify: toast }));

const { ListingsBoard } = await import("../listings-board.client");

const words = en.admin.listings;
const ID_1 = "00000000-0000-4000-9000-000000000001";
const ID_2 = "00000000-0000-4000-9000-000000000002";
const ID_3 = "00000000-0000-4000-9000-000000000003";

const item = (id: string, extra: Partial<QueueItem> = {}): QueueItem => ({
  id,
  shortId: `short${id.slice(-1)}`,
  status: "pending",
  featured: false,
  listingType: "sale",
  propertyType: "villa",
  title: `Villa number ${id.slice(-1)}`,
  description: "A bright villa.",
  bhk: 4,
  bathrooms: 3,
  areaSqft: 3200,
  price: 28_500_000,
  furnishing: "semi",
  amenities: [],
  address: "14 Second Cross Street",
  locality: "Sholinganallur",
  city: "Chennai",
  pincode: "600119",
  rejectionReason: null,
  submittedAt: "2026-11-07T04:42:00+00:00",
  ownerName: "Priya Raman",
  ownerEmail: `owner${id.slice(-1)}@example.test`,
  photos: [
    {
      id: "p1",
      url: "http://127.0.0.1:54321/storage/v1/object/public/listing-photos/a.jpg",
      position: 0,
    },
  ],
  ...extra,
});

/** The title of a row as shown in the list (the buttons repeat it as hidden text for screen readers). */
const titleCells = (number: number) =>
  screen.queryAllByText(`Villa number ${number}`, { selector: "p" });

const COUNTS: QueueCounts = { pending: 14, approved: 196, rejected: 9, closed: 29, total: 248 };

const decided = (
  status: string,
  featured = false,
): ActionResult<{ listingId: string; shortId: string; status: string; featured: boolean }> => ({
  ok: true,
  data: { listingId: ID_1, shortId: "short1", status, featured },
});

function open(
  options: {
    filters?: QueueFilters;
    items?: QueueItem[];
    nextCursor?: string | null;
    moderate?: ListingsBoardActions["moderate"];
    loadMore?: ListingsBoardActions["loadMore"];
    localities?: string[];
  } = {},
) {
  const moderate = options.moderate ?? vi.fn(async () => decided("approved"));
  const loadMore =
    options.loadMore ??
    vi.fn(async () => ({ ok: true as const, data: { items: [], nextCursor: null, skipped: 0 } }));
  renderWithMessages(
    <ListingsBoard
      filters={options.filters ?? { tab: "pending" }}
      items={options.items ?? [item(ID_1), item(ID_2)]}
      nextCursor={options.nextCursor ?? null}
      counts={COUNTS}
      localities={options.localities ?? ["Adyar", "Velachery"]}
      actions={{ moderate: moderate as ListingsBoardActions["moderate"], loadMore }}
    />,
  );
  return { moderate, loadMore };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ListingsBoard: the queue, its tabs and filters (S6-T04)", () => {
  it("shows a row for each listing, with its words, and the tabs with their counts", () => {
    open();
    expect(screen.getByRole("tab", { name: /Pending/ })).toHaveTextContent("14");
    expect(screen.getByRole("tab", { name: /Sold or rented/ })).toHaveTextContent("29");
    const table = screen.getByRole("table", { name: words.table.caption });
    expect(titleCells(1)).toHaveLength(1);
    expect(within(table).getByText("owner2@example.test")).toBeVisible();
    expect(within(table).getAllByText("₹2.85 Cr")).toHaveLength(2);
    expect(within(table).getAllByText("Sholinganallur · Villa · For sale")).toHaveLength(2);
    expect(within(table).getAllByText("Pending review")).toHaveLength(2);
  });

  it("takes the tab to the address, leaving the default out", () => {
    open();
    fireEvent.mouseDown(screen.getByRole("tab", { name: /Approved/ }), { button: 0 });
    fireEvent.click(screen.getByRole("tab", { name: /Approved/ }));
    expect(router.push).toHaveBeenCalledWith("/admin/listings?tab=approved");
  });

  it("takes the filters to the address and keeps the tab", () => {
    open({ filters: { tab: "all" } });
    fireEvent.change(screen.getByLabelText(words.filters.localityLabel), {
      target: { value: "Adyar" },
    });
    expect(router.push).toHaveBeenLastCalledWith("/admin/listings?tab=all&locality=Adyar");
    fireEvent.change(screen.getByLabelText(words.filters.kindLabel), { target: { value: "rent" } });
    expect(router.push).toHaveBeenLastCalledWith("/admin/listings?tab=all&kind=rent");
  });

  it("shows the empty words of the tab, and other words when filters are on", () => {
    open({ items: [] });
    expect(screen.getByRole("heading", { name: words.empty.pending.title })).toBeVisible();
  });

  it("says no listing matches when filters are on", () => {
    open({ items: [], filters: { tab: "pending", locality: "Adyar" } });
    expect(screen.getByRole("heading", { name: words.empty.filtered.title })).toBeVisible();
  });

  it("shows the reason of a rejected listing under its title", () => {
    open({
      filters: { tab: "rejected" },
      items: [item(ID_1, { status: "rejected", rejectionReason: "Add a photo of the home." })],
    });
    expect(screen.getByText("Reason: Add a photo of the home.")).toBeVisible();
  });
});

describe("ListingsBoard: decisions (S6-T04)", () => {
  it("approves from the row: calls the action with the listing, says so, reads the page again and takes the row off the pending tab", async () => {
    const { moderate } = open();
    fireEvent.click(screen.getByRole("button", { name: "Approve Villa number 1" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(moderate).toHaveBeenCalledWith({ decision: "approve", listingId: ID_1 });
    expect(toast.success).toHaveBeenCalledWith(words.toast.approved.title, {
      description: words.toast.approved.text,
    });
    expect(router.refresh).toHaveBeenCalled();
    expect(titleCells(1)).toHaveLength(0);
    expect(titleCells(2)).toHaveLength(1);
  });

  it("keeps an approved row on the All tab, now live", async () => {
    open({ filters: { tab: "all" } });
    fireEvent.click(screen.getByRole("button", { name: "Approve Villa number 1" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(titleCells(1)).toHaveLength(1);
    expect(screen.getAllByText("Live")).toHaveLength(1);
    // It can now be featured, and cannot be approved again.
    expect(screen.getByRole("button", { name: "Feature Villa number 1" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Approve Villa number 1" })).toBeNull();
  });

  it("features an approved listing and then offers to remove the feature", async () => {
    const moderate = vi.fn(async () => decided("approved", true));
    open({
      filters: { tab: "approved" },
      items: [item(ID_1, { status: "approved" })],
      moderate,
    });
    fireEvent.click(screen.getByRole("button", { name: "Feature Villa number 1" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(moderate).toHaveBeenCalledWith({ decision: "feature", listingId: ID_1 });
    expect(screen.getByText(words.featured)).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Remove from featured Villa number 1" }),
    ).toBeVisible();
  });

  it("says another admin decided first, and reads the page again", async () => {
    const moderate = vi.fn(async () => ({ ok: false as const, code: "CONFLICT" as const }));
    open({ moderate });
    fireEvent.click(screen.getByRole("button", { name: "Approve Villa number 1" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(words.conflict));
    expect(router.refresh).toHaveBeenCalled();
    expect(titleCells(1)).toHaveLength(1);
  });

  it("says how long to wait when the limit is reached", async () => {
    const moderate = vi.fn(async () => ({
      ok: false as const,
      code: "RATE_LIMITED" as const,
      retryAfter: 1200,
    }));
    open({ moderate });
    fireEvent.click(screen.getByRole("button", { name: "Approve Villa number 1" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.error.mock.calls[0]?.[0]).toMatch(/20 minutes/);
  });

  it("holds the row's button while the decision is being made", async () => {
    let finish: (
      value: ActionResult<{
        listingId: string;
        shortId: string;
        status: string;
        featured: boolean;
      }>,
    ) => void = () => undefined;
    const moderate = vi.fn(
      () =>
        new Promise<
          ActionResult<{ listingId: string; shortId: string; status: string; featured: boolean }>
        >((resolve) => {
          finish = resolve;
        }),
    );
    open({ moderate });
    fireEvent.click(screen.getByRole("button", { name: "Approve Villa number 1" }));
    expect(screen.getByRole("button", { name: "Approve Villa number 1" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    finish(decided("approved"));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });
});

describe("ListingsBoard: rejecting asks why in the same dialog (S6-T04)", () => {
  const startReject = () => {
    fireEvent.click(screen.getByRole("button", { name: "Reject Villa number 1" }));
    return screen.getByRole("alertdialog", { name: words.reject.title });
  };

  it("opens the dialog without deciding anything", () => {
    const { moderate } = open();
    const dialog = startReject();
    expect(within(dialog).getByRole("textbox", { name: /Reason for the owner/ })).toHaveFocus();
    expect(dialog).toHaveAccessibleDescription(expect.stringContaining("Villa number 1"));
    expect(moderate).not.toHaveBeenCalled();
  });

  it("asks for a reason when there is none, and does not call the action", () => {
    const { moderate } = open();
    const dialog = startReject();
    fireEvent.click(within(dialog).getByRole("button", { name: words.reject.confirm }));
    expect(within(dialog).getByText(words.reject.required)).toBeVisible();
    expect(moderate).not.toHaveBeenCalled();
  });

  it("refuses a reason that is too long before calling the action", () => {
    const { moderate } = open();
    const dialog = startReject();
    fireEvent.change(within(dialog).getByRole("textbox", { name: /Reason for the owner/ }), {
      target: { value: "a".repeat(501) },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: words.reject.confirm }));
    expect(within(dialog).getByText("Use at most 500 characters.")).toBeVisible();
    expect(moderate).not.toHaveBeenCalled();
  });

  it("rejects with the trimmed reason, then closes and takes the row off the pending tab", async () => {
    const moderate = vi.fn(async () => decided("rejected"));
    open({ moderate });
    const dialog = startReject();
    fireEvent.change(within(dialog).getByRole("textbox", { name: /Reason for the owner/ }), {
      target: { value: "  Add a photo of the home.  " },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: words.reject.confirm }));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(moderate).toHaveBeenCalledWith({
      decision: "reject",
      listingId: ID_1,
      reason: "Add a photo of the home.",
    });
    expect(toast.success).toHaveBeenCalledWith(words.toast.rejected.title, {
      description: words.toast.rejected.text,
    });
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(titleCells(1)).toHaveLength(0);
  });

  it("keeps the dialog and the typed reason when the database says the reason is missing", async () => {
    const moderate = vi.fn(async () => ({
      ok: false as const,
      code: "VALIDATION" as const,
      fieldErrors: { reason: [{ key: "validation.required" }] },
    }));
    open({ moderate });
    const dialog = startReject();
    fireEvent.change(within(dialog).getByRole("textbox", { name: /Reason for the owner/ }), {
      target: { value: "Add a photo" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: words.reject.confirm }));
    await waitFor(() => expect(within(dialog).getByText(en.validation.required)).toBeVisible());
    expect(within(dialog).getByRole("textbox", { name: /Reason for the owner/ })).toHaveValue(
      "Add a photo",
    );
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("says another admin decided first when the listing is no longer pending", async () => {
    const moderate = vi.fn(async () => ({ ok: false as const, code: "CONFLICT" as const }));
    open({ moderate });
    const dialog = startReject();
    fireEvent.change(within(dialog).getByRole("textbox", { name: /Reason for the owner/ }), {
      target: { value: "Add a photo" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: words.reject.confirm }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(words.conflict));
    expect(router.refresh).toHaveBeenCalled();
  });

  it("closes from Cancel without deciding", () => {
    const { moderate } = open();
    const dialog = startReject();
    fireEvent.click(within(dialog).getByRole("button", { name: words.reject.cancel }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(moderate).not.toHaveBeenCalled();
  });
});

describe("ListingsBoard: the review drawer (S6-T04)", () => {
  it("opens from Review with everything about the listing, and its decisions", () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: "Review Villa number 1" }));
    const drawer = screen.getByRole("dialog", { name: words.review.title });
    expect(within(drawer).getByRole("heading", { name: "Villa number 1" })).toBeVisible();
    expect(within(drawer).getByRole("heading", { name: "Photos (1)" })).toBeVisible();
    expect(within(drawer).getByText("A bright villa.")).toBeVisible();
    expect(
      within(drawer).getByText("14 Second Cross Street, Sholinganallur, Chennai, 600119"),
    ).toBeVisible();
    expect(within(drawer).getByText("owner1@example.test")).toBeVisible();
    expect(within(drawer).getByText("4 BHK")).toBeVisible();
    expect(within(drawer).getByRole("button", { name: "Approve Villa number 1" })).toBeVisible();
    expect(within(drawer).getByRole("button", { name: "Reject Villa number 1" })).toBeVisible();
  });

  it("approves from the drawer and closes it", async () => {
    const { moderate } = open();
    fireEvent.click(screen.getByRole("button", { name: "Review Villa number 1" }));
    const drawer = screen.getByRole("dialog", { name: words.review.title });
    fireEvent.click(within(drawer).getByRole("button", { name: "Approve Villa number 1" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(moderate).toHaveBeenCalledWith({ decision: "approve", listingId: ID_1 });
    expect(screen.queryByRole("dialog", { name: words.review.title })).toBeNull();
  });

  it("shows a rejected listing's reason and offers no decision", () => {
    open({
      filters: { tab: "rejected" },
      items: [item(ID_1, { status: "rejected", rejectionReason: "Add a photo of the home." })],
    });
    fireEvent.click(screen.getByRole("button", { name: "Review Villa number 1" }));
    const drawer = screen.getByRole("dialog", { name: words.review.title });
    expect(within(drawer).getByText("Add a photo of the home.")).toBeVisible();
    expect(within(drawer).queryByRole("button", { name: /Approve|Reject/ })).toBeNull();
  });

  it("says so when a listing has no photos and leaves out facts it does not have", () => {
    open({ items: [item(ID_1, { photos: [], bhk: null, bathrooms: null, furnishing: null })] });
    fireEvent.click(screen.getByRole("button", { name: "Review Villa number 1" }));
    const drawer = screen.getByRole("dialog", { name: words.review.title });
    expect(within(drawer).getByText(words.review.noPhotos)).toBeVisible();
    expect(within(drawer).queryByText(words.review.specs.bedrooms)).toBeNull();
    expect(within(drawer).getAllByText(words.notProvided).length).toBeGreaterThan(0);
  });
});

describe("ListingsBoard: Show more (S6-T04)", () => {
  const CURSOR = encodeCursor({ submittedAt: "2026-11-07T04:42:00+00:00", id: ID_2 });

  it("has no button on the last page", () => {
    open();
    expect(screen.queryByRole("button", { name: words.showMore.button })).toBeNull();
  });

  it("reads the next page with the cursor and the filters, adds its rows and drops the button on the last page", async () => {
    const loadMore = vi.fn(async () => ({
      ok: true as const,
      data: { items: [item(ID_3)], nextCursor: null, skipped: 0 },
    }));
    open({
      nextCursor: CURSOR,
      loadMore,
      filters: { tab: "pending", locality: "Adyar", kind: "sale" },
    });
    expect(screen.getByText("Showing 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: words.showMore.button }));
    await waitFor(() => expect(titleCells(3)).toHaveLength(1));
    expect(loadMore).toHaveBeenCalledWith({
      tab: "pending",
      after: CURSOR,
      locality: "Adyar",
      kind: "sale",
    });
    expect(screen.queryByRole("button", { name: words.showMore.button })).toBeNull();
  });

  it("does not show a row twice when the page overlaps", async () => {
    const loadMore = vi.fn(async () => ({
      ok: true as const,
      data: { items: [item(ID_2), item(ID_3)], nextCursor: null, skipped: 0 },
    }));
    open({ nextCursor: CURSOR, loadMore });
    fireEvent.click(screen.getByRole("button", { name: words.showMore.button }));
    await waitFor(() => expect(titleCells(3)).toHaveLength(1));
    expect(titleCells(2)).toHaveLength(1);
  });

  it("says it could not load more, and keeps the rows and the button", async () => {
    const loadMore = vi.fn(async () => ({ ok: false as const, code: "INTERNAL" as const }));
    open({ nextCursor: CURSOR, loadMore });
    fireEvent.click(screen.getByRole("button", { name: words.showMore.button }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(words.showMore.failed));
    expect(titleCells(1)).toHaveLength(1);
    expect(screen.getByRole("button", { name: words.showMore.button })).toBeVisible();
  });

  it("counts what is shown against the tab's number, and only what is shown when filters are on", () => {
    open({ nextCursor: CURSOR });
    expect(screen.getByText("Showing 2 of 14")).toBeInTheDocument();
  });
});

// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/i18n/messages/en.json";
import { renderWithMessages } from "../../../../tests/render-intl";

const read = vi.hoisted(() => ({
  signedIn: true,
  listings: [{ id: "one" }] as { id: string }[],
  unlocated: { count: 0, firstId: null, anyLive: false } as {
    count: number;
    firstId: string | null;
    anyLive: boolean;
  },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/auth/get-session-view", () => ({
  getSessionView: async () => (read.signedIn ? { userId: "user-1" } : null),
}));
vi.mock("../actions", () => ({ closeListing: vi.fn(), deleteListing: vi.fn() }));
vi.mock("../my-listings.client", () => ({
  MyListingsBoard: (props: { listings: { id: string }[] }) => (
    <p data-testid="board">{props.listings.length} listings</p>
  ),
}));
vi.mock("../queries", () => ({
  getMyListings: async () => ({ listings: read.listings, now: 0 }),
  getListingsWithoutLocation: async () => read.unlocated,
}));

const { MyListingsTab } = await import("../my-listings-tab");

const words = en.domain.locationPrompt;

async function show() {
  const tab = await MyListingsTab({ fallback: <p data-testid="empty">No listings</p> });
  renderWithMessages(<>{tab}</>);
}

beforeEach(() => {
  read.signedIn = true;
  read.listings = [{ id: "one" }];
  read.unlocated = { count: 0, firstId: null, anyLive: false };
});

describe("MyListingsTab and the location prompt (plan PR 7c)", () => {
  it("draws no note when every listing holds a place", async () => {
    await show();
    expect(screen.getByTestId("board")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("draws one note above the list, with the count and a link to edit the newest such listing", async () => {
    read.unlocated = { count: 3, firstId: "newest-id", anyLive: false };
    await show();
    expect(screen.getByText(words.title)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("3 of your listings have no location.");
    expect(screen.getByRole("link", { name: new RegExp(words.action) })).toHaveAttribute(
      "href",
      "/post-property/newest-id",
    );
    expect(screen.getAllByRole("status")).toHaveLength(1);
    const note = screen.getByRole("status");
    const board = screen.getByTestId("board");
    expect(note.compareDocumentPosition(board) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("says a live listing goes back to review only when one of them is Live", async () => {
    read.unlocated = { count: 1, firstId: "x", anyLive: false };
    await show();
    expect(screen.queryByText(words.reviewNote)).not.toBeInTheDocument();
  });

  it("says it before the owner starts when one of them is Live", async () => {
    read.unlocated = { count: 2, firstId: "x", anyLive: true };
    await show();
    expect(screen.getByText(words.reviewNote)).toBeInTheDocument();
  });

  it("shows the empty state, and no note, when the owner has no listings", async () => {
    read.listings = [];
    read.unlocated = { count: 0, firstId: null, anyLive: false };
    await show();
    expect(screen.getByTestId("empty")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows only the fallback to someone who is not signed in", async () => {
    read.signedIn = false;
    await show();
    expect(screen.getByTestId("empty")).toBeInTheDocument();
    expect(screen.queryByTestId("board")).not.toBeInTheDocument();
  });
});

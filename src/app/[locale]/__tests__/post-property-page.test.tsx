// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const visitor = vi.hoisted(() => ({
  signedIn: true,
  reads: [] as string[],
  email: { kind: "verified", email: "priya@example.com" } as { kind: string; email?: string },
  draft: null as null | { id: string; status: string; photos: { id: string; path: string }[] },
  drafts: [] as { id: string }[],
}));
const nav = vi.hoisted(() => ({ notFound: vi.fn(), redirect: vi.fn() }));

vi.mock("next/navigation", () => ({
  notFound: () => {
    nav.notFound();
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (to: string) => {
    nav.redirect(to);
    throw new Error("NEXT_REDIRECT");
  },
}));
vi.mock("@/features/site", () => ({
  getTranslate: async () => (key: string, values?: Record<string, string | number>) =>
    values ? `${key} ${JSON.stringify(values)}` : key,
}));
vi.mock("@/features/listings", () => ({
  MY_LISTINGS_HREF: "/dashboard?tab=listings",
  isSignedIn: async () => visitor.signedIn,
  getMyDraft: async (id: string) => {
    visitor.reads.push(id);
    return visitor.draft && visitor.draft.id === id ? visitor.draft : null;
  },
  PostPropertyScreen: (props: { draft?: { id: string } | null }) => (
    <p data-testid="screen" data-draft={props.draft?.id ?? ""} />
  ),
}));

const { default: PostPropertyPage, generateMetadata } =
  await import("../(account)/post-property/page");
const { default: ContinueDraftPage, generateMetadata: draftMetadata } =
  await import("../(account)/post-property/[id]/page");

const ID = "00000000-0000-4000-9000-000000000001";

beforeEach(() => {
  vi.clearAllMocks();
  visitor.draft = null;
  visitor.signedIn = true;
  visitor.reads = [];
});

describe("the post-property pages (S6-T02)", () => {
  it("are titled", async () => {
    expect((await generateMetadata()).title).toBe("postProperty.metaTitle");
    expect((await draftMetadata()).title).toBe("postProperty.metaTitle");
  });

  it("shows the screen for a new listing", () => {
    render(<PostPropertyPage />);
    expect(screen.getByTestId("screen")).toHaveAttribute("data-draft", "");
  });

  it("opens the person's own draft", async () => {
    visitor.draft = { id: ID, status: "draft", photos: [] };
    render(await ContinueDraftPage({ params: Promise.resolve({ id: ID }) }));
    expect(screen.getByTestId("screen")).toHaveAttribute("data-draft", ID);
  });

  it("reads the id as lower case, so a pasted capital letter still finds the draft", async () => {
    visitor.draft = { id: ID, status: "draft", photos: [] };
    render(await ContinueDraftPage({ params: Promise.resolve({ id: ID.toUpperCase() }) }));
    expect(screen.getByTestId("screen")).toHaveAttribute("data-draft", ID);
  });

  it("is not found for an address that is not an id, a listing that is not theirs, and one that does not exist", async () => {
    await expect(ContinueDraftPage({ params: Promise.resolve({ id: "nope" }) })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    await expect(ContinueDraftPage({ params: Promise.resolve({ id: ID }) })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    expect(nav.notFound).toHaveBeenCalledTimes(2);
  });

  it("draws nothing and reads nothing for a visitor, because the layout is already sending them to sign in", async () => {
    visitor.signedIn = false;
    visitor.draft = { id: ID, status: "draft", photos: [] };
    expect(await ContinueDraftPage({ params: Promise.resolve({ id: ID }) })).toBeNull();
    expect(visitor.reads).toEqual([]);
  });

  it("sends a listing that is no longer a draft to My listings", async () => {
    visitor.draft = { id: ID, status: "pending", photos: [] };
    await expect(ContinueDraftPage({ params: Promise.resolve({ id: ID }) })).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(nav.redirect).toHaveBeenCalledWith("/dashboard?tab=listings");
  });
});

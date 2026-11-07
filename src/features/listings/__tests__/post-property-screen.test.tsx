// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  signedIn: true,
  reads: [] as string[],
  email: { kind: "verified", email: "priya@example.com" } as { kind: string; email?: string },
  drafts: [] as unknown[],
}));

vi.mock("server-only", () => ({}));
vi.mock("@/features/account", () => ({
  getEmailState: async () => {
    state.reads.push("email");
    return state.email;
  },
}));
vi.mock("@/features/auth", () => ({ addEmail: vi.fn(), resendEmailLink: vi.fn() }));
vi.mock("@/features/media", () => ({
  PHOTO_BUCKET: "listing-photos",
  PhotoUploaderConnected: () => null,
  finalizePhoto: vi.fn(),
  removePhoto: vi.fn(),
  requestPhotoUpload: vi.fn(),
}));
vi.mock("@/features/site", () => ({
  getTranslate: async () => (key: string, values?: Record<string, string | number>) =>
    values ? `${key}:${Object.values(values).join(",")}` : key,
}));
vi.mock("@/lib/public-env", () => ({
  publicEnv: { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" },
}));
vi.mock("../actions", () => ({
  createListingDraft: vi.fn(),
  deleteListingDraft: vi.fn(),
  saveListingDraft: vi.fn(),
  submitListing: vi.fn(),
}));
vi.mock("../queries", () => ({
  isSignedIn: async () => state.signedIn,
  listMyDrafts: async () => {
    state.reads.push("drafts");
    return state.drafts;
  },
}));
vi.mock("../posting-gate.client", () => ({
  PostingGate: (props: { pendingEmail: string | null }) => (
    <p data-testid="gate" data-pending={props.pendingEmail ?? ""} />
  ),
}));
vi.mock("../drafts.client", () => ({
  YourDrafts: (props: { drafts: { id: string; saved: string }[] }) => (
    <p data-testid="drafts">
      {props.drafts.map((draft) => `${draft.id}|${draft.saved}`).join(";")}
    </p>
  ),
}));
vi.mock("../wizard.client", () => ({
  PostingWizard: (props: {
    listingId: string | null;
    doneHref: string;
    photos?: { id: string; name: string; previewUrl: string }[];
    values?: { title: string };
  }) => (
    <div
      data-testid="wizard"
      data-listing={props.listingId ?? ""}
      data-done={props.doneHref}
      data-title={props.values?.title ?? ""}
      data-photos={JSON.stringify(props.photos ?? [])}
    />
  ),
}));

const { PostPropertyScreen } = await import("../post-property-screen");

const draft = {
  id: "00000000-0000-4000-9000-000000000001",
  shortId: "abcd2345",
  status: "draft",
  listingType: "sale" as const,
  propertyType: "apartment" as const,
  address: null,
  locality: "Adyar",
  city: "Chennai",
  pincode: null,
  bhk: null,
  bathrooms: null,
  areaSqft: null,
  price: null,
  furnishing: null,
  amenities: [],
  title: "Sea view",
  description: null,
  updatedAt: "2026-11-07T10:00:00Z",
  photos: [{ id: "p1", path: "u/l/a b.jpg", position: 0 }],
};

beforeEach(() => {
  state.signedIn = true;
  state.reads = [];
  state.email = { kind: "verified", email: "priya@example.com" };
  state.drafts = [];
});

describe("PostPropertyScreen: the gate or the wizard (S6-T02)", () => {
  it("draws nothing and reads nothing for a visitor, because the layout is already sending them to sign in", async () => {
    state.signedIn = false;
    const { container } = render(await PostPropertyScreen({}));
    expect(container).toBeEmptyDOMElement();
    expect(state.reads).toEqual([]);
  });

  it("shows the gate to someone with no email, and to someone whose link is not used yet", async () => {
    state.email = { kind: "none" };
    const view = render(await PostPropertyScreen({}));
    expect(screen.getByTestId("gate")).toHaveAttribute("data-pending", "");
    expect(screen.queryByTestId("wizard")).toBeNull();
    view.unmount();
    state.email = { kind: "pending", email: "priya@example.com" };
    render(await PostPropertyScreen({}));
    expect(screen.getByTestId("gate")).toHaveAttribute("data-pending", "priya@example.com");
  });

  it("shows the wizard to a verified email, and also when the state could not be read", async () => {
    const view = render(await PostPropertyScreen({}));
    expect(screen.getByTestId("wizard")).toHaveAttribute("data-listing", "");
    expect(screen.getByTestId("wizard")).toHaveAttribute("data-done", "/dashboard?tab=listings");
    view.unmount();
    state.email = { kind: "unknown" };
    render(await PostPropertyScreen({}));
    expect(screen.getByTestId("wizard")).toBeInTheDocument();
  });

  it("lists the drafts above a new listing, with the date as words, and nothing when there are none", async () => {
    state.drafts = [
      {
        id: "a",
        title: "Sea view",
        locality: "Adyar",
        propertyType: "villa",
        listingType: "rent",
        updatedAt: "2026-11-07T10:00:00Z",
      },
    ];
    const view = render(await PostPropertyScreen({}));
    expect(screen.getByTestId("drafts")).toHaveTextContent("a|7 Nov 2026");
    view.unmount();
    state.drafts = [];
    render(await PostPropertyScreen({}));
    expect(screen.queryByTestId("drafts")).toBeNull();
  });

  it("opens a draft in the wizard with its values and its photos, and no list of drafts", async () => {
    state.drafts = [{ id: "ignored" }];
    render(await PostPropertyScreen({ draft }));
    const wizard = screen.getByTestId("wizard");
    expect(wizard).toHaveAttribute("data-listing", draft.id);
    expect(wizard).toHaveAttribute("data-title", "Sea view");
    expect(screen.queryByTestId("drafts")).toBeNull();
    const photos = JSON.parse(wizard.getAttribute("data-photos") ?? "[]") as {
      name: string;
      previewUrl: string;
    }[];
    expect(photos).toEqual([
      {
        id: "p1",
        name: "postProperty.photos.photoName:1",
        previewUrl: "http://127.0.0.1:54321/storage/v1/object/public/listing-photos/u/l/a%20b.jpg",
      },
    ]);
  });
});

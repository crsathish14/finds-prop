// @vitest-environment jsdom
import { configure, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import { resetDraftsForTests } from "@/lib/form-draft";
import type { ActionResult } from "@/types/action";
import { EMPTY_VALUES } from "../wizard-state";
import { AREA, LocationFieldStub, STREET } from "./location-stub";

configure({ asyncUtilTimeout: 8000 });
vi.setConfig({ testTimeout: 30_000 });

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/notify", () => ({ notify: toast }));
const { PostingWizard } = await import("../wizard.client");
type Actions = React.ComponentProps<typeof PostingWizard>["actions"];

function UploaderStub() {
  return <div data-testid="uploader" />;
}

const LISTING = "00000000-0000-4000-9000-000000000001";
const ok = <T,>(data: T): ActionResult<T> => ({ ok: true, data });
const located = () =>
  ok({ listingId: LISTING, shortId: "abcd2345", status: "draft", wentBackToReview: false });

function actions(overrides: Partial<Actions> = {}) {
  return {
    createDraft: vi.fn(async () => ok({ listingId: LISTING, shortId: "abcd2345" })),
    saveDraft: vi.fn(async () => ok({ listingId: LISTING })),
    submit: vi.fn(async () => ok({ listingId: LISTING, shortId: "abcd2345" })),
    setLocation: vi.fn(async () => located()),
    photos: { requestUpload: vi.fn(), finalize: vi.fn(), remove: vi.fn() },
    ...overrides,
  } as unknown as Actions;
}

const CURATED = [
  { label: "Velachery", lat: 12.9791, lng: 80.2184 },
  { label: "Adyar", lat: 13.0012, lng: 80.2565 },
];

function open(fake: Actions, props: Partial<React.ComponentProps<typeof PostingWizard>> = {}) {
  return renderWithMessages(
    <PostingWizard
      listingId={null}
      actions={fake}
      uploader={UploaderStub as never}
      doneHref="/dashboard?tab=listings"
      locationField={LocationFieldStub}
      areas={CURATED}
      {...props}
    />,
  );
}

const type = (label: RegExp | string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const press = (name: RegExp | string) => fireEvent.click(screen.getByRole("button", { name }));
const heading = (name: string) => screen.findByRole("heading", { level: 2, name });
const held = () => screen.getByTestId("location-held").textContent;
/** A street pick leaves the locality empty (only an area fills it), so a test that goes on types it. */
const typeLocality = () => type(/^Locality/, "Velachery");

beforeEach(() => {
  vi.clearAllMocks();
  resetDraftsForTests();
  sessionStorage.clear();
  localStorage.clear();
  window.history.replaceState(null, "", "/post-property");
});

describe("PostingWizard: the place on the address step (ADR-141, FR-GEO-02)", () => {
  it("shows the field above the address boxes, with the curated areas for the fallback", () => {
    open(actions());
    const field = screen.getByTestId("location-stub");
    const address = screen.getByLabelText(/^Address/);
    // The field comes before the Address box in the page.
    expect(field.compareDocumentPosition(address) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId("location-areas")).toHaveTextContent("Velachery,Adyar");
    expect(screen.getByLabelText(/^State/)).toHaveValue("Tamil Nadu");
  });

  it("holds Continue until a place is held: says so, names the step, focuses the field, sends nothing", async () => {
    const fake = actions();
    open(fake);
    type(/^Address/, "12 Beach Road");
    type(/^Locality/, "Adyar");
    type(/^Pincode/, "600020");
    press("Continue");
    expect(await screen.findByText("Add a location to continue.")).toBeVisible();
    expect(screen.getByText("Needs attention")).toBeInTheDocument();
    expect(fake.createDraft).not.toHaveBeenCalled();
    expect(fake.setLocation).not.toHaveBeenCalled();
    // The place is the first field with a problem (it is above the boxes), so it takes focus.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "stub pick place" })).toHaveFocus(),
    );
    // Picking a place takes the problem away.
    press("stub pick place");
    expect(screen.queryByText("Add a location to continue.")).toBeNull();
  });

  it("fills only the empty boxes from a pick and never what was typed", () => {
    open(actions());
    type(/^Address/, "12, Second Cross Street");
    press("stub pick street");
    expect(screen.getByLabelText(/^Address/)).toHaveValue("12, Second Cross Street");
    // The empty ones are filled: the pincode from the address, not the locality (the place is a street).
    expect(screen.getByLabelText(/^Pincode/)).toHaveValue("600042");
    expect(screen.getByLabelText(/^Locality/)).toHaveValue("");
    expect(held()).toBe("Velachery Main Road|exact");
  });

  it("fills the City from the place picked, and follows the place when another is picked", () => {
    open(actions());
    expect(screen.getByLabelText(/^City/)).toHaveValue("");
    press("stub pick street");
    expect(screen.getByLabelText(/^Address/)).toHaveValue(
      "Velachery Main Road, Velachery, Chennai, Tamil Nadu 600042, India",
    );
    expect(screen.getByLabelText(/^City/)).toHaveValue("Chennai");
    // A pick fills only the empty address, but the city is always the picked place's.
    press("stub pick area suggestion");
    expect(screen.getByLabelText(/^City/)).toHaveValue("Chennai");
    expect(screen.getByLabelText(/^Locality/)).toHaveValue("Adyar");
    expect(held()).toBe("Adyar|approximate");
  });

  it("does not let the City be typed in once the place gave it, and empties it on Change", () => {
    open(actions());
    // Before a place is picked there is nothing to read the city from, so it can be typed.
    expect(screen.getByLabelText(/^City/)).not.toHaveAttribute("readonly");
    press("stub pick place");
    expect(screen.getByLabelText(/^City/)).toHaveValue("Chennai");
    expect(screen.getByLabelText(/^City/)).toHaveAttribute("readonly");
    press("stub change place");
    expect(screen.getByLabelText(/^City/)).toHaveValue("");
    expect(screen.getByLabelText(/^City/)).not.toHaveAttribute("readonly");
  });

  it("lets the City be typed when the place names none, and keeps it", () => {
    open(actions());
    press("stub pick curated area");
    expect(screen.getByLabelText(/^City/)).not.toHaveAttribute("readonly");
    type(/^City/, "Madurai");
    expect(screen.getByLabelText(/^City/)).toHaveValue("Madurai");
    // Another place that names no city leaves what was typed.
    press("stub pick curated area");
    expect(screen.getByLabelText(/^City/)).toHaveValue("Madurai");
    // A place that names one takes over.
    press("stub pick place");
    expect(screen.getByLabelText(/^City/)).toHaveValue("Chennai");
    expect(screen.getByLabelText(/^City/)).toHaveAttribute("readonly");
    // And a curated area afterwards takes the city it gave away and hands the box back.
    press("stub pick curated area");
    expect(screen.getByLabelText(/^City/)).toHaveValue("");
    expect(screen.getByLabelText(/^City/)).not.toHaveAttribute("readonly");
  });

  it("writes the place when the draft is first saved, after it, to its own action, and never in the draft's fields", async () => {
    const fake = actions();
    open(fake);
    type(/^Address/, "12 Beach Road");
    type(/^Locality/, "Adyar");
    type(/^Pincode/, "600020");
    press("stub pick street");
    press("Continue");
    await heading("Tell us about the home");
    expect(fake.createDraft).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(vi.mocked(fake.createDraft).mock.calls)).not.toMatch(/12\.98|80\.22/);
    expect(fake.setLocation).toHaveBeenCalledTimes(1);
    expect(fake.setLocation).toHaveBeenCalledWith({
      listingId: LISTING,
      lat: STREET.lat,
      lng: STREET.lng,
    });
    // The draft was created first.
    const order = [
      vi.mocked(fake.createDraft).mock.invocationCallOrder[0] ?? 0,
      vi.mocked(fake.setLocation).mock.invocationCallOrder[0] ?? 0,
    ];
    expect(order[0]).toBeLessThan(order[1] ?? 0);
  });

  it("writes it again only when the owner picks another place", async () => {
    const fake = actions();
    open(fake);
    press("stub pick street");
    typeLocality();
    press("Continue");
    await heading("Tell us about the home");
    press("Back");
    await heading("What are you listing?");
    // Same place, later Continue: nothing written again.
    press("Continue");
    await heading("Tell us about the home");
    expect(fake.setLocation).toHaveBeenCalledTimes(1);
    press("Back");
    await heading("What are you listing?");
    press("stub pick area suggestion");
    press("Continue");
    await heading("Tell us about the home");
    await waitFor(() => expect(fake.setLocation).toHaveBeenCalledTimes(2));
    expect(vi.mocked(fake.setLocation).mock.calls[1]?.[0]).toEqual({
      listingId: LISTING,
      lat: AREA.lat,
      lng: AREA.lng,
    });
  });

  it("holds a curated area as an approximate place and writes its middle, with the city typed", async () => {
    const fake = actions();
    open(fake);
    type(/^Address/, "12 Beach Road");
    type(/^City/, "Chennai");
    type(/^Pincode/, "600020");
    press("stub pick curated area");
    expect(held()).toBe("Velachery|approximate");
    expect(screen.getByLabelText(/^Locality/)).toHaveValue("Velachery");
    press("Continue");
    await heading("Tell us about the home");
    expect(fake.setLocation).toHaveBeenCalledWith({
      listingId: LISTING,
      lat: 12.9791,
      lng: 80.2184,
    });
  });

  it("lets go of the place on Change, keeps the other boxes, and asks for a place again", async () => {
    const fake = actions();
    open(fake);
    press("stub pick street");
    const address = (screen.getByLabelText(/^Address/) as HTMLInputElement).value;
    press("stub change place");
    expect(held()).toBe("");
    expect(screen.getByLabelText(/^Address/)).toHaveValue(address);
    press("Continue");
    expect(await screen.findByText("Add a location to continue.")).toBeVisible();
    expect(fake.createDraft).not.toHaveBeenCalled();
  });

  it("keeps the place when the draft could not be saved, and writes it on the next try", async () => {
    const createDraft = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(ok({ listingId: LISTING, shortId: "abcd2345" }));
    const fake = actions({ createDraft: createDraft as unknown as Actions["createDraft"] });
    open(fake);
    press("stub pick street");
    typeLocality();
    press("Continue");
    expect(
      await screen.findByText("We couldn't save your draft. Your answers are still on this page."),
    ).toBeVisible();
    expect(held()).toBe("Velachery Main Road|exact");
    expect(fake.setLocation).not.toHaveBeenCalled();
    press("Continue");
    await heading("Tell us about the home");
    expect(fake.setLocation).toHaveBeenCalledTimes(1);
  });

  it("keeps the place when the draft saved but the place was refused for too many tries, and tries it again", async () => {
    const setLocation = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, code: "RATE_LIMITED", retryAfter: 60 })
      .mockResolvedValueOnce(located());
    const fake = actions({ setLocation: setLocation as unknown as Actions["setLocation"] });
    open(fake);
    press("stub pick street");
    typeLocality();
    press("Continue");
    await waitFor(() => expect(setLocation).toHaveBeenCalledTimes(1));
    // Still on the address step, the place still held, the draft exists.
    expect(screen.getByText("What are you listing?")).toBeVisible();
    expect(held()).toBe("Velachery Main Road|exact");
    expect(window.location.pathname).toBe(`/post-property/${LISTING}`);
    press("Continue");
    await heading("Tell us about the home");
    expect(setLocation).toHaveBeenCalledTimes(2);
    expect(fake.createDraft).toHaveBeenCalledTimes(1);
    expect(fake.saveDraft).toHaveBeenCalledTimes(1);
  });

  it("says when the place is outside Tamil Nadu, lets go of it and asks for another", async () => {
    const setLocation = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        code: "VALIDATION",
        fieldErrors: { location: [{ key: "validation.locationOutOfRegion" }] },
      })
      .mockResolvedValueOnce(located());
    const fake = actions({ setLocation: setLocation as unknown as Actions["setLocation"] });
    open(fake);
    press("stub pick street");
    typeLocality();
    press("Continue");
    expect(
      await screen.findByText("That place is outside Tamil Nadu. Choose a place in Tamil Nadu."),
    ).toBeVisible();
    expect(held()).toBe("");
    expect(screen.getByText("What are you listing?")).toBeVisible();
    press("stub pick area suggestion");
    expect(
      screen.queryByText("That place is outside Tamil Nadu. Choose a place in Tamil Nadu."),
    ).toBeNull();
    press("Continue");
    await heading("Tell us about the home");
    expect(setLocation).toHaveBeenCalledTimes(2);
    expect(vi.mocked(setLocation).mock.calls[1]?.[0]).toEqual({
      listingId: LISTING,
      lat: AREA.lat,
      lng: AREA.lng,
    });
  });

  it("does not ask for a place when only saving a draft, and writes one that is held", async () => {
    const fake = actions();
    open(fake);
    type(/^Locality/, "Adyar");
    press("Save draft");
    await waitFor(() => expect(fake.createDraft).toHaveBeenCalledTimes(1));
    expect(fake.setLocation).not.toHaveBeenCalled();
    expect(screen.queryByText("Add a location to continue.")).toBeNull();
    press("stub pick street");
    press("Save draft");
    await waitFor(() => expect(fake.setLocation).toHaveBeenCalledTimes(1));
    expect(fake.saveDraft).toHaveBeenCalledTimes(1);
  });

  it("does not ask for a place again when the opened draft already holds one, and writes nothing", async () => {
    const fake = actions();
    open(fake, {
      listingId: LISTING,
      locationHeld: true,
      values: { ...EMPTY_VALUES, city: "Chennai" },
    });
    // Only that a place is held is known: it is shown by a saved-place note, not by a point.
    expect(held()).toBe("Your saved location|exact");
    type(/^Address/, "12 Beach Road");
    type(/^Locality/, "Adyar");
    type(/^Pincode/, "600020");
    press("Continue");
    await heading("Tell us about the home");
    expect(fake.saveDraft).toHaveBeenCalledTimes(1);
    expect(fake.setLocation).not.toHaveBeenCalled();
  });

  it("gives the field the saved place's note, not a point, when the listing holds one", () => {
    const seen: unknown[] = [];
    open(actions(), {
      locationHeld: true,
      locationField: (props) => {
        seen.push(props.held);
        return null;
      },
    });
    expect(seen[0]).toEqual({ label: "Your saved location", approximate: false });
  });

  it("keeps the place with the answers kept before signing in again, and nowhere else", async () => {
    const fake = actions({
      createDraft: vi.fn(async () => ({
        ok: false,
        code: "UNAUTHENTICATED",
      })) as unknown as Actions["createDraft"],
    });
    const view = open(fake);
    press("stub pick street");
    typeLocality();
    press("Continue");
    fireEvent.click(await screen.findByRole("link", { name: "Sign in again" }));
    // The only copy is the form's own kept answers (this tab, short lived), never the address or local storage.
    expect(sessionStorage.length).toBe(1);
    expect(sessionStorage.key(0)).not.toContain("12.98");
    expect(localStorage.length).toBe(0);
    expect(window.location.href).not.toMatch(/12\.98|80\.22/);
    view.unmount();
    // Back in: the place is held again.
    open(actions());
    await waitFor(() => expect(held()).toBe("Velachery Main Road|exact"));
  });

  it("ignores a kept place that is not a place, and asks again", async () => {
    sessionStorage.setItem(
      "findsprop:draft:post-property:/post-property",
      JSON.stringify({
        at: Date.now(),
        values: {
          address: "1 Beach Road",
          locationLat: "far",
          locationLng: "away",
          locationKind: "exact",
        },
      }),
    );
    open(actions());
    await waitFor(() => expect(screen.getByLabelText(/^Address/)).toHaveValue("1 Beach Road"));
    expect(held()).toBe("");
  });

  it("puts the point in no address, no log line and no storage of its own", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((method) =>
      vi.spyOn(console, method).mockImplementation(() => undefined),
    );
    const fake = actions();
    open(fake);
    press("stub pick street");
    typeLocality();
    press("Continue");
    await heading("Tell us about the home");
    expect(window.location.href).not.toMatch(/12\.98|80\.22/);
    expect(sessionStorage.length).toBe(0);
    expect(localStorage.length).toBe(0);
    for (const spy of spies) {
      expect(JSON.stringify(spy.mock.calls)).not.toMatch(/12\.98|80\.22/);
      spy.mockRestore();
    }
  });
});

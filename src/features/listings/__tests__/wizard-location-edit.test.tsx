// @vitest-environment jsdom
import { configure, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import en from "@/i18n/messages/en.json";
import type { ActionResult } from "@/types/action";
import { EMPTY_VALUES, type WizardValues } from "../wizard-state";
import { AREA, LocationFieldStub, STREET } from "./location-stub";

configure({ asyncUtilTimeout: 8000 });
vi.setConfig({ testTimeout: 30_000 });

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/notify", () => ({ notify: toast }));
const { PostingWizard } = await import("../wizard.client");
type Actions = React.ComponentProps<typeof PostingWizard>["actions"];
type Edit = NonNullable<React.ComponentProps<typeof PostingWizard>["edit"]>;

const words = en.postProperty.edit;
const LISTING = "00000000-0000-4000-9000-000000000001";
const ok = <T,>(data: T): ActionResult<T> => ({ ok: true, data });

function UploaderStub() {
  return <div data-testid="uploader" />;
}

const VALUES: WizardValues = {
  ...EMPTY_VALUES,
  address: "12 Beach Road",
  locality: "Adyar",
  city: "Chennai",
  pincode: "600020",
  bhk: "3",
  bathrooms: "2",
  areaSqft: "950",
  price: "8500000",
  title: "Flat in Adyar near the beach",
};

const PHOTO = [{ id: "p1", name: "Photo 1", previewUrl: "http://example.test/a.jpg" }];

function actions(overrides: Partial<Actions> = {}) {
  return {
    createDraft: vi.fn(),
    saveDraft: vi.fn(),
    saveChanges: vi.fn(async () =>
      ok({ listingId: LISTING, shortId: "abcd2345", status: "approved", wentBackToReview: false }),
    ),
    submit: vi.fn(async () => ok({ listingId: LISTING, shortId: "abcd2345" })),
    setLocation: vi.fn(async () =>
      ok({ listingId: LISTING, shortId: "abcd2345", status: "approved", wentBackToReview: false }),
    ),
    photos: { requestUpload: vi.fn(), finalize: vi.fn(), remove: vi.fn() },
    ...overrides,
  } as unknown as Actions;
}

function open(
  fake: Actions,
  edit: Edit,
  props: Partial<React.ComponentProps<typeof PostingWizard>> = {},
) {
  return renderWithMessages(
    <PostingWizard
      listingId={LISTING}
      values={VALUES}
      photos={PHOTO}
      actions={fake}
      uploader={UploaderStub as never}
      doneHref="/dashboard?tab=listings"
      edit={edit}
      contactEmail="owner@example.test"
      locationField={LocationFieldStub}
      areas={[{ label: "Velachery", lat: 12.9791, lng: 80.2184 }]}
      {...props}
    />,
  );
}

const press = (name: RegExp | string) => fireEvent.click(screen.getByRole("button", { name }));
const heading = (name: string) => screen.findByRole("heading", { level: 2, name });

/** Continue from the address step to the last one. */
async function toReview(last: string = words.reviewSave) {
  press("Continue");
  await heading("Tell us about the home");
  press("Continue");
  await heading("Add photos");
  press("Continue");
  await heading("Describe your home");
  press("Continue");
  await heading(last);
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  window.history.replaceState(null, "", `/post-property/${LISTING}`);
});

describe("PostingWizard editing: the place of a listing that is already sent (ADR-141)", () => {
  const live: Edit = { state: "approved", reason: null };
  const waiting: Edit = { state: "pending", reason: null };
  const refused: Edit = { state: "rejected", reason: "Add a photo of the home." };

  it("shows the step with the listing's saved place, never a point, and saves unrelated changes without writing it", async () => {
    const fake = actions();
    open(fake, live, { locationHeld: true });
    expect(screen.getByTestId("location-held")).toHaveTextContent("Your saved location|exact");
    await toReview();
    press(words.save);
    await waitFor(() => expect(fake.saveChanges).toHaveBeenCalledTimes(1));
    expect(fake.setLocation).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(toast.success).toHaveBeenCalledWith(words.savedToast);
  });

  it("asks first when the place of a Live listing is changed, then saves the changes and writes the place after them", async () => {
    const fake = actions({
      setLocation: vi.fn(async () =>
        ok({ listingId: LISTING, shortId: "abcd2345", status: "pending", wentBackToReview: true }),
      ) as unknown as Actions["setLocation"],
    });
    open(fake, live, { locationHeld: true });
    press("stub change place");
    press("stub pick street");
    await toReview();
    press(words.save);
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(words.confirmTitle)).toBeVisible();
    // Nothing is written until the owner agrees.
    expect(fake.saveChanges).not.toHaveBeenCalled();
    expect(fake.setLocation).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: words.confirmSave }));
    await waitFor(() => expect(fake.setLocation).toHaveBeenCalledTimes(1));
    expect(fake.setLocation).toHaveBeenCalledWith({
      listingId: LISTING,
      lat: STREET.lat,
      lng: STREET.lng,
    });
    const first = vi.mocked(fake.saveChanges).mock.invocationCallOrder[0] ?? 0;
    const second = vi.mocked(fake.setLocation).mock.invocationCallOrder[0] ?? 0;
    expect(first).toBeLessThan(second);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(words.savedBackToReviewToast));
    expect(router.push).toHaveBeenCalledWith("/dashboard?tab=listings");
  });

  it("says the listing is back in review when only the place sent it there", async () => {
    const fake = actions({
      setLocation: vi.fn(async () =>
        ok({ listingId: LISTING, shortId: "abcd2345", status: "pending", wentBackToReview: true }),
      ) as unknown as Actions["setLocation"],
    });
    open(fake, live, { locationHeld: true });
    press("stub change place");
    press("stub pick area suggestion");
    await toReview();
    press(words.save);
    fireEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: words.confirmSave,
      }),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(words.savedBackToReviewToast));
    expect(fake.setLocation).toHaveBeenCalledWith({
      listingId: LISTING,
      lat: AREA.lat,
      lng: AREA.lng,
    });
  });

  it("writes a changed place of a listing in review without a question, after the changes", async () => {
    const fake = actions();
    open(fake, waiting, { locationHeld: true });
    press("stub change place");
    press("stub pick place");
    await toReview();
    press(words.save);
    await waitFor(() => expect(fake.setLocation).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(fake.setLocation).toHaveBeenCalledWith({
      listingId: LISTING,
      lat: 13.05,
      lng: 80.25,
    });
    expect(fake.saveChanges).toHaveBeenCalledTimes(1);
  });

  it("does not hold back an unrelated change of an old listing that has no place", async () => {
    const fake = actions();
    open(fake, waiting, { locationHeld: false });
    // The step is there, in its search state, and Continue is not refused for it.
    expect(screen.getByTestId("location-held")).toHaveTextContent("");
    await toReview();
    expect(screen.queryByText("Add a location to continue.")).toBeNull();
    press(words.save);
    await waitFor(() => expect(fake.saveChanges).toHaveBeenCalledTimes(1));
    expect(fake.setLocation).not.toHaveBeenCalled();
  });

  it("asks a Live listing without a place first, when one is added", async () => {
    const fake = actions();
    open(fake, live, { locationHeld: false });
    press("stub pick street");
    await toReview();
    press(words.save);
    expect(await screen.findByRole("alertdialog")).toBeVisible();
    expect(fake.setLocation).not.toHaveBeenCalled();
  });

  it("needs a place to send a refused listing again, then writes it before sending", async () => {
    const fake = actions();
    open(fake, refused);
    press("Continue");
    expect(await screen.findByText("Add a location to continue.")).toBeVisible();
    press("stub pick street");
    await toReview(words.reviewResubmit);
    press(words.resubmit);
    await waitFor(() => expect(fake.submit).toHaveBeenCalledTimes(1));
    expect(fake.setLocation).toHaveBeenCalledTimes(1);
    const written = vi.mocked(fake.setLocation).mock.invocationCallOrder[0] ?? 0;
    const sent = vi.mocked(fake.submit).mock.invocationCallOrder[0] ?? 0;
    expect(written).toBeLessThan(sent);
  });

  it("lets a refused listing that already holds a place be sent again without picking one", async () => {
    const fake = actions();
    open(fake, refused, { locationHeld: true });
    await toReview(words.reviewResubmit);
    press(words.resubmit);
    await waitFor(() => expect(fake.submit).toHaveBeenCalledTimes(1));
    expect(fake.setLocation).not.toHaveBeenCalled();
  });

  it("does not send a refused listing again when its place is refused, and says why", async () => {
    const fake = actions({
      setLocation: vi.fn(async () => ({
        ok: false as const,
        code: "VALIDATION" as const,
        fieldErrors: { location: [{ key: "validation.locationOutOfRegion" }] },
      })) as unknown as Actions["setLocation"],
    });
    open(fake, refused);
    press("stub pick street");
    await toReview(words.reviewResubmit);
    press(words.resubmit);
    expect(
      await screen.findByText("That place is outside Tamil Nadu. Choose a place in Tamil Nadu."),
    ).toBeVisible();
    expect(fake.submit).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
    // The place was let go and the address step is open again.
    expect(screen.getByTestId("location-held")).toHaveTextContent("");
  });
});

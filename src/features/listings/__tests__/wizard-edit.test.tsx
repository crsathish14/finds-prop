// @vitest-environment jsdom
import { configure, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import en from "@/i18n/messages/en.json";
import type { ActionResult } from "@/types/action";
import type { WizardValues } from "../wizard-state";

// The full suite runs many test files at once, so every wait is patient (they pass in about two seconds alone).
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
  listingType: "sale",
  propertyType: "apartment",
  address: "12 Beach Road",
  locality: "Adyar",
  city: "Chennai",
  pincode: "600020",
  bhk: "3",
  bathrooms: "2",
  areaSqft: "950",
  price: "8500000",
  furnishing: "",
  amenities: [],
  title: "Flat in Adyar near the beach",
  description: "",
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
      {...props}
    />,
  );
}

const type = (label: RegExp | string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const press = (name: RegExp | string) => fireEvent.click(screen.getByRole("button", { name }));
const heading = (name: string) => screen.findByRole("heading", { level: 2, name });

/** Continue through the steps, changing what the callback asks on the way, to the last step. */
async function toReview(change: (step: "details" | "describe") => void = () => undefined) {
  press("Continue");
  await heading("Tell us about the home");
  change("details");
  press("Continue");
  await heading("Add photos");
  press("Continue");
  await heading("Describe your home");
  change("describe");
  press("Continue");
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  window.history.replaceState(null, "", `/post-property/${LISTING}`);
});

describe("PostingWizard editing a Live listing (S6-T05, DEC-09)", () => {
  const live: Edit = { state: "approved", reason: null };

  it("has the words of an edit, tells what sends the listing back to review, and has no Save draft", () => {
    open(actions(), live);
    expect(screen.getByRole("heading", { level: 1, name: "Edit your listing" })).toBeVisible();
    expect(screen.getByText(words.descriptionApproved)).toBeVisible();
    expect(screen.getByText(words.liveNoticeTitle)).toBeVisible();
    expect(screen.getByText(words.liveNoticeBody)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Save draft" })).toBeNull();
  });

  it("saves nothing on the way through, whatever is changed", async () => {
    const fake = actions();
    open(fake, live);
    await toReview((step) => {
      if (step === "details") type(/^Price/, "9000000");
    });
    await heading(words.reviewSave);
    expect(fake.saveChanges).not.toHaveBeenCalled();
    expect(fake.saveDraft).not.toHaveBeenCalled();
    expect(fake.createDraft).not.toHaveBeenCalled();
    expect(screen.getByText(words.nextApproved)).toBeVisible();
  });

  it("saves a change that keeps it Live at once: no question, a toast, and back to My listings", async () => {
    const fake = actions();
    open(fake, live);
    await toReview((step) => {
      if (step === "details") type(/^Price/, "9000000");
    });
    await heading(words.reviewSave);
    press(words.save);
    await waitFor(() => expect(fake.saveChanges).toHaveBeenCalledTimes(1));
    const call = vi.mocked(fake.saveChanges).mock.calls[0]?.[0] as unknown as {
      listingId: string;
      fields: Record<string, unknown>;
    };
    expect(call.listingId).toBe(LISTING);
    expect(call.fields).toMatchObject({
      price: "9000000",
      title: VALUES.title,
      address: VALUES.address,
    });
    expect(screen.queryByRole("alertdialog")).toBeNull();
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(words.savedToast));
    expect(router.push).toHaveBeenCalledWith("/dashboard?tab=listings");
    expect(fake.submit).not.toHaveBeenCalled();
  });

  it("asks first when a moderated field changed; Keep editing saves nothing", async () => {
    const fake = actions();
    open(fake, live);
    await toReview((step) => {
      if (step === "describe") type(/^Title/, "A different title for the flat");
    });
    await heading(words.reviewSave);
    press(words.save);
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(words.confirmTitle)).toBeVisible();
    expect(within(dialog).getByText(words.confirmBody)).toBeVisible();
    fireEvent.click(within(dialog).getByRole("button", { name: words.confirmKeep }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(fake.saveChanges).not.toHaveBeenCalled();
  });

  it("saves after the question is answered, and says the listing is back in review", async () => {
    const fake = actions({
      saveChanges: vi.fn(async () =>
        ok({ listingId: LISTING, shortId: "abcd2345", status: "pending", wentBackToReview: true }),
      ),
    });
    open(fake, live);
    await toReview((step) => {
      if (step === "describe") type(/^Title/, "A different title for the flat");
    });
    await heading(words.reviewSave);
    press(words.save);
    fireEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: words.confirmSave,
      }),
    );
    await waitFor(() => expect(fake.saveChanges).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(words.savedBackToReviewToast));
    expect(router.push).toHaveBeenCalledWith("/dashboard?tab=listings");
  });

  it("does not ask when the same title is saved again, spacing aside", async () => {
    const fake = actions();
    open(fake, live);
    await toReview((step) => {
      if (step === "describe") type(/^Title/, "  Flat in Adyar   near the beach ");
    });
    await heading(words.reviewSave);
    press(words.save);
    await waitFor(() => expect(fake.saveChanges).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("says it could not save, keeps the answers and does not leave the page, when the call fails", async () => {
    const fake = actions({
      saveChanges: vi.fn(async () => ({ ok: false as const, code: "UPSTREAM_FAILED" as const })),
    });
    open(fake, live);
    await toReview();
    await heading(words.reviewSave);
    press(words.save);
    expect(await screen.findByText(words.failedTitle)).toBeVisible();
    expect(screen.getByText(words.failedBody)).toBeVisible();
    expect(router.push).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("says the listing changed in the meantime, on a conflict", async () => {
    const fake = actions({
      saveChanges: vi.fn(async () => ({ ok: false as const, code: "CONFLICT" as const })),
    });
    open(fake, live);
    await toReview();
    await heading(words.reviewSave);
    press(words.save);
    expect(await screen.findByText(words.conflict)).toBeVisible();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("goes back to the step with a problem instead of saving, when a box is now invalid", async () => {
    const fake = actions();
    open(fake, live);
    await toReview();
    await heading(words.reviewSave);
    // Back to the details, empty the area, and straight to the last step is not possible: Continue checks it.
    press("Back");
    await heading("Describe your home");
    type(/^Title/, "short");
    expect(screen.getByLabelText(/^Title/)).toHaveValue("short");
    press("Continue");
    expect(await screen.findByText(/at least 8/i)).toBeVisible();
    expect(fake.saveChanges).not.toHaveBeenCalled();
  });
});

describe("PostingWizard editing a listing in review (S6-T05)", () => {
  const waiting: Edit = { state: "pending", reason: null };

  it("has its own description, no notice, and saves a changed title without asking", async () => {
    const fake = actions({
      saveChanges: vi.fn(async () =>
        ok({ listingId: LISTING, shortId: "abcd2345", status: "pending", wentBackToReview: false }),
      ),
    });
    open(fake, waiting);
    expect(screen.getByText(words.descriptionPending)).toBeVisible();
    expect(screen.queryByText(words.liveNoticeTitle)).toBeNull();
    await toReview((step) => {
      if (step === "describe") type(/^Title/, "A different title for the flat");
    });
    await heading(words.reviewSave);
    expect(screen.getByText(words.nextPending)).toBeVisible();
    press(words.save);
    await waitFor(() => expect(fake.saveChanges).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(words.savedToast));
  });
});

describe("PostingWizard editing a listing that was not approved (S6-T05, FR-ACC-12)", () => {
  const rejected: Edit = { state: "rejected", reason: "Add a photo of the home itself." };

  it("shows the admin's reason and ends with Resubmit for review", async () => {
    open(actions(), rejected);
    expect(screen.getByText(words.rejectedNoticeTitle)).toBeVisible();
    expect(screen.getByText("Reason: Add a photo of the home itself.")).toBeVisible();
    expect(screen.getByText(words.descriptionRejected)).toBeVisible();
    await toReview();
    await heading(words.reviewResubmit);
    expect(screen.getByText(words.nextRejected)).toBeVisible();
    expect(screen.getByRole("button", { name: words.resubmit })).toBeVisible();
  });

  it("saves the changes and then sends the listing for review again, with one key", async () => {
    const fake = actions();
    open(fake, rejected);
    await toReview();
    await heading(words.reviewResubmit);
    press(words.resubmit);
    await waitFor(() => expect(fake.submit).toHaveBeenCalledTimes(1));
    expect(fake.saveChanges).toHaveBeenCalledTimes(1);
    const sent = vi.mocked(fake.submit).mock.calls[0]?.[0] as unknown as {
      listingId: string;
      idempotencyKey: string;
    };
    expect(sent.listingId).toBe(LISTING);
    expect(sent.idempotencyKey).toMatch(/[0-9a-f-]{36}/);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(en.postProperty.notices.submitted),
    );
    expect(router.push).toHaveBeenCalledWith("/dashboard?tab=listings");
  });

  it("does not resubmit when the changes could not be saved", async () => {
    const fake = actions({
      saveChanges: vi.fn(async () => ({ ok: false as const, code: "UPSTREAM_FAILED" as const })),
    });
    open(fake, rejected);
    await toReview();
    await heading(words.reviewResubmit);
    press(words.resubmit);
    expect(await screen.findByText(en.postProperty.notices.failedTitle)).toBeVisible();
    expect(fake.submit).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("shows the limit of open listings when resubmitting is refused for it", async () => {
    const fake = actions({
      submit: vi.fn(async () => ({
        ok: false as const,
        code: "VALIDATION" as const,
        fieldErrors: {
          listing: [{ key: "validation.openListingLimit", values: { maximum: 5 } }],
        },
      })),
    });
    open(fake, rejected);
    await toReview();
    await heading(words.reviewResubmit);
    press(words.resubmit);
    expect(
      await screen.findByText("You already have 5 listings waiting. Finish or delete one first."),
    ).toBeVisible();
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe("PostingWizard editing without a photo (S6-T05)", () => {
  it("sends the owner to the photos step instead of saving", async () => {
    const fake = actions();
    open(fake, { state: "approved", reason: null }, { photos: [] });
    press("Continue");
    await heading("Tell us about the home");
    press("Continue");
    await heading("Add photos");
    press("Continue");
    expect(await screen.findByText(en.validation.photoRequired)).toBeVisible();
    expect(fake.saveChanges).not.toHaveBeenCalled();
  });
});

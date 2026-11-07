// @vitest-environment jsdom
import { configure, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import type { ActionResult } from "@/types/action";

// The full suite runs many test files at once, so every wait is patient (they pass in about two seconds alone).
configure({ asyncUtilTimeout: 8000 });
vi.setConfig({ testTimeout: 30_000 });

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/notify", () => ({ notify: toast }));
const { PostingWizard } = await import("../wizard.client");
type Actions = React.ComponentProps<typeof PostingWizard>["actions"];

function UploaderStub(props: {
  listingId: string;
  onStatus?: (status: { count: number; busy: boolean }) => void;
}) {
  return (
    <div data-testid="uploader" data-listing={props.listingId}>
      <button type="button" onClick={() => props.onStatus?.({ count: 1, busy: false })}>
        stub add photo
      </button>
      <button type="button" onClick={() => props.onStatus?.({ count: 1, busy: true })}>
        stub busy
      </button>
    </div>
  );
}

const LISTING = "00000000-0000-4000-9000-000000000001";
const ok = <T,>(data: T): ActionResult<T> => ({ ok: true, data });

function actions(overrides: Partial<Actions> = {}) {
  const fake = {
    createDraft: vi.fn(async () => ok({ listingId: LISTING, shortId: "abcd2345" })),
    saveDraft: vi.fn(async () => ok({ listingId: LISTING })),
    submit: vi.fn(async () => ok({ listingId: LISTING, shortId: "abcd2345" })),
    photos: {
      requestUpload: vi.fn(),
      finalize: vi.fn(),
      remove: vi.fn(),
    },
    ...overrides,
  } as unknown as Actions;
  return fake;
}

function open(fake: Actions, props: Partial<React.ComponentProps<typeof PostingWizard>> = {}) {
  return renderWithMessages(
    <PostingWizard
      listingId={null}
      actions={fake}
      uploader={UploaderStub as never}
      doneHref="/dashboard?tab=listings"
      {...props}
    />,
  );
}

const type = (label: RegExp | string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const press = (name: RegExp | string) => fireEvent.click(screen.getByRole("button", { name }));
const heading = (name: string) => screen.findByRole("heading", { level: 2, name });

async function fillStepOne() {
  type(/^Address/, "12, Second Cross Street, Velachery");
  type(/^Locality/, "Velachery");
  type(/^Pincode/, "600042");
}

async function reachReview(fake: Actions) {
  await fillStepOne();
  press("Continue");
  await heading("Tell us about the home");
  type(/^Area/, "1420");
  type(/^Price/, "12500000");
  press("Continue");
  await heading("Add photos");
  fireEvent.click(screen.getByRole("button", { name: "stub add photo" }));
  press("Continue");
  await heading("Describe your home");
  type(/^Title/, "3 BHK apartment with clubhouse");
  press("Continue");
  await heading("Review and submit");
  return fake;
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  window.history.replaceState(null, "", "/post-property");
});

describe("PostingWizard: the five steps, connected (S6-T02, FR-ACC-06)", () => {
  it("starts on Basics with the heading, the steps and no Back", () => {
    open(actions());
    expect(screen.getByRole("heading", { level: 1, name: "Post your property" })).toBeVisible();
    expect(screen.getByText("What are you listing?")).toBeVisible();
    expect(screen.getByRole("radio", { name: /Sell/ })).toBeChecked();
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
    expect(screen.getAllByText("Step 1 of 5: Basics").length).toBeGreaterThan(0);
  });

  it("checks only this step on Continue, names the fields and sends nothing", async () => {
    const fake = actions();
    open(fake);
    press("Continue");
    expect(await screen.findByText("Add the street or building.")).toBeVisible();
    expect(screen.getByText("Enter the 6-digit pincode.")).toBeVisible();
    expect(fake.createDraft).not.toHaveBeenCalled();
    // The first field with a problem takes focus.
    await waitFor(() => expect(screen.getByLabelText(/^Address/)).toHaveFocus());
    expect(screen.getByText("Needs attention")).toBeInTheDocument();
  });

  it("starts the draft on the first Continue, with one key, and moves the address to the draft", async () => {
    const fake = actions();
    open(fake);
    await fillStepOne();
    press("Continue");
    await heading("Tell us about the home");
    expect(fake.createDraft).toHaveBeenCalledTimes(1);
    const call = vi.mocked(fake.createDraft).mock.calls[0]?.[0];
    expect(call?.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
    expect(call?.fields).toMatchObject({
      listingType: "sale",
      propertyType: "apartment",
      address: "12, Second Cross Street, Velachery",
      locality: "Velachery",
      city: "Chennai",
      pincode: "600042",
    });
    expect(window.location.pathname).toBe(`/post-property/${LISTING}`);
    // The new step takes focus on its heading.
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Tell us about the home" })).toHaveFocus(),
    );
  });

  it("goes through every step, saves each one to the draft and submits for review", async () => {
    const fake = actions();
    open(fake);
    await reachReview(fake);
    expect(fake.saveDraft).toHaveBeenCalledTimes(2);
    expect(vi.mocked(fake.saveDraft).mock.calls[0]?.[0]).toMatchObject({
      listingId: LISTING,
      fields: { areaSqft: "1420", price: "12500000" },
    });
    // The review shows the answers.
    expect(screen.getByText("For sale · Apartment")).toBeVisible();
    expect(screen.getByText("₹1.25 Cr")).toBeVisible();
    expect(screen.getByText("1 photo")).toBeVisible();
    expect(screen.getByText("3 BHK apartment with clubhouse")).toBeVisible();
    expect(screen.getByText("What happens next")).toBeVisible();

    press("Submit for review");
    await waitFor(() => expect(fake.submit).toHaveBeenCalledTimes(1));
    expect(vi.mocked(fake.submit).mock.calls[0]?.[0]).toMatchObject({ listingId: LISTING });
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/dashboard?tab=listings"));
    expect(toast.success).toHaveBeenCalledWith("Your listing was submitted for review.");
  });

  it("goes back without losing what was typed", async () => {
    open(actions());
    await fillStepOne();
    press("Continue");
    await heading("Tell us about the home");
    type(/^Area/, "950");
    press("Back");
    await heading("What are you listing?");
    expect(screen.getByLabelText(/^Locality/)).toHaveValue("Velachery");
    press("Continue");
    await heading("Tell us about the home");
    expect(screen.getByLabelText(/^Area/)).toHaveValue("950");
  });

  it("asks for at least one photo on step 3, and holds Continue while a photo is on its way", async () => {
    open(actions());
    await fillStepOne();
    press("Continue");
    await heading("Tell us about the home");
    type(/^Area/, "950");
    type(/^Price/, "5000000");
    press("Continue");
    await heading("Add photos");
    expect(screen.getByTestId("uploader")).toHaveAttribute("data-listing", LISTING);
    press("Continue");
    expect(await screen.findByText("Add at least one photo before you submit.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "stub busy" }));
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "stub add photo" }));
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  it("keeps an unfinished listing with Save draft and says so", async () => {
    const fake = actions();
    open(fake);
    type(/^Locality/, "Adyar");
    press("Save draft");
    await waitFor(() => expect(fake.createDraft).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Draft saved", {
        description: "You can pick it up again from Post a property.",
      }),
    );
    // Still on step 1, with what was typed.
    expect(screen.getByLabelText(/^Locality/)).toHaveValue("Adyar");
  });

  it("shows a field that is wrong when Save draft is pressed, and sends nothing", async () => {
    const fake = actions();
    open(fake);
    type(/^Pincode/, "12");
    press("Save draft");
    expect(await screen.findByText("Enter the 6-digit pincode.")).toBeVisible();
    expect(fake.createDraft).not.toHaveBeenCalled();
  });

  it("opens a saved draft on its listing and saves to it instead of starting another", async () => {
    const fake = actions();
    open(fake, {
      listingId: LISTING,
      values: {
        listingType: "rent",
        propertyType: "villa",
        address: "1 Beach Road",
        locality: "Adyar",
        city: "Chennai",
        pincode: "600020",
        bhk: "",
        bathrooms: "",
        areaSqft: "",
        price: "",
        furnishing: "",
        amenities: [],
        title: "",
        description: "",
      },
    });
    expect(screen.getByRole("radio", { name: /Rent out/ })).toBeChecked();
    expect(screen.getByLabelText(/^Locality/)).toHaveValue("Adyar");
    press("Continue");
    await heading("Tell us about the home");
    expect(fake.createDraft).not.toHaveBeenCalled();
    expect(fake.saveDraft).toHaveBeenCalledTimes(1);
  });

  it("keeps everything and says so when the request does not get through", async () => {
    const fake = actions({
      createDraft: vi.fn(async () => {
        throw new Error("offline");
      }) as unknown as Actions["createDraft"],
    });
    open(fake);
    await fillStepOne();
    press("Continue");
    expect(
      await screen.findByText("We couldn't save your draft. Your answers are still on this page."),
    ).toBeVisible();
    expect(screen.getByLabelText(/^Locality/)).toHaveValue("Velachery");
    expect(screen.getByText("What are you listing?")).toBeVisible();
  });

  it("says when too many listings were started today, in the approved words", async () => {
    const fake = actions({
      createDraft: vi.fn(async () => ({
        ok: false,
        code: "RATE_LIMITED",
        retryAfter: 3600,
      })) as unknown as Actions["createDraft"],
    });
    open(fake);
    await fillStepOne();
    press("Continue");
    expect(
      await screen.findByText("You've started too many listings today. Please try again tomorrow."),
    ).toBeVisible();
  });

  it("names the open-listing limit when the server refuses a sixth", async () => {
    const fake = actions({
      createDraft: vi.fn(async () => ({
        ok: false,
        code: "VALIDATION",
        fieldErrors: {
          listing: [{ key: "validation.openListingLimit", values: { maximum: 5 } }],
        },
      })) as unknown as Actions["createDraft"],
    });
    open(fake);
    await fillStepOne();
    press("Continue");
    expect(
      await screen.findByText("You already have 5 listings waiting. Finish or delete one first."),
    ).toBeVisible();
  });

  it("keeps the answers and offers sign-in when the session ended, and remembers them for the way back", async () => {
    const fake = actions({
      createDraft: vi.fn(async () => ({
        ok: false,
        code: "UNAUTHENTICATED",
      })) as unknown as Actions["createDraft"],
    });
    open(fake);
    await fillStepOne();
    press("Continue");
    const link = await screen.findByRole("link", { name: "Sign in again" });
    expect(link.getAttribute("href")).toContain("/auth?gate=expired&redirect=");
    expect(screen.getByLabelText(/^Locality/)).toHaveValue("Velachery");
    // Following the link keeps what was typed in this tab (S5-T07).
    fireEvent.click(link);
    expect(sessionStorage.length).toBeGreaterThan(0);
  });

  describe("when sending for review is refused", () => {
    it("shows the failure alert, keeps the answers and lets the person try again with the same key", async () => {
      const submit = vi
        .fn()
        .mockResolvedValueOnce({ ok: false, code: "INTERNAL" })
        .mockResolvedValueOnce(ok({ listingId: LISTING, shortId: "abcd2345" }));
      const fake = actions({ submit: submit as unknown as Actions["submit"] });
      open(fake);
      await reachReview(fake);
      press("Submit for review");
      expect(await screen.findByText("We couldn't submit your listing")).toBeVisible();
      expect(
        screen.getByText(
          "Your answers are saved on this page. Check your connection and try again.",
        ),
      ).toBeVisible();
      press("Submit for review");
      await waitFor(() => expect(router.push).toHaveBeenCalled());
      expect(submit.mock.calls[0]?.[0].idempotencyKey).toBe(
        submit.mock.calls[1]?.[0].idempotencyKey,
      );
    });

    it("takes the person to the step that needs fixing, marks it, and names the field", async () => {
      const fake = actions({
        submit: vi.fn(async () => ({
          ok: false,
          code: "VALIDATION",
          fieldErrors: { title: [{ key: "validation.required" }] },
        })) as unknown as Actions["submit"],
      });
      open(fake);
      await reachReview(fake);
      press("Submit for review");
      await heading("Describe your home");
      expect(screen.getByText("This field is required.")).toBeVisible();
      expect(screen.getByText("Needs attention")).toBeInTheDocument();
    });

    it("takes the person to the photos when the server found none", async () => {
      const fake = actions({
        submit: vi.fn(async () => ({
          ok: false,
          code: "VALIDATION",
          fieldErrors: { photos: [{ key: "validation.photoRequired" }] },
        })) as unknown as Actions["submit"],
      });
      open(fake);
      await reachReview(fake);
      press("Submit for review");
      await heading("Add photos");
      expect(screen.getByText("Add at least one photo before you submit.")).toBeVisible();
    });

    it("lets Edit on the review go back to the step it names", async () => {
      open(actions());
      await reachReview(actions());
      fireEvent.click(screen.getByRole("button", { name: "Edit price" }));
      await heading("Tell us about the home");
    });
  });

  it("uses the buttons in reading order on the last step: Back, Save draft, Submit for review", async () => {
    open(actions());
    await reachReview(actions());
    const names = screen
      .getAllByRole("button")
      .map((button) => button.textContent?.trim())
      .filter((name) => ["Back", "Save draft", "Submit for review"].includes(name ?? ""));
    expect(names).toEqual(["Back", "Save draft", "Submit for review"]);
    expect(
      within(document.body).getAllByText("Step 5 of 5: Review and submit").length,
    ).toBeGreaterThan(0);
  });
});

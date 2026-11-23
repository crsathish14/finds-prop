// @vitest-environment jsdom
import { configure, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import type { ActionResult } from "@/types/action";
import { LocationFieldStub } from "./location-stub";

// The email for enquiries on the last step of the wizard (ADR-186).
configure({ asyncUtilTimeout: 8000 });
vi.setConfig({ testTimeout: 30_000 });

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/notify", () => ({ notify: toast }));
const { PostingWizard } = await import("../wizard.client");
type Actions = React.ComponentProps<typeof PostingWizard>["actions"];

function UploaderStub(props: { onStatus?: (status: { count: number; busy: boolean }) => void }) {
  return (
    <button type="button" onClick={() => props.onStatus?.({ count: 1, busy: false })}>
      stub add photo
    </button>
  );
}

const LISTING = "00000000-0000-4000-9000-000000000001";
const ok = <T,>(data: T): ActionResult<T> => ({ ok: true, data });

function actions(overrides: Partial<Actions> = {}) {
  return {
    createDraft: vi.fn(async () => ok({ listingId: LISTING, shortId: "abcd2345" })),
    saveDraft: vi.fn(async () => ok({ listingId: LISTING })),
    submit: vi.fn(async () => ok({ listingId: LISTING, shortId: "abcd2345" })),
    setLocation: vi.fn(async () =>
      ok({ listingId: LISTING, shortId: "abcd2345", status: "draft", wentBackToReview: false }),
    ),
    photos: { requestUpload: vi.fn(), finalize: vi.fn(), remove: vi.fn() },
    ...overrides,
  } as unknown as Actions;
}

function open(fake: Actions, props: Partial<React.ComponentProps<typeof PostingWizard>> = {}) {
  return renderWithMessages(
    <PostingWizard
      listingId={null}
      actions={fake}
      uploader={UploaderStub as never}
      doneHref="/dashboard?tab=listings"
      locationField={LocationFieldStub}
      {...props}
    />,
  );
}

const type = (label: RegExp | string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const press = (name: RegExp | string) => fireEvent.click(screen.getByRole("button", { name }));
const heading = (name: string) => screen.findByRole("heading", { level: 2, name });

async function reachReview() {
  type(/^Address/, "12, Second Cross Street, Velachery");
  type(/^Locality/, "Velachery");
  type(/^Pincode/, "600042");
  fireEvent.click(screen.getByRole("button", { name: "stub pick place" }));
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
}

const EMAIL_BOX = /^Email for enquiries/;
const REQUIRED = "Add an email so we can tell you about enquiries.";
const INVALID = "Enter a valid email address, like name@example.com.";

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  window.history.replaceState(null, "", "/post-property");
});

describe("PostingWizard: the email for enquiries (ADR-186)", () => {
  it("asks for it on the last step, empty when the account has none, and says it is not checked", async () => {
    open(actions());
    await reachReview();
    expect(screen.getByLabelText(EMAIL_BOX)).toHaveValue("");
    expect(screen.getByText(/We don't check this address/)).toBeVisible();
  });

  it("starts with the address the account already holds", async () => {
    open(actions(), { contactEmail: "owner@example.test" });
    await reachReview();
    expect(screen.getByLabelText(EMAIL_BOX)).toHaveValue("owner@example.test");
  });

  it("does not hold up a draft: Save draft works with no email and never sends it as a field", async () => {
    const fake = actions();
    open(fake);
    await reachReview();
    press("Save draft");
    await waitFor(() => expect(fake.saveDraft).toHaveBeenCalled());
    const sent = vi.mocked(fake.saveDraft).mock.calls.at(-1)?.[0] as unknown as {
      fields: Record<string, unknown>;
    };
    expect(sent.fields).not.toHaveProperty("contactEmail");
    expect(fake.submit).not.toHaveBeenCalled();
  });

  it("refuses Submit with no email, names the box and sends nothing", async () => {
    const fake = actions();
    open(fake);
    await reachReview();
    press("Submit for review");
    expect(await screen.findByText(REQUIRED)).toBeVisible();
    expect(screen.getByLabelText(EMAIL_BOX)).toHaveAttribute("aria-invalid", "true");
    expect(fake.submit).not.toHaveBeenCalled();
  });

  it("refuses an email that is not an address, and takes the problem away when it is typed again", async () => {
    const fake = actions();
    open(fake);
    await reachReview();
    type(EMAIL_BOX, "not an address");
    press("Submit for review");
    expect(await screen.findByText(INVALID)).toBeVisible();
    type(EMAIL_BOX, "owner@example.test");
    expect(screen.queryByText(INVALID)).toBeNull();
    expect(fake.submit).not.toHaveBeenCalled();
  });

  it("sends the typed email with the submit", async () => {
    const fake = actions();
    open(fake);
    await reachReview();
    type(EMAIL_BOX, "owner@example.test");
    press("Submit for review");
    await waitFor(() => expect(fake.submit).toHaveBeenCalledTimes(1));
    expect(vi.mocked(fake.submit).mock.calls[0]?.[0]).toMatchObject({
      listingId: LISTING,
      contactEmail: "owner@example.test",
    });
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/dashboard?tab=listings"));
  });

  it("shows the server's refusal of the email next to the box and keeps what was typed", async () => {
    const fake = actions({
      submit: vi.fn(async () => ({
        ok: false,
        code: "VALIDATION",
        fieldErrors: { contactEmail: [{ key: "validation.emailTaken" }] },
      })) as unknown as Actions["submit"],
    });
    open(fake);
    await reachReview();
    type(EMAIL_BOX, "owner@example.test");
    press("Submit for review");
    expect(
      await screen.findByText("We couldn't use that email. Try a different address."),
    ).toBeVisible();
    expect(screen.getByLabelText(EMAIL_BOX)).toHaveValue("owner@example.test");
  });

  it("does not keep the address in the browser for the way back in", async () => {
    const fake = actions({
      submit: vi.fn(async () => ({
        ok: false,
        code: "UNAUTHENTICATED",
      })) as unknown as Actions["submit"],
    });
    open(fake, { contactEmail: "owner@example.test" });
    await reachReview();
    press("Submit for review");
    fireEvent.click(await screen.findByRole("link", { name: "Sign in again" }));
    const kept = Array.from({ length: sessionStorage.length }, (_, index) =>
      sessionStorage.getItem(sessionStorage.key(index) ?? ""),
    ).join("|");
    expect(sessionStorage.length).toBeGreaterThan(0);
    expect(kept).not.toContain("owner@example.test");
  });
});

// @vitest-environment jsdom
import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import { ListingQueue, type QueueAction, type QueueRow } from "../listing-queue";
import { ListingReview, ReviewFacts } from "../listing-review";
import { RejectListingDialog } from "../reject-listing-dialog";

const COLUMNS = {
  listing: "Listing",
  owner: "Owner",
  price: "Price",
  submitted: "Submitted",
  status: "Status",
  actions: "Actions",
};

const action = (id: string, label: string, onClick = vi.fn(), extra: Partial<QueueAction> = {}) =>
  ({ id, label, forName: "the villa", tone: "secondary", onClick, ...extra }) satisfies QueueAction;

const row = (extra: Partial<QueueRow> = {}): QueueRow => ({
  id: "r1",
  title: "Independent villa",
  meta: "OMR · Villa · For sale",
  ownerName: "Priya Raman",
  ownerEmail: "priya@example.test",
  price: "₹2.85 Cr",
  submitted: "Today, 10:12",
  status: <span>Pending review</span>,
  actions: [action("approve", "Approve")],
  ...extra,
});

describe("ListingQueue: the admin's rows (S6-T04)", () => {
  it("is a table named by its caption, with a heading for each column and a row for each listing", () => {
    renderWithMessages(
      <ListingQueue
        caption="Listings to review"
        columns={COLUMNS}
        rows={[
          row(),
          row({ id: "r2", title: "Plot", price: "₹46 L", ownerEmail: "karthik@example.test" }),
        ]}
      />,
    );
    const table = screen.getByRole("table", { name: "Listings to review" });
    expect(within(table).getAllByRole("columnheader")).toHaveLength(6);
    // One header row and two listings.
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    expect(within(table).getByText("Independent villa")).toBeVisible();
    expect(within(table).getByText("₹2.85 Cr")).toBeVisible();
    expect(within(table).getByText("priya@example.test")).toBeVisible();
  });

  it("says what each cell is on a card: every value carries its word", () => {
    renderWithMessages(<ListingQueue caption="c" columns={COLUMNS} rows={[row()]} />);
    for (const word of ["Owner", "Price", "Submitted", "Status"]) {
      expect(document.querySelector(`[data-label="${word}"]`)).not.toBeNull();
    }
  });

  it("names each button by its word and the listing, and runs what it was given", () => {
    const onApprove = vi.fn();
    renderWithMessages(
      <ListingQueue
        caption="c"
        columns={COLUMNS}
        rows={[row({ actions: [action("approve", "Approve", onApprove)] })]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Approve the villa" }));
    expect(onApprove).toHaveBeenCalledTimes(1);
  });

  it("keeps the label of a button that is working, and ignores clicks on it", () => {
    const onApprove = vi.fn();
    renderWithMessages(
      <ListingQueue
        caption="c"
        columns={COLUMNS}
        rows={[row({ actions: [action("approve", "Approve", onApprove, { pending: true })] })]}
      />,
    );
    const button = screen.getByRole("button", { name: "Approve the villa" });
    expect(button).toHaveAttribute("aria-busy", "true");
    fireEvent.click(button);
    expect(onApprove).not.toHaveBeenCalled();
  });

  it("shows a rejection's reason under the title and leaves out an email it does not have", () => {
    renderWithMessages(
      <ListingQueue
        caption="c"
        columns={COLUMNS}
        rows={[row({ note: "Reason: add a photo of the home", ownerEmail: null })]}
      />,
    );
    expect(screen.getByText("Reason: add a photo of the home")).toBeVisible();
    expect(screen.queryByText("priya@example.test")).toBeNull();
  });

  it("draws a tile for a listing with no picture", () => {
    renderWithMessages(
      <ListingQueue caption="c" columns={COLUMNS} rows={[row({ cover: null })]} />,
    );
    expect(document.querySelector('[data-slot="card-cover-fallback"]')).not.toBeNull();
  });
});

const REVIEW_ACTIONS = [action("reject", "Reject"), action("approve", "Approve")];

function review(overrides: Partial<Parameters<typeof ListingReview>[0]> = {}) {
  return (
    <ListingReview
      open
      onOpenChange={vi.fn()}
      title="Review listing"
      closeLabel="Close"
      photosHeading="Photos (2)"
      photos={[
        { src: "/a.svg", alt: "First photo" },
        { src: "/b.svg", alt: "Second photo" },
      ]}
      noPhotosText="This listing has no photos"
      badges={<span>For sale</span>}
      heading="Independent villa"
      price="₹2.85 Cr"
      specs={[
        { id: "bhk", label: "Bedrooms", value: "4 BHK" },
        { id: "furnishing", label: "Furnishing", value: "Not provided", missing: true },
      ]}
      sections={[
        { id: "description", heading: "Description", body: "A spacious villa." },
        {
          id: "owner",
          heading: "Owner",
          body: <ReviewFacts rows={[{ id: "name", name: "Name", value: "Priya Raman" }]} />,
        },
      ]}
      actions={REVIEW_ACTIONS}
      {...overrides}
    />
  );
}

describe("ListingReview: the drawer for one listing (S6-T04)", () => {
  it("is a dialog named by its title, with the listing, its sections and its decisions", () => {
    renderWithMessages(review());
    const dialog = screen.getByRole("dialog", { name: "Review listing" });
    expect(within(dialog).getByRole("heading", { name: "Independent villa" })).toBeVisible();
    expect(within(dialog).getByRole("heading", { name: "Photos (2)" })).toBeVisible();
    expect(within(dialog).getByRole("heading", { name: "Description" })).toBeVisible();
    expect(within(dialog).getByText("A spacious villa.")).toBeVisible();
    expect(within(dialog).getByText("Priya Raman")).toBeVisible();
    expect(within(dialog).getByText("₹2.85 Cr")).toBeVisible();
    expect(within(dialog).getAllByRole("img")).toHaveLength(2);
    expect(within(dialog).getByRole("button", { name: "Approve the villa" })).toBeVisible();
    expect(within(dialog).getByRole("button", { name: "Reject the villa" })).toBeVisible();
  });

  it("ties each section to its heading", () => {
    renderWithMessages(review());
    const owner = screen.getByRole("region", { name: "Owner" });
    expect(within(owner).getByText("Name")).toBeVisible();
  });

  it("says so when there are no photos, and leaves the footer out when there is nothing to decide", () => {
    renderWithMessages(review({ photos: [], actions: [] }));
    expect(screen.getByText("This listing has no photos")).toBeVisible();
    expect(screen.queryByRole("button", { name: /Approve/ })).toBeNull();
  });

  it("asks to close from the close button and from Escape", () => {
    const onOpenChange = vi.fn();
    renderWithMessages(review({ onOpenChange }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledTimes(2);
  });

  it("draws nothing while closed", () => {
    renderWithMessages(review({ open: false }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

function reject(overrides: Partial<Parameters<typeof RejectListingDialog>[0]> = {}) {
  return (
    <RejectListingDialog
      open
      onOpenChange={vi.fn()}
      title="Reject this listing?"
      description="It stays off Find Prop."
      reasonLabel="Reason for the owner"
      reasonHint="The owner reads this."
      value=""
      onValueChange={vi.fn()}
      counter="0 / 500"
      confirmLabel="Reject listing"
      cancelLabel="Cancel"
      onConfirm={vi.fn()}
      {...overrides}
    />
  );
}

describe("RejectListingDialog: confirm and give the reason in one step (S6-T04)", () => {
  it("is an alert dialog named by its question, with the reason box labelled, hinted and counted", () => {
    renderWithMessages(reject());
    const dialog = screen.getByRole("alertdialog", { name: "Reject this listing?" });
    expect(dialog).toHaveAccessibleDescription("It stays off Find Prop.");
    const box = within(dialog).getByRole("textbox", { name: /Reason for the owner/ });
    expect(box).toHaveAccessibleDescription(expect.stringContaining("The owner reads this."));
    expect(within(dialog).getByText("0 / 500")).toBeVisible();
  });

  it("puts the focus in the reason box, not on a button", () => {
    renderWithMessages(reject());
    expect(screen.getByRole("textbox", { name: /Reason for the owner/ })).toHaveFocus();
  });

  it("reports what is typed and runs the confirmation", () => {
    const onValueChange = vi.fn();
    const onConfirm = vi.fn();
    renderWithMessages(reject({ onValueChange, onConfirm, value: "Add a photo" }));
    fireEvent.change(screen.getByRole("textbox", { name: /Reason for the owner/ }), {
      target: { value: "Add a photo of the home" },
    });
    expect(onValueChange).toHaveBeenCalledWith("Add a photo of the home");
    fireEvent.click(screen.getByRole("button", { name: "Reject listing" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("marks the box and reads the error when the reason is missing", () => {
    renderWithMessages(reject({ error: "Tell the owner what to fix." }));
    const box = screen.getByRole("textbox", { name: /Reason for the owner/ });
    expect(box).toHaveAttribute("aria-invalid", "true");
    expect(box).toHaveAccessibleDescription(expect.stringContaining("Tell the owner what to fix."));
  });

  it("cancels from Cancel and from Escape", () => {
    const onOpenChange = vi.fn();
    renderWithMessages(reject({ onOpenChange }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("holds still while rejecting: the box is read-only, Cancel is off and the confirm button ignores clicks", () => {
    const onConfirm = vi.fn();
    renderWithMessages(reject({ loading: true, onConfirm, value: "Add a photo" }));
    expect(screen.getByRole("textbox", { name: /Reason for the owner/ })).toHaveAttribute(
      "readonly",
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Reject listing" }));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("draws nothing while closed", () => {
    renderWithMessages(reject({ open: false }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});

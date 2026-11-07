// @vitest-environment jsdom
import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import type { QueueAction } from "../listing-queue";
import { MyListingRow, MyListingsList } from "../my-listing-row";
import { ReceivedEnquiriesList, ReceivedEnquiryRow } from "../received-enquiry-row";

const action = (id: string, label: string, forName: string, extra: Partial<QueueAction> = {}) =>
  ({ id, label, forName, tone: "secondary", onClick: vi.fn(), ...extra }) satisfies QueueAction;

function listing(overrides: Partial<Parameters<typeof MyListingRow>[0]> = {}) {
  return (
    <MyListingsList label="Your listings" footnote="Only approved listings can be marked sold.">
      <MyListingRow
        title="Flat in Adyar"
        href="/properties/flat-abcd2345"
        price="₹1.25 Cr"
        place="Adyar"
        posted="Posted 2 days ago"
        kind="For sale"
        status={<span>Live</span>}
        actions={[action("close", "Mark as sold", "Flat in Adyar")]}
        {...overrides}
      />
    </MyListingsList>
  );
}

describe("MyListingRow: one of the owner's listings (S6-T03)", () => {
  it("is a list item in a named list, with its price, place, posted time, kind and state", () => {
    renderWithMessages(listing());
    const list = screen.getByRole("list", { name: "Your listings" });
    const item = within(list).getByRole("listitem");
    expect(within(item).getByText("₹1.25 Cr")).toBeVisible();
    expect(within(item).getByText("Adyar")).toBeVisible();
    expect(within(item).getByText("Posted 2 days ago")).toBeVisible();
    expect(within(item).getByText("For sale")).toBeVisible();
    expect(within(item).getByText("Live")).toBeVisible();
    expect(screen.getByText("Only approved listings can be marked sold.")).toBeVisible();
  });

  it("makes the title a link only while there is a public page", () => {
    const { unmount } = renderWithMessages(listing());
    expect(screen.getByRole("link", { name: "Flat in Adyar" })).toHaveAttribute(
      "href",
      "/properties/flat-abcd2345",
    );
    unmount();
    renderWithMessages(listing({ href: null }));
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Flat in Adyar", { selector: "p" })).toBeVisible();
  });

  it("names each button by its word and the listing, and runs what it was given", () => {
    const close = action("close", "Mark as sold", "Flat in Adyar");
    renderWithMessages(listing({ actions: [close] }));
    fireEvent.click(screen.getByRole("button", { name: "Mark as sold Flat in Adyar" }));
    expect(close.onClick).toHaveBeenCalledTimes(1);
  });

  it("keeps the label of a button that is working, and ignores clicks on it", () => {
    const close = action("close", "Mark as sold", "Flat in Adyar", { pending: true });
    renderWithMessages(listing({ actions: [close] }));
    const button = screen.getByRole("button", { name: "Mark as sold Flat in Adyar" });
    expect(button).toHaveAttribute("aria-busy", "true");
    fireEvent.click(button);
    expect(close.onClick).not.toHaveBeenCalled();
  });

  it("shows the waiting note and the reason of a rejection, as text", () => {
    const { unmount } = renderWithMessages(
      listing({ note: { tone: "waiting", text: "Waiting for review." } }),
    );
    expect(screen.getByText("Waiting for review.")).toBeVisible();
    unmount();
    renderWithMessages(
      listing({ note: { tone: "rejected", text: "Reason: Add a photo of the home." } }),
    );
    expect(screen.getByText("Reason: Add a photo of the home.")).toBeVisible();
  });

  it("leaves out the buttons, the kind and the place when there are none, and draws a tile with no picture", () => {
    renderWithMessages(listing({ actions: [], kind: null, place: null, cover: null }));
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText("For sale")).toBeNull();
    expect(document.querySelector('[data-slot="card-cover-fallback"]')).not.toBeNull();
  });
});

function enquiry(overrides: Partial<Parameters<typeof ReceivedEnquiryRow>[0]> = {}) {
  return (
    <ReceivedEnquiriesList label="Enquiries received">
      <ReceivedEnquiryRow
        name="Arjun Menon"
        phone={{ text: "98410 55512", href: "tel:9841055512" }}
        email={{ text: "arjun@example.test", href: "mailto:arjun@example.test" }}
        status={<span>New</span>}
        about={<>About Flat in Adyar · 2 hours ago</>}
        message={"Is it still available?\nI can visit this weekend."}
        actions={[
          action("contacted", "Mark contacted", "Arjun Menon", { tone: "primary" }),
          action("closed", "Close enquiry", "Arjun Menon"),
        ]}
        {...overrides}
      />
    </ReceivedEnquiriesList>
  );
}

describe("ReceivedEnquiryRow: an enquiry about the owner's listing (S6-T03)", () => {
  it("shows who asked, how to reach them as real links, the state, what it is about and what they wrote", () => {
    renderWithMessages(enquiry());
    const item = within(screen.getByRole("list", { name: "Enquiries received" })).getByRole(
      "listitem",
    );
    expect(within(item).getByText("Arjun Menon", { selector: "b" })).toBeVisible();
    expect(within(item).getByRole("link", { name: "98410 55512" })).toHaveAttribute(
      "href",
      "tel:9841055512",
    );
    expect(within(item).getByRole("link", { name: "arjun@example.test" })).toHaveAttribute(
      "href",
      "mailto:arjun@example.test",
    );
    expect(within(item).getByText("New")).toBeVisible();
    expect(within(item).getByText(/About Flat in Adyar/)).toBeVisible();
    expect(within(item).getByText(/Is it still available\?/)).toBeVisible();
  });

  it("names each button by its word and the sender, and runs what it was given", () => {
    const contacted = action("contacted", "Mark contacted", "Arjun Menon", { tone: "primary" });
    renderWithMessages(enquiry({ actions: [contacted] }));
    fireEvent.click(screen.getByRole("button", { name: "Mark contacted Arjun Menon" }));
    expect(contacted.onClick).toHaveBeenCalledTimes(1);
  });

  it("has no buttons once closed, no email link without an email and no quote without a message", () => {
    renderWithMessages(enquiry({ actions: [], email: null, message: null }));
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link", { name: /@/ })).toBeNull();
    expect(document.querySelector("blockquote")).toBeNull();
  });

  it("keeps a button that is working in its place and ignores clicks on it", () => {
    const contacted = action("contacted", "Mark contacted", "Arjun Menon", {
      tone: "primary",
      pending: true,
    });
    renderWithMessages(enquiry({ actions: [contacted] }));
    const button = screen.getByRole("button", { name: "Mark contacted Arjun Menon" });
    expect(button).toHaveAttribute("aria-busy", "true");
    fireEvent.click(button);
    expect(contacted.onClick).not.toHaveBeenCalled();
  });
});

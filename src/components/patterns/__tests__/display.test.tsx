// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Link } from "@/components/ui/link";
import { STATUS_TONES } from "@/config/status-map";
import messages from "@/i18n/messages/en.json";
import { renderWithMessages } from "../../../../tests/render-intl";
import { Alert } from "../alert";
import { Breadcrumb } from "../breadcrumb";
import { EmptyState } from "../empty-state";
import { PriceDisplay } from "../price-display";
import { PropertyMeta } from "../property-meta";
import { ShowMore } from "../show-more";
import { SpecTile } from "../spec-tile";
import { StatTile } from "../stat-tile";
import { StatusBadge } from "../status-badge";
import { Stepper } from "../stepper";

describe("PriceDisplay", () => {
  it("formats a sale price in lakh and crore", () => {
    renderWithMessages(<PriceDisplay rupees={78_00_000} />);
    expect(screen.getByText("₹78 L")).toBeInTheDocument();
  });

  it("adds /mo for rent and ignores a per sq.ft figure", () => {
    renderWithMessages(<PriceDisplay rupees={48_000} listingType="rent" perSqftRupees={6500} />);
    expect(screen.getByText("₹48,000/mo")).toBeInTheDocument();
    expect(screen.queryByText(/per sq\.ft/)).not.toBeInTheDocument();
  });

  it("shows the per sq.ft line for a sale", () => {
    renderWithMessages(<PriceDisplay rupees={1_25_00_000} perSqftRupees={6500} size="large" />);
    expect(screen.getByText("₹1.25 Cr")).toHaveClass("text-price-lg");
    expect(screen.getByText("₹6,500 per sq.ft")).toBeInTheDocument();
  });
});

describe("PropertyMeta", () => {
  it("shows the known facts in order", () => {
    renderWithMessages(
      <PropertyMeta
        bedrooms={3}
        bathrooms={2}
        areaSqft={1450}
        furnishing="Semi-furnished"
        propertyType="Apartment"
      />,
    );
    const items = screen.getAllByRole("listitem").map((item) => item.textContent);
    expect(items).toEqual(["3 BHK", "2 baths", "1,450 sq.ft", "Semi-furnished", "Apartment"]);
  });

  it("leaves out anything missing, and says 1 bath in the singular", () => {
    renderWithMessages(<PropertyMeta bedrooms={null} bathrooms={1} areaSqft={undefined} />);
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual(["1 bath"]);
  });

  it("renders nothing when there are no facts", () => {
    const { container } = renderWithMessages(<PropertyMeta />);
    expect(container.querySelector("ul")).not.toBeInTheDocument();
  });
});

describe("StatusBadge", () => {
  it("shows the status as a word with the tone from the status map", () => {
    renderWithMessages(<StatusBadge kind="listing" status="pendingReview" />);
    const badge = screen.getByText("Pending review");
    expect(badge).toHaveClass("bg-warning-tint", "text-warning", "before:rounded-pill");
  });

  it("has a word in en.json for every status in the map", () => {
    const words = messages.status as Record<string, Record<string, string>>;
    for (const [kind, statuses] of Object.entries(STATUS_TONES)) {
      for (const status of Object.keys(statuses)) {
        expect(words[kind]?.[status], `${kind}.${status}`).toBeTruthy();
      }
    }
  });

  it("covers the statuses named in the requirements", () => {
    renderWithMessages(
      <>
        <StatusBadge kind="listing" status="notApproved" />
        <StatusBadge kind="enquiry" status="waitingForOwner" />
        <StatusBadge kind="unit" status="onHold" />
      </>,
    );
    expect(screen.getByText("Not approved")).toHaveClass("text-danger");
    expect(screen.getByText("Waiting for owner")).toHaveClass("text-warning");
    expect(screen.getByText("On hold")).toBeInTheDocument();
  });
});

describe("ShowMore", () => {
  it("shows progress and a button that asks for more", async () => {
    const onShowMore = vi.fn();
    render(
      <ShowMore
        shown={12}
        total={48}
        progressLabel="Showing 12 of 48"
        buttonLabel="Show more homes"
        onShowMore={onShowMore}
      />,
    );
    expect(screen.getByRole("progressbar", { name: "Showing 12 of 48" })).toHaveAttribute(
      "value",
      "12",
    );
    expect(screen.getByText("Showing 12 of 48", { selector: "p" })).toHaveAttribute(
      "aria-live",
      "polite",
    );
    await userEvent.click(screen.getByRole("button", { name: "Show more homes" }));
    expect(onShowMore).toHaveBeenCalledTimes(1);
  });

  it("drops the button when everything is shown", () => {
    render(
      <ShowMore
        shown={48}
        total={48}
        progressLabel="Showing 48 of 48"
        buttonLabel="Show more homes"
        onShowMore={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("EmptyState, Alert, StatTile and SpecTile", () => {
  it("shows a heading, a sentence and one next step", () => {
    render(
      <EmptyState title="No saved homes yet" description="Tap the heart on a home to keep it here.">
        <Link href="/properties">Browse homes</Link>
      </EmptyState>,
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "No saved homes yet" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse homes" })).toBeInTheDocument();
  });

  it("takes an h1 for a page that has no other heading", () => {
    render(<EmptyState as="h1" title="Property not found" description="The link may be wrong." />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Property not found" }),
    ).toBeInTheDocument();
  });

  it("reads an error alert at once and the other tones politely", () => {
    render(
      <>
        <Alert tone="danger" title="Could not save">
          Try again.
        </Alert>
        <Alert tone="success">Saved.</Alert>
      </>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Could not save");
    expect(screen.getByRole("status")).toHaveTextContent("Saved.");
  });

  it("shows a stat with its note, and a needs-attention tint", () => {
    render(<StatTile label="Pending review" value={7} note="Oldest: 3 days" attention />);
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("Oldest: 3 days")).toBeInTheDocument();
    expect(screen.getByText("Pending review").parentElement?.parentElement).toHaveClass(
      "bg-warning-tint",
    );
  });

  it("shows a spec and a quiet missing value", () => {
    render(
      <>
        <SpecTile label="Facing" value="East" />
        <SpecTile label="Floor" value="Not provided" missing />
      </>,
    );
    expect(screen.getByText("East")).toHaveClass("text-ink");
    expect(screen.getByText("Not provided")).toHaveClass("text-subtle");
  });
});

describe("Breadcrumb", () => {
  const items = [
    { label: "Home", href: "/" },
    { label: "Properties", href: "/properties" },
    { label: "Velachery" },
  ];

  it("marks the last item as the current page and links the others", () => {
    render(<Breadcrumb items={items} navLabel="Breadcrumb" backLabel="Back to Properties" />);
    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(nav).toBeInTheDocument();
    expect(screen.getByText("Velachery")).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
  });

  it("offers a single back link to the parent page for small screens", () => {
    render(<Breadcrumb items={items} navLabel="Breadcrumb" backLabel="Back to Properties" />);
    const back = screen.getByRole("link", { name: "Back to Properties" });
    expect(back).toHaveAttribute("href", "/properties");
    expect(back).toHaveClass("lg:hidden");
  });
});

describe("Stepper", () => {
  const steps = [
    { label: "Basics", state: "done", stateLabel: "Done" },
    { label: "Details", description: "Rooms and area", state: "current" },
    { label: "Photos", state: "error", stateLabel: "Needs attention" },
    { label: "Review", state: "upcoming" },
  ] as const;

  it("is an ordered list with the current step marked", () => {
    render(<Stepper steps={[...steps]} progressLabel="Step 2 of 4: Details" />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(4);
    expect(items[1]).toHaveAttribute("aria-current", "step");
    expect(items[0]).not.toHaveAttribute("aria-current");
  });

  it("says a step's state in words, not only by colour", () => {
    render(<Stepper steps={[...steps]} progressLabel="Step 2 of 4: Details" />);
    expect(screen.getByText("Done")).toHaveClass("sr-only");
    expect(screen.getByText("Needs attention")).toHaveClass("sr-only");
  });

  it("gives phones a named progress bar", () => {
    render(<Stepper steps={[...steps]} progressLabel="Step 2 of 4: Details" />);
    expect(screen.getByRole("img", { name: "Step 2 of 4: Details" })).toBeInTheDocument();
  });
});

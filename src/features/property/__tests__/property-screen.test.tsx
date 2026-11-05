// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import en from "@/i18n/messages/en.json";
import { renderWithMessages } from "../../../../tests/render-intl";
import { MobileEnquiry } from "../mobile-enquiry.client";
import { PropertyEnquiryCard } from "../property-enquiry";
import { PropertyNotFound } from "../property-not-found";
import { PropertyScreen } from "../property-screen";
import { PropertySkeleton } from "../property-skeleton";
import type { PropertyData } from "../types";

const words = en.property.page;
const card = en.domain.enquiry;

const HOME: PropertyData = {
  id: "00000000-0000-4000-8000-000000000001",
  shortId: "k3x9a2bd",
  slug: "3-bhk-apartment-velachery",
  listingType: "sale",
  propertyType: "apartment",
  title: "3 BHK apartment with clubhouse and covered parking",
  description: "A bright east-facing apartment.\n\nResidents share a clubhouse.",
  bedrooms: 3,
  bathrooms: 2,
  areaSqft: 1420,
  price: 12_500_000,
  furnishing: "semi",
  amenities: ["Gym", "Swimming Pool", "Lift"],
  availableFrom: null,
  locality: "Velachery",
  city: "Chennai",
  state: "Tamil Nadu",
  featured: true,
  label: "featured",
  ageDays: 2,
  photos: [
    { path: "a/1.webp", alt: "Living room" },
    { path: "a/2.webp", alt: null },
  ],
};

const SOURCES = ["/photos/1.webp", "/photos/2.webp"];

function screenFor(property: PropertyData, slots: { enquiry?: string; bar?: string } = {}) {
  return renderWithMessages(
    <PropertyScreen
      property={property}
      photoSources={SOURCES.slice(0, property.photos.length)}
      enquiry={<p>{slots.enquiry ?? "the enquiry card"}</p>}
      mobileEnquiry={<p>{slots.bar ?? "the phone bar"}</p>}
    />,
  );
}

describe("PropertyScreen: a full listing (S4-T03)", () => {
  it("has the title as the page's heading, the place and how long ago it was listed", () => {
    screenFor(HOME);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "3 BHK apartment with clubhouse and covered parking",
      }),
    ).toBeVisible();
    expect(screen.getByText("Velachery, Chennai · Listed 2 days ago")).toBeVisible();
  });

  it("draws the trail Home, Properties, locality, and a way back to the results", () => {
    screenFor(HOME);
    const trail = screen.getByRole("navigation", { name: words.crumb.nav });
    expect(within(trail).getByRole("link", { name: words.crumb.home })).toHaveAttribute(
      "href",
      "/",
    );
    expect(within(trail).getAllByRole("link", { name: words.crumb.properties })[0]).toHaveAttribute(
      "href",
      "/properties",
    );
    expect(within(trail).getByText("Velachery")).toHaveAttribute("aria-current", "page");
    expect(within(trail).getByRole("link", { name: words.crumb.back })).toBeInTheDocument();
  });

  it("shows For sale and the label over the photos and in the price card", () => {
    screenFor(HOME);
    expect(screen.getAllByText(en.domain.propertyCard.forSale).length).toBeGreaterThanOrEqual(2);
    expect(
      screen.getAllByText(en.domain.propertyCard.label.featured).length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("shows For rent, and no label when the home has none", () => {
    screenFor({ ...HOME, listingType: "rent", price: 48_000, label: null, featured: false });
    expect(screen.getAllByText(en.domain.propertyCard.forRent).length).toBeGreaterThan(0);
    expect(screen.queryByText(en.domain.propertyCard.label.featured)).not.toBeInTheDocument();
  });

  it("lists the facts in the UX order with their words", () => {
    screenFor(HOME);
    const section = screen.getByRole("region", { name: words.specs.heading });
    const text = section.textContent ?? "";
    const order = [
      "Bedrooms",
      "3 BHK",
      "Bathrooms",
      "Area",
      "1,420 sq.ft",
      "Property type",
      "Apartment",
      "Furnishing",
      "Semi-furnished",
      "Listed",
      "2 days ago",
    ].map((part) => text.indexOf(part));
    expect(order.every((position) => position >= 0)).toBe(true);
    expect([...order].sort((first, second) => first - second)).toEqual(order);
    expect(screen.queryByText(words.specs.leftOut)).not.toBeInTheDocument();
  });

  it("shows the description as paragraphs and the amenities as a list", () => {
    screenFor(HOME);
    expect(screen.getByRole("heading", { level: 2, name: words.about })).toBeVisible();
    expect(screen.getByText("A bright east-facing apartment.")).toBeVisible();
    expect(screen.getByText("Residents share a clubhouse.")).toBeVisible();
    const amenities = screen.getByRole("region", { name: words.amenities });
    expect(
      within(amenities)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Gym", "Swimming Pool", "Lift"]);
  });

  it("shows the description as text, never as markup", () => {
    screenFor({ ...HOME, description: "<img src=x onerror=alert(1)> <b>bold</b>" });
    expect(screen.getByText("<img src=x onerror=alert(1)> <b>bold</b>")).toBeVisible();
    expect(document.querySelector("img[onerror]")).toBeNull();
  });

  it("has the gallery with the owner's words for a photo, or one made from the title", () => {
    screenFor(HOME);
    const gallery = screen.getByRole("group", { name: "Photos" });
    expect(
      within(gallery)
        .getAllByRole("img", { hidden: true })
        .map((image) => image.getAttribute("alt")),
    ).toEqual(
      expect.arrayContaining([
        "Living room",
        "3 BHK apartment with clubhouse and covered parking: photo 2",
      ]),
    );
  });

  it("puts the price card and the enquiry beside the details, with the note, and the phone bar after", () => {
    screenFor(HOME);
    const aside = screen.getByRole("complementary", { name: words.aside.label });
    expect(within(aside).getByText("₹1.25 Cr")).toBeVisible();
    expect(within(aside).getByText("₹8,803 per sq.ft")).toBeVisible();
    expect(within(aside).getByText("the enquiry card")).toBeVisible();
    expect(within(aside).getByText(words.aside.note)).toBeVisible();
    expect(screen.getByText("the phone bar")).toBeInTheDocument();
  });

  it("has no Save or Add to compare buttons yet", () => {
    screenFor(HOME);
    expect(screen.queryByRole("button", { name: /compare|save/i })).not.toBeInTheDocument();
  });
});

describe("PropertyScreen: a sparse listing (S4-T03)", () => {
  const SPARSE: PropertyData = {
    ...HOME,
    title:
      "Beautifully maintained, east-facing 3 BHK apartment with a double-height living room, private lift lobby and a landscaped terrace garden in a quiet lane off Velachery Main Road",
    bathrooms: null,
    furnishing: null,
    amenities: [],
    areaSqft: null,
    label: "prime",
    ageDays: 21,
    photos: [{ path: "a/1.webp", alt: null }],
  };

  it("leaves out what is missing and says so once, instead of showing blanks or zeros", () => {
    screenFor(SPARSE);
    const section = screen.getByRole("region", { name: words.specs.heading });
    for (const gone of ["Bathrooms", "Area", "Furnishing"]) {
      expect(within(section).queryByText(gone)).not.toBeInTheDocument();
    }
    expect(within(section).getByText("Bedrooms")).toBeVisible();
    expect(within(section).getByText("21 days ago")).toBeVisible();
    expect(screen.getByText(words.specs.leftOut)).toBeVisible();
    expect(screen.queryByRole("region", { name: words.amenities })).not.toBeInTheDocument();
  });

  it("keeps a long title in the heading and has no price per square foot without an area", () => {
    screenFor(SPARSE);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(SPARSE.title);
    expect(screen.queryByText(/per sq\.ft/)).not.toBeInTheDocument();
  });

  it("leaves out the description section when there is none, and the place when it is not known", () => {
    screenFor({ ...SPARSE, description: null, locality: null, city: null });
    expect(screen.queryByRole("heading", { name: words.about })).not.toBeInTheDocument();
    expect(screen.getByText("Listed 21 days ago")).toBeVisible();
    const trail = screen.getByRole("navigation", { name: words.crumb.nav });
    expect(within(trail).getByText(words.crumb.properties)).toHaveAttribute("aria-current", "page");
  });

  it("shows a plot with no bedrooms row", () => {
    screenFor({ ...HOME, propertyType: "plot", bedrooms: null });
    const section = screen.getByRole("region", { name: words.specs.heading });
    expect(within(section).queryByText("Bedrooms")).not.toBeInTheDocument();
    expect(within(section).getByText("Plot / Land")).toBeVisible();
  });
});

describe("PropertyEnquiryCard: the gate and the form (S4-T03)", () => {
  it("asks a visitor who is not signed in to sign in, with the two links it is given", () => {
    renderWithMessages(
      <PropertyEnquiryCard
        signedIn={false}
        signInHref="/auth?gate=enquire"
        createAccountHref="/auth"
      />,
    );
    expect(screen.getByRole("link", { name: card.gate.signIn })).toHaveAttribute(
      "href",
      "/auth?gate=enquire",
    );
    expect(screen.getByRole("link", { name: card.gate.createAccount })).toHaveAttribute(
      "href",
      "/auth",
    );
  });

  it("gives a signed-in visitor the real form with Send switched off and a line that says so", () => {
    renderWithMessages(
      <PropertyEnquiryCard signedIn signInHref="/auth" createAccountHref="/auth" />,
    );
    expect(screen.getByRole("textbox", { name: /Your name/ })).toBeEnabled();
    const send = screen.getByRole("button", { name: card.form.send });
    expect(send).toBeDisabled();
    expect(send).toHaveAccessibleDescription(words.enquiry.notOpen);
  });
});

describe("MobileEnquiry: the sticky bar and the sheet (S4-T03)", () => {
  const BAR = { rupees: 12_500_000, listingType: "sale" as const, perSqftRupees: 8803 };

  it("gives a visitor who is not signed in a link to sign in, and no sheet", () => {
    renderWithMessages(
      <MobileEnquiry
        signedIn={false}
        signInHref="/auth?gate=enquire"
        createAccountHref="/auth"
        {...BAR}
      />,
    );
    expect(screen.getByRole("link", { name: words.enquiry.signInToEnquire })).toHaveAttribute(
      "href",
      "/auth?gate=enquire",
    );
    expect(screen.getByText("₹1.25 Cr")).toBeVisible();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the enquiry sheet from Enquire for a signed-in visitor, with Send switched off", async () => {
    renderWithMessages(
      <MobileEnquiry signedIn signInHref="/auth" createAccountHref="/auth" {...BAR} />,
    );
    await userEvent.click(screen.getByRole("button", { name: words.enquiry.enquire }));
    const sheet = screen.getByRole("dialog", { name: card.form.title });
    const send = within(sheet).getByRole("button", { name: card.form.send });
    expect(send).toBeDisabled();
    expect(send).toHaveAccessibleDescription(words.enquiry.notOpen);
  });
});

describe("PropertyNotFound and PropertySkeleton (S4-T03)", () => {
  it("says the property was not found, why, and leads to the homes that are available", () => {
    renderWithMessages(<PropertyNotFound />);
    expect(screen.getByRole("heading", { level: 1, name: words.notFound.title })).toBeVisible();
    expect(screen.getByText(words.notFound.body)).toBeVisible();
    expect(screen.getByRole("link", { name: words.notFound.browse })).toHaveAttribute(
      "href",
      "/properties",
    );
  });

  it("is a busy, named loading block with no readable content inside", () => {
    renderWithMessages(<PropertySkeleton />);
    const block = screen.getByRole("status", { name: words.loading });
    expect(block).toHaveAttribute("aria-busy", "true");
    expect(block.textContent).toBe("");
  });
});

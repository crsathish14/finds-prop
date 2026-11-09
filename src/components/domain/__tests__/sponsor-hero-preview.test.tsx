// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SiteContentLayout } from "../site-content-layout";
import { SiteHeroFields, type SiteHeroFieldsWords } from "../site-hero-fields";
import { SiteHeroPreview } from "../site-hero-preview";
import { SponsorHeroPreview, type SponsorHeroPreviewProps } from "../sponsor-hero-preview";

const WORDS: SponsorHeroPreviewProps["words"] = {
  device: "Preview size",
  desktop: "Desktop",
  phone: "Phone",
  sponsored: "Sponsored",
  layouts: { search_desk: "Search Desk", split: "Split" },
  reasons: { no_sponsors: "No sponsors", none_eligible: "Split → Search Desk" },
  none: { title: "No banner is shown", text: "Visitors see the search card alone." },
  phoneNote: "The phone image is used below 1024 px.",
};

const BANNER = { desktop: "/d.png", phone: "/p.png", alt: "Sample" };

const preview = (over: Partial<SponsorHeroPreviewProps> = {}): SponsorHeroPreviewProps => ({
  layout: "search_desk",
  title: "Find the place",
  banner: BANNER,
  caption: "Sample Developer · first of 2 active",
  words: WORDS,
  ...over,
});

const drawing = () => document.querySelector("[data-slot='site-hero-preview']") as HTMLElement;
const picture = () => document.querySelector("img");
const shape = () => picture()?.parentElement as HTMLElement;

describe("UT-sponsor-hero-preview: the hero with the sponsor in it (S7-T11)", () => {
  it("names the layout and the sponsor that shows, and labels the banner as sponsored", () => {
    render(<SponsorHeroPreview {...preview()} />);
    expect(screen.getByText("Search Desk")).toBeInTheDocument();
    expect(screen.getByText("Sample Developer · first of 2 active")).toBeInTheDocument();
    expect(screen.getByText("Sponsored")).toBeInTheDocument();
    expect(drawing()).toHaveAttribute("aria-hidden", "true");
  });

  it("a desktop shows the desktop picture, a phone the phone picture, and the switch changes it", async () => {
    render(<SponsorHeroPreview {...preview()} />);
    expect(picture()?.getAttribute("src")).toContain("d.png");
    expect(screen.getByRole("radio", { name: "Desktop" })).toBeChecked();
    await userEvent.click(screen.getByRole("radio", { name: "Phone" }));
    expect(picture()?.getAttribute("src")).toContain("p.png");
    expect(screen.getByText("The phone image is used below 1024 px.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "Desktop" }));
    expect(picture()?.getAttribute("src")).toContain("d.png");
    expect(screen.queryByText("The phone image is used below 1024 px.")).not.toBeInTheDocument();
  });

  it("starts on the phone when asked to", () => {
    render(<SponsorHeroPreview {...preview({ defaultDevice: "phone" })} />);
    expect(screen.getByRole("radio", { name: "Phone" })).toBeChecked();
    expect(picture()?.getAttribute("src")).toContain("p.png");
  });

  it("keeps the true shape of the strip and of the panel, on a desktop and on a phone", async () => {
    const { rerender } = render(<SponsorHeroPreview {...preview()} />);
    expect(shape()).toHaveStyle({ aspectRatio: String(970 / 90) });
    await userEvent.click(screen.getByRole("radio", { name: "Phone" }));
    expect(shape()).toHaveStyle({ aspectRatio: String(320 / 100) });
    rerender(<SponsorHeroPreview {...preview({ layout: "split" })} />);
    expect(shape()).toHaveStyle({ aspectRatio: String(640 / 320) });
    await userEvent.click(screen.getByRole("radio", { name: "Desktop" }));
    expect(shape()).toHaveStyle({ aspectRatio: String(524 / 494) });
  });

  it("Split puts the banner beside the search on a desktop and under it on a phone", async () => {
    render(<SponsorHeroPreview {...preview({ layout: "split", eyebrow: "Tamil Nadu" })} />);
    expect(drawing()).toHaveAttribute("data-layout", "split");
    expect(screen.getByText("Tamil Nadu")).toBeInTheDocument();
    expect((drawing().firstElementChild as HTMLElement).className).toContain("flex-row");
    await userEvent.click(screen.getByRole("radio", { name: "Phone" }));
    expect((drawing().firstElementChild as HTMLElement).className).toContain("flex-col");
  });

  it("with no banner it says why, draws the search card alone and shows no picture", () => {
    render(
      <SponsorHeroPreview
        {...preview({ layout: "split", banner: null, reason: "none_eligible" })}
      />,
    );
    expect(screen.getByText("Split → Search Desk")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("No banner is shown");
    expect(picture()).toBeNull();
    expect(drawing()).toHaveAttribute("data-layout", "search_desk");
  });

  it("with no sponsors at all the badge says so", () => {
    render(<SponsorHeroPreview {...preview({ banner: null, reason: "no_sponsors" })} />);
    expect(screen.getByText("No sponsors")).toBeInTheDocument();
    expect(screen.queryByText("Sponsored")).not.toBeInTheDocument();
  });

  it("the switch is a named group of two options", () => {
    render(<SponsorHeroPreview {...preview()} />);
    expect(screen.getByRole("radiogroup", { name: "Preview size" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
  });
});

describe("UT-site-hero-preview: the banner place (S7-T11)", () => {
  it("without a banner prop it still draws the plain stand-in, as before", () => {
    render(<SiteHeroPreview title="Hello" layout="split" />);
    expect(drawing().querySelector(".bg-cta-tint")).not.toBeNull();
  });

  it("a null banner draws nothing in its place", () => {
    render(<SiteHeroPreview title="Hello" layout="search_desk" banner={null} />);
    expect(drawing().querySelector(".bg-cta-tint")).toBeNull();
  });

  it("a stacked Split draws the stand-in under the text, full width", () => {
    render(<SiteHeroPreview title="Hello" layout="split" stacked />);
    expect(drawing().querySelector(".h-10.w-full.bg-cta-tint")).not.toBeNull();
  });
});

describe("UT-site-content-layout: the section after the form (S7-T11)", () => {
  it("shows the full-width section between the preview and the save bar", () => {
    render(
      <SiteContentLayout
        title="Hero"
        description="d"
        tabs={[{ key: "hero", label: "Hero", href: "/admin/hero", current: true }]}
        tabsLabel="Site content"
        previewLabel="Preview"
        preview={<p>the-preview</p>}
        after={<p>the-sponsors-section</p>}
        footer={<p>the-save-bar</p>}
      >
        <p>the-form</p>
      </SiteContentLayout>,
    );
    const text = document.body.textContent ?? "";
    expect(text.indexOf("the-form")).toBeLessThan(text.indexOf("the-preview"));
    expect(text.indexOf("the-preview")).toBeLessThan(text.indexOf("the-sponsors-section"));
    expect(text.indexOf("the-sponsors-section")).toBeLessThan(text.indexOf("the-save-bar"));
  });
});

describe("UT-site-hero-fields: the note under the layout cards (S7-T11)", () => {
  const FIELD_WORDS: SiteHeroFieldsWords = {
    text: { title: "Text" },
    layout: {
      title: "Layout",
      description: "Both layouts use the same text.",
      searchDesk: { label: "Search Desk", hint: "strip" },
      split: { label: "Split", hint: "panel" },
    },
    eyebrow: "Eyebrow",
    eyebrowHint: "hint",
    headline: "Headline",
    subtitle: "Subtitle",
    optional: "(optional)",
  };
  const values = { eyebrow: "", title: "T", subtitle: "", layout: "split" } as const;

  it("shows what the page puts under the layout cards", () => {
    render(
      <SiteHeroFields
        values={values}
        onChange={() => undefined}
        words={FIELD_WORDS}
        layoutNote={<p>Live layout: Split</p>}
      />,
    );
    expect(screen.getByText("Live layout: Split")).toBeInTheDocument();
  });

  it("shows nothing extra without it", () => {
    render(<SiteHeroFields values={values} onChange={() => undefined} words={FIELD_WORDS} />);
    expect(screen.queryByText(/Live layout/)).not.toBeInTheDocument();
  });
});

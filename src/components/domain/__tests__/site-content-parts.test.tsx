// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  LinkListField,
  type LinkListWords,
  type LinkRow,
} from "@/components/patterns/link-list-field";
import { SiteContentLayout } from "../site-content-layout";
import {
  SiteFooterFields,
  type SiteFooterFieldsWords,
  type SiteFooterValues,
} from "../site-footer-fields";
import { SiteFooterPreview } from "../site-footer-preview";
import {
  SiteHeaderFields,
  type SiteHeaderFieldsWords,
  type SiteHeaderValues,
} from "../site-header-fields";
import { SiteHeaderPreview } from "../site-header-preview";

const LINK_WORDS: LinkListWords = {
  row: "Link",
  label: "Label",
  link: "Link address",
  add: "Add link",
  remove: "Remove",
  drag: "Drag",
  moveUp: "Move up",
  moveDown: "Move down",
  empty: "No links yet.",
  full: "The list is full.",
};

const row = (id: string, label: string, href: string): LinkRow => ({ id, label, href });
const THREE = [
  row("link-a", "Buy", "/buy"),
  row("link-b", "Rent", "/rent"),
  row("link-c", "Projects", "/projects"),
];

describe("UT-link-list-field: links the admin edits, reorders and removes (S7-T10)", () => {
  const setup = (props: Partial<React.ComponentProps<typeof LinkListField>> = {}) => {
    const onChange = vi.fn();
    render(
      <LinkListField
        title="Navigation links"
        links={THREE}
        onChange={onChange}
        max={5}
        words={LINK_WORDS}
        {...props}
      />,
    );
    return onChange;
  };

  it("names the list and every row by its place, and each box by what it holds", () => {
    setup();
    const list = screen.getByRole("group", { name: "Navigation links" });
    expect(within(list).getByRole("group", { name: "Link 2" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Label 2" })).toHaveValue("Rent");
    expect(screen.getByRole("textbox", { name: "Link address 2" })).toHaveValue("/rent");
  });

  it("changes only the row that was typed in", async () => {
    const onChange = setup();
    await userEvent.type(screen.getByRole("textbox", { name: "Label 2" }), "!");
    expect(onChange).toHaveBeenCalledWith([THREE[0], { ...THREE[1], label: "Rent!" }, THREE[2]]);
    await userEvent.type(screen.getByRole("textbox", { name: "Link address 3" }), "x");
    expect(onChange).toHaveBeenLastCalledWith([
      THREE[0],
      THREE[1],
      { ...THREE[2], href: "/projectsx" },
    ]);
  });

  it("adds an empty row with its own id at the end", async () => {
    const onChange = setup();
    await userEvent.click(screen.getByRole("button", { name: "Add link" }));
    const [next] = onChange.mock.calls[0] as [LinkRow[]];
    expect(next).toHaveLength(4);
    expect(next.slice(0, 3)).toEqual(THREE);
    expect(next[3]).toMatchObject({ label: "", href: "" });
    expect(next[3]?.id).toMatch(/\S/);
    expect(THREE.map((one) => one.id)).not.toContain(next[3]?.id);
  });

  it("removes the row the button names, and no other", async () => {
    const onChange = setup();
    await userEvent.click(screen.getByRole("button", { name: "Remove: Rent" }));
    expect(onChange).toHaveBeenCalledWith([THREE[0], THREE[2]]);
  });

  it("moves a row with the arrows, and the first cannot go up nor the last down", async () => {
    const onChange = setup();
    expect(screen.getByRole("button", { name: "Move up: Buy" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move down: Projects" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Move down: Buy" }));
    expect(onChange).toHaveBeenCalledWith([THREE[1], THREE[0], THREE[2]]);
  });

  it("names a row with no label by its place", () => {
    setup({ links: [row("z", "", "/x")] });
    expect(screen.getByRole("button", { name: "Remove: Link 1" })).toBeInTheDocument();
  });

  it("shows how many are used, and when full turns Add off and says so while Remove still works", () => {
    setup({ max: 3 });
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
    expect(screen.getByText("The list is full.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add link" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remove: Buy" })).toBeEnabled();
  });

  it("says so when there are no links", () => {
    setup({ links: [] });
    expect(screen.getByText("No links yet.")).toBeInTheDocument();
    expect(screen.getByText("0 / 5")).toBeInTheDocument();
  });

  it("ties a row's problem to its box and marks the box invalid", () => {
    setup({ errors: { "link-b": { href: "Enter a page on this site." } } });
    const box = screen.getByRole("textbox", { name: "Link address 2" });
    expect(box).toHaveAttribute("aria-invalid", "true");
    expect(box).toHaveAccessibleDescription("Enter a page on this site.");
    expect(screen.getByRole("textbox", { name: "Label 2" })).not.toHaveAttribute("aria-invalid");
  });

  it("turns every box and button off while disabled", () => {
    setup({ disabled: true });
    expect(screen.getByRole("textbox", { name: "Label 1" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add link" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remove: Buy" })).toBeDisabled();
  });
});

const HEADER_WORDS: SiteHeaderFieldsWords = {
  brand: { title: "Brand", description: "Leave the name empty to use Find Prop." },
  links: { title: "Navigation links", description: "Shown across the top of every page." },
  cta: { title: "Call to action", description: "A button at the right end." },
  name: "Site name",
  ctaLabel: "Button label",
  ctaHref: "Button link",
  optional: "(optional)",
  linkList: LINK_WORDS,
};

const HEADER: SiteHeaderValues = { name: "Find Prop", links: THREE, ctaLabel: "", ctaHref: "" };

describe("UT-site-header-fields: the Header page's boxes (S7-T10)", () => {
  it("hands back the whole values with the one box that changed", async () => {
    const onChange = vi.fn();
    render(
      <SiteHeaderFields values={HEADER} onChange={onChange} linksMax={12} words={HEADER_WORDS} />,
    );
    await userEvent.type(screen.getByRole("textbox", { name: /Site name/ }), "X");
    expect(onChange).toHaveBeenCalledWith({ ...HEADER, name: "Find PropX" });
    await userEvent.type(screen.getByRole("textbox", { name: /Button label/ }), "P");
    expect(onChange).toHaveBeenLastCalledWith({ ...HEADER, ctaLabel: "P" });
  });

  it("puts the link list in its own card and changes the links through it", async () => {
    const onChange = vi.fn();
    render(
      <SiteHeaderFields values={HEADER} onChange={onChange} linksMax={12} words={HEADER_WORDS} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Remove: Buy" }));
    expect(onChange).toHaveBeenCalledWith({ ...HEADER, links: [THREE[1], THREE[2]] });
  });

  it("shows a box's problem with the box and marks it invalid", () => {
    render(
      <SiteHeaderFields
        values={HEADER}
        errors={{ ctaHref: "This field is required." }}
        onChange={() => undefined}
        linksMax={12}
        words={HEADER_WORDS}
      />,
    );
    const box = screen.getByRole("textbox", { name: /Button link/ });
    expect(box).toHaveAttribute("aria-invalid", "true");
    expect(box).toHaveAccessibleDescription("This field is required.");
  });

  it("turns everything off while saving", () => {
    render(
      <SiteHeaderFields
        values={HEADER}
        onChange={() => undefined}
        linksMax={12}
        disabled
        words={HEADER_WORDS}
      />,
    );
    expect(screen.getByRole("textbox", { name: /Site name/ })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: /Button link/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add link" })).toBeDisabled();
  });
});

const FOOTER_WORDS: SiteFooterFieldsWords = {
  contact: { title: "About and contact", description: "Shown at the bottom." },
  links: { title: "Links", description: "Shown in the footer." },
  about: "About text",
  phone: "Phone",
  email: "Email",
  address: "Address",
  copyright: "Copyright line",
  optional: "(optional)",
  linkList: LINK_WORDS,
};

const FOOTER: SiteFooterValues = {
  about: "About us",
  phone: "",
  email: "",
  address: "",
  links: [],
  copyright: "",
};

describe("UT-site-footer-fields: the Footer page's boxes (S7-T10)", () => {
  function Stateful() {
    const [values, setValues] = useState(FOOTER);
    return (
      <>
        <SiteFooterFields values={values} onChange={setValues} linksMax={20} words={FOOTER_WORDS} />
        <output data-testid="copyright">{values.copyright}</output>
        <output data-testid="phone">{values.phone}</output>
      </>
    );
  }

  it("keeps every box's text as typed, and the other boxes as they were", async () => {
    render(<Stateful />);
    await userEvent.type(screen.getByRole("textbox", { name: /Phone/ }), "+91 9");
    await userEvent.type(screen.getByRole("textbox", { name: /Copyright line/ }), "© 2026");
    expect(screen.getByTestId("phone")).toHaveTextContent("+91 9");
    expect(screen.getByTestId("copyright")).toHaveTextContent("© 2026");
    expect(screen.getByRole("textbox", { name: /About text/ })).toHaveValue("About us");
  });

  it("shows a box's problem with the box and marks it invalid", () => {
    render(
      <SiteFooterFields
        values={FOOTER}
        errors={{ email: "Enter a valid email address." }}
        onChange={() => undefined}
        linksMax={20}
        words={FOOTER_WORDS}
      />,
    );
    const box = screen.getByRole("textbox", { name: /Email/ });
    expect(box).toHaveAttribute("aria-invalid", "true");
    expect(box).toHaveAccessibleDescription("Enter a valid email address.");
  });
});

describe("UT-site-content-layout: the frame of the four pages (S7-T10)", () => {
  const tabs = [
    { key: "header", label: "Header", href: "/admin/header", current: false },
    { key: "hero", label: "Hero", href: "/admin/hero", current: true },
    { key: "homepage", label: "Homepage", href: "/admin/homepage", current: false },
    { key: "footer", label: "Footer", href: "/admin/footer", current: false },
  ];
  const setup = (top?: React.ReactNode) =>
    render(
      <SiteContentLayout
        title="Hero"
        description="The first thing visitors see."
        tabs={tabs}
        tabsLabel="Site content"
        previewLabel="Preview"
        preview={<p>the picture</p>}
        {...(top ? { top } : {})}
        footer={<button type="button">Save changes</button>}
      >
        <p>the boxes</p>
      </SiteContentLayout>,
    );

  it("has the page heading and links to the four pages, marking the current one", () => {
    setup();
    expect(screen.getByRole("heading", { level: 1, name: "Hero" })).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Site content" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/admin/header",
      "/admin/hero",
      "/admin/homepage",
      "/admin/footer",
    ]);
    expect(within(nav).getByRole("link", { name: "Hero" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Footer" })).not.toHaveAttribute("aria-current");
  });

  it("takes a second-level heading when the page already has an h1", () => {
    render(
      <SiteContentLayout
        title="Hero"
        description="d"
        tabs={tabs}
        tabsLabel="Site content"
        previewLabel="Preview"
        preview={<p>p</p>}
        footer={<p>f</p>}
        headingLevel="h2"
      >
        <p>b</p>
      </SiteContentLayout>,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Hero" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });

  it("names the preview, and reads in order: boxes, preview, save bar", () => {
    setup();
    const preview = screen.getByRole("region", { name: "Preview" });
    expect(within(preview).getByText("the picture")).toBeInTheDocument();
    const text = document.body.textContent ?? "";
    expect(text.indexOf("the boxes")).toBeLessThan(text.indexOf("the picture"));
    expect(text.indexOf("the picture")).toBeLessThan(text.indexOf("Save changes"));
  });

  it("shows an alert above the boxes when there is one", () => {
    setup(<p role="alert">3 things need attention</p>);
    const text = document.body.textContent ?? "";
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(text.indexOf("3 things")).toBeLessThan(text.indexOf("the boxes"));
  });
});

describe("UT-site-previews: the drawings beside the boxes (S7-T10)", () => {
  it("draws the header: the name, the links in order and the button, hidden from a screen reader", () => {
    const { container } = render(
      <SiteHeaderPreview brandName="Find Prop" links={["Buy", "Rent"]} cta="Post property" />,
    );
    const drawing = container.querySelector("[data-slot='site-header-preview']");
    expect(drawing).toHaveAttribute("aria-hidden", "true");
    expect(drawing?.textContent).toBe("Find PropBuyRentPost property");
  });

  it("draws no button when there is none", () => {
    const { container } = render(<SiteHeaderPreview brandName="Find Prop" links={[]} />);
    expect(container.textContent).toBe("Find Prop");
  });

  it("draws the footer with only the lines it has", () => {
    const { container } = render(
      <SiteFooterPreview
        brandName="Find Prop"
        contacts={[]}
        links={[]}
        copyright="© 2026 Find Prop"
      />,
    );
    const drawing = container.querySelector("[data-slot='site-footer-preview']");
    expect(drawing).toHaveAttribute("aria-hidden", "true");
    expect(drawing?.querySelectorAll("ul")).toHaveLength(0);
    expect(drawing?.textContent).toContain("© 2026 Find Prop");
  });

  it("draws the footer's about text, contact lines and links", () => {
    const { container } = render(
      <SiteFooterPreview
        brandName="Find Prop"
        about="About us"
        contacts={["Chennai", "+91 90000 00000"]}
        links={["Contact us"]}
        copyright="© 2026"
      />,
    );
    expect(container.textContent).toContain("About us");
    expect(container.textContent).toContain("+91 90000 00000");
    expect(container.textContent).toContain("Contact us");
  });
});

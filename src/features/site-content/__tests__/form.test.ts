import { describe, expect, it } from "vitest";
import {
  footerFormOf,
  footerPayloadOf,
  footerPictureOf,
  footerProblemsOf,
  headerFormOf,
  headerPayloadOf,
  headerPictureOf,
  headerProblemsOf,
  linkProblemsOf,
  linkRowsOf,
  standardFooterOf,
  standardHeaderOf,
  type StandardFooter,
  type StandardHeader,
} from "../form";

const STANDARD_HEADER: StandardHeader = {
  brandName: "Find Prop",
  links: [
    { label: "Buy", href: "/properties" },
    { label: "Projects", href: "/projects" },
  ],
  cta: { label: "Post property", href: "/post-property" },
};

const STANDARD_FOOTER: StandardFooter = {
  brandName: "Find Prop",
  links: [{ label: "Contact us", href: "/contact" }],
  copyright: "© 2026 Find Prop",
};

describe("UT-site-content-form: the boxes start where the page really is (S7-T10)", () => {
  it("starts the header on what visitors see today when nothing is saved", () => {
    expect(headerFormOf({ links: [] }, STANDARD_HEADER)).toEqual({
      name: "",
      links: STANDARD_HEADER.links,
      ctaLabel: "Post property",
      ctaHref: "/post-property",
    });
  });

  it("starts the header on what is saved, links and button included, never mixed with the standard", () => {
    const saved = {
      name: "Kadal Homes",
      links: [{ label: "Homes", href: "/homes" }],
      cta: { label: "List yours", href: "https://example.com/list" },
    };
    expect(headerFormOf(saved, STANDARD_HEADER)).toEqual({
      name: "Kadal Homes",
      links: [{ label: "Homes", href: "/homes" }],
      ctaLabel: "List yours",
      ctaHref: "https://example.com/list",
    });
  });

  it("starts the header with no button when the standard has none (its page is switched off)", () => {
    const withoutButton: StandardHeader = {
      brandName: STANDARD_HEADER.brandName,
      links: STANDARD_HEADER.links,
    };
    expect(headerFormOf({ links: [] }, withoutButton)).toMatchObject({ ctaLabel: "", ctaHref: "" });
  });

  it("starts the footer on the saved text and contact lines, and on the standard links when none are saved", () => {
    expect(
      footerFormOf(
        {
          about: "About us",
          contact: { address: "Chennai", phone: "+91 90000 00000", email: "hi@example.com" },
          links: [],
        },
        STANDARD_FOOTER,
      ),
    ).toEqual({
      about: "About us",
      phone: "+91 90000 00000",
      email: "hi@example.com",
      address: "Chennai",
      links: STANDARD_FOOTER.links,
      copyright: "",
    });
    expect(
      footerFormOf({ links: [{ label: "FAQ", href: "/faq" }], copyright: "© Me" }, STANDARD_FOOTER),
    ).toMatchObject({ links: [{ label: "FAQ", href: "/faq" }], copyright: "© Me" });
  });

  it("takes the standard header and footer from what the public builders returned, dropping their extras", () => {
    expect(
      standardHeaderOf({
        brandName: "Find Prop",
        links: [
          { label: "AI search", href: "/ai-search", accent: true } as {
            label: string;
            href: string;
          },
        ],
        cta: { label: "Post", href: "/post" },
      }).links,
    ).toEqual([{ label: "AI search", href: "/ai-search" }]);
    expect(
      standardFooterOf({
        brandName: "Find Prop",
        links: [
          { label: "Blog", href: "https://x.test", external: true } as {
            label: string;
            href: string;
          },
        ],
        copyright: "© 2026",
      }).links,
    ).toEqual([{ label: "Blog", href: "https://x.test" }]);
  });

  it("numbers the rows by place so the page and the browser agree on them", () => {
    expect(
      linkRowsOf(
        [
          { label: "A", href: "/a" },
          { label: "B", href: "/b" },
        ],
        "link",
      ),
    ).toEqual([
      { id: "link-1", label: "A", href: "/a" },
      { id: "link-2", label: "B", href: "/b" },
    ]);
  });
});

describe("UT-site-content-payload: what a save sends (S7-T10)", () => {
  it("sends the header as typed, without the row ids", () => {
    expect(
      headerPayloadOf({
        name: " Kadal ",
        links: [{ id: "link-1", label: "Buy", href: "/buy" } as { label: string; href: string }],
        ctaLabel: "Post",
        ctaHref: "/post",
      }),
    ).toEqual({
      name: " Kadal ",
      links: [{ label: "Buy", href: "/buy" }],
      cta: { label: "Post", href: "/post" },
    });
  });

  it("sends the footer's contact lines under one key", () => {
    expect(
      footerPayloadOf({
        about: "Hi",
        phone: "1",
        email: "a@b.co",
        address: "Here",
        links: [],
        copyright: "© X",
      }),
    ).toEqual({
      about: "Hi",
      contact: { address: "Here", email: "a@b.co", phone: "1" },
      links: [],
      copyright: "© X",
    });
  });
});

describe("UT-site-content-problems: the server's problems land on their boxes (S7-T10)", () => {
  const rows = [{ id: "link-1" }, { id: "link-2" }, { id: "link-3" }];

  it("puts a link problem on the row at that place", () => {
    expect(
      linkProblemsOf("links", { "links.1.href": "bad", "links.2.label": "needed" }, rows),
    ).toEqual({ "link-2": { href: "bad" }, "link-3": { label: "needed" } });
  });

  it("keeps both boxes of one row together and ignores a place that has no row", () => {
    expect(
      linkProblemsOf(
        "links",
        { "links.0.label": "a", "links.0.href": "b", "links.9.href": "c" },
        rows,
      ),
    ).toEqual({ "link-1": { label: "a", href: "b" } });
  });

  it("maps the header's boxes, the button's two boxes included", () => {
    expect(
      headerProblemsOf(
        { name: "long", "cta.label": "needed", "cta.href": "bad", "links.0.href": "x" },
        rows,
      ),
    ).toEqual({
      name: "long",
      ctaLabel: "needed",
      ctaHref: "bad",
      links: { "link-1": { href: "x" } },
    });
    expect(headerProblemsOf({}, rows)).toEqual({});
  });

  it("maps the footer's boxes, the contact lines from under their group", () => {
    expect(
      footerProblemsOf(
        {
          about: "long",
          "contact.email": "bad email",
          "contact.phone": "long",
          "contact.address": "long",
          copyright: "long",
          "links.2.label": "needed",
        },
        rows,
      ),
    ).toEqual({
      about: "long",
      address: "long",
      email: "bad email",
      phone: "long",
      copyright: "long",
      links: { "link-3": { label: "needed" } },
    });
  });
});

describe("UT-site-content-picture: the small pictures follow the same rules as the public pages (S7-T10)", () => {
  const typed = (over: Record<string, unknown> = {}) => ({
    name: "",
    links: [{ label: "Buy", href: "/buy" }],
    ctaLabel: "",
    ctaHref: "",
    ...over,
  });

  it("shows the typed name, links and button", () => {
    expect(
      headerPictureOf(
        typed({ name: " Kadal ", ctaLabel: "Post", ctaHref: "/post" }),
        STANDARD_HEADER,
      ),
    ).toEqual({ brandName: "Kadal", links: ["Buy"], cta: "Post" });
  });

  it("falls back to the standard name, links and button when the boxes are empty", () => {
    expect(headerPictureOf(typed({ links: [] }), STANDARD_HEADER)).toEqual({
      brandName: "Find Prop",
      links: ["Buy", "Projects"],
      cta: "Post property",
    });
  });

  it("leaves out a link with no name yet, and draws no button when the standard has none", () => {
    const noButton: StandardHeader = {
      brandName: STANDARD_HEADER.brandName,
      links: STANDARD_HEADER.links,
    };
    expect(
      headerPictureOf(
        typed({
          links: [
            { label: "  ", href: "/x" },
            { label: "Rent", href: "/r" },
          ],
        }),
        noButton,
      ),
    ).toEqual({ brandName: "Find Prop", links: ["Rent"] });
  });

  it("shows the footer's contact lines in the public order, and the standard line when none is typed", () => {
    expect(
      footerPictureOf(
        {
          about: " About ",
          phone: "+91 1",
          email: "a@b.co",
          address: "Chennai",
          links: [],
          copyright: "",
        },
        STANDARD_FOOTER,
      ),
    ).toEqual({
      brandName: "Find Prop",
      about: "About",
      contacts: ["Chennai", "+91 1", "a@b.co"],
      links: ["Contact us"],
      copyright: "© 2026 Find Prop",
    });
  });

  it("shows a typed copyright line and links, and no about text when it is empty", () => {
    const picture = footerPictureOf(
      {
        about: " ",
        phone: "",
        email: "",
        address: "",
        links: [{ label: "FAQ", href: "/faq" }],
        copyright: "© Me",
      },
      STANDARD_FOOTER,
    );
    expect(picture).toEqual({
      brandName: "Find Prop",
      contacts: [],
      links: ["FAQ"],
      copyright: "© Me",
    });
  });
});

// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type * as Documents from "../documents";
import en from "@/i18n/messages/en.json";
import { renderWithMessages } from "../../../../tests/render-intl";
import { contentsOf, legalDocument } from "../documents";
import { LegalPage } from "../legal-page";
import { LEGAL_KINDS, LEGAL_PATHS } from "../types";

vi.mock("@/features/site", () => ({ getTranslate: async () => (key: string) => key }));

const words = en.legal;

describe("the legal documents (S5-T06, ADR-053)", () => {
  it.each(LEGAL_KINDS)(
    "%s has numbered sections with unique anchors and some text in each",
    (kind) => {
      const { sections } = legalDocument(kind);
      expect(sections.length).toBeGreaterThan(2);
      const ids = sections.map((section) => section.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const section of sections) {
        expect(section.id).toMatch(/^[a-z]+(-[a-z]+)*$/);
        expect(section.blocks.length).toBeGreaterThan(0);
      }
    },
  );

  it("are all placeholders for now, with no date and no version, until the owner's text is in", () => {
    for (const kind of LEGAL_KINDS) {
      const document = legalDocument(kind);
      expect(document.draft).toBe(true);
      expect(document.updated).toBeNull();
      expect(document.version).toBeNull();
    }
  });

  it("builds the contents list from the sections, numbered from 1, in order", () => {
    const entries = contentsOf(legalDocument("terms").sections);
    expect(entries[0]).toEqual({ id: "using-find-prop", number: 1, heading: "Using Find Prop" });
    expect(entries.map((entry) => entry.number)).toEqual(entries.map((_entry, index) => index + 1));
  });

  it("has one page address for each kind", () => {
    expect(LEGAL_PATHS).toEqual({ privacy: "/privacy", terms: "/terms", cookies: "/cookies" });
  });

  it("lists what the site really stores in the browser, in the cookie table", () => {
    const table = legalDocument("cookies")
      .sections.flatMap((section) => section.blocks)
      .find((block) => block.type === "table");
    const names = table?.type === "table" ? table.rows.map((row) => row[0]) : [];
    expect(names).toEqual(
      expect.arrayContaining(["Sign-in session", "Compare list (browser storage)"]),
    );
  });
});

describe("LegalPage: the shared reading layout (ADD-12)", () => {
  it("has the title as the one heading, the tag, the summary and the draft notice", () => {
    renderWithMessages(<LegalPage kind="privacy" />);
    expect(
      screen.getByRole("heading", { level: 1, name: words.title.privacy }),
    ).toBeInTheDocument();
    expect(screen.getByText(words.tag)).toBeInTheDocument();
    expect(screen.getByText(words.draft.title)).toBeInTheDocument();
    expect(screen.getByText(words.draft.body)).toBeInTheDocument();
    expect(screen.queryByText(/Last updated/)).toBeNull();
  });

  it("numbers the sections, each a heading with its anchor", () => {
    renderWithMessages(<LegalPage kind="terms" />);
    const first = screen.getByRole("heading", { level: 2, name: "1. Using Find Prop" });
    expect(first.closest("section")).toHaveAttribute("id", "using-find-prop");
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(
      legalDocument("terms").sections.length,
    );
  });

  it("links to the other two pages, marking the one the visitor is on", () => {
    renderWithMessages(<LegalPage kind="cookies" />);
    const switcher = screen.getByRole("navigation", { name: words.switcher });
    expect(within(switcher).getByRole("link", { name: words.title.cookies })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(switcher).getByRole("link", { name: words.title.privacy })).toHaveAttribute(
      "href",
      "/privacy",
    );
    expect(within(switcher).getByRole("link", { name: words.title.terms })).toHaveAttribute(
      "href",
      "/terms",
    );
  });

  it("has an On this page list that links to every section", () => {
    renderWithMessages(<LegalPage kind="privacy" />);
    const lists = screen.getAllByRole("link", { name: "1. Who we are" });
    expect(lists.length).toBeGreaterThan(0);
    for (const link of lists) expect(link).toHaveAttribute("href", "#who-we-are");
  });

  it("keeps the phone's contents list closed unless it is asked to be open", () => {
    const { container, unmount } = renderWithMessages(<LegalPage kind="privacy" />);
    expect(container.querySelector("details")).not.toHaveAttribute("open");
    unmount();
    const open = renderWithMessages(<LegalPage kind="privacy" contentsOpen />);
    expect(open.container.querySelector("details")).toHaveAttribute("open");
  });

  it("draws the data table with a caption and header cells", () => {
    renderWithMessages(<LegalPage kind="privacy" />);
    const table = screen.getByRole("table", {
      name: "What we collect, why, who sees it and how long we keep it",
    });
    expect(within(table).getAllByRole("columnheader")).toHaveLength(4);
    expect(within(table).getByRole("rowheader", { name: "Mobile number" })).toBeInTheDocument();
  });

  it("has the breadcrumb back to the home page", () => {
    renderWithMessages(<LegalPage kind="terms" />);
    const crumbs = screen.getByRole("navigation", { name: words.crumb.nav });
    for (const link of within(crumbs).getAllByRole("link", { name: words.crumb.home })) {
      expect(link).toHaveAttribute("href", "/");
    }
  });

  it("shows when the text was last changed, and its version, once the text is final", async () => {
    vi.resetModules();
    vi.doMock("../documents", async (importOriginal) => {
      const actual = await importOriginal<typeof Documents>();
      return {
        ...actual,
        legalDocument: () => ({
          ...actual.legalDocument("terms"),
          draft: false,
          updated: "2026-12-01",
          version: "1.0",
        }),
      };
    });
    const { LegalPage: Final } = await import("../legal-page");
    renderWithMessages(<Final kind="terms" />);
    expect(screen.getByText(/Last updated: .*2026/)).toBeInTheDocument();
    expect(screen.getByText(/Version 1\.0/)).toBeInTheDocument();
    expect(screen.queryByText(words.draft.title)).toBeNull();
    vi.doUnmock("../documents");
  });
});

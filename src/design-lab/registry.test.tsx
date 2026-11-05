// @vitest-environment jsdom
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderWithMessages } from "../../tests/render-intl";
import { PREVIEW_NAMES } from "./preview-names";
import { PREVIEWS } from "./previews";
import { LAB_BOARDS } from "./registry";

// R-DS-03: a shared component without a Design Lab entry fails here, so a component cannot ship
// without being shown in every state.
const COMPONENTS_DIR = path.resolve(__dirname, "..", "components");
const LAYERS = ["ui", "patterns", "layout", "domain"];
// Types only: no component to show.
const NOT_COMPONENTS = new Set(["layout/nav-types.ts"]);

function componentFiles(): string[] {
  return LAYERS.flatMap((layer) =>
    fs
      .readdirSync(path.join(COMPONENTS_DIR, layer), { withFileTypes: true })
      .filter(
        (entry) => entry.isFile() && /\.tsx?$/.test(entry.name) && !/\.test\./.test(entry.name),
      )
      .map((entry) => `${layer}/${entry.name}`),
  ).filter((file) => !NOT_COMPONENTS.has(file));
}

const allEntries = LAB_BOARDS.flatMap((board) => board.entries.map((entry) => ({ board, entry })));
const registered = new Set(allEntries.flatMap(({ entry }) => entry.sources));

describe("Design Lab registry", () => {
  it("has the five boards of the approved UX, in order, then the domain, discovery and projects boards", () => {
    expect(LAB_BOARDS.map((board) => board.id)).toEqual([
      "foundations",
      "components",
      "navigation",
      "feedback",
      "ads",
      "domain",
      "discovery",
      "projects",
    ]);
    expect(LAB_BOARDS.map((board) => board.uxBoard)).toEqual([
      "ds-foundations",
      "ds-components",
      "ds-navigation",
      "ds-feedback",
      "ds-ads",
      "search",
      "compare",
      "projects",
    ]);
  });

  it("has an entry for every shared component", () => {
    const missing = componentFiles().filter((file) => !registered.has(file));
    expect(missing, "components with no Design Lab entry").toEqual([]);
  });

  it("only lists components that exist", () => {
    const existing = new Set(componentFiles());
    const unknown = [...registered].filter((source) => !existing.has(source));
    expect(unknown, "entries naming a component file that does not exist").toEqual([]);
  });

  it("gives every entry a unique id, a name and a description", () => {
    const ids = allEntries.map(({ entry }) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const { entry } of allEntries) {
      expect(entry.id).toMatch(/^[a-z]+(?:-[a-z]+)*$/);
      expect(entry.name.length).toBeGreaterThan(2);
      expect(entry.description.length).toBeGreaterThan(10);
    }
  });
});

describe("Design Lab and docs/ux-reference.md", () => {
  const reference = fs.readFileSync(
    path.resolve(__dirname, "..", "..", "docs", "ux-reference.md"),
    "utf8",
  );

  it.each(LAB_BOARDS.map((board) => [board.id, board.uxBoard] as const))(
    "lists the %s board, its route and its UX board file (%s)",
    (id, uxBoard) => {
      expect(reference).toContain(`/design-system/${id}`);
      expect(reference).toContain(`docs/ux/final-ux/screens/${uxBoard}.html`);
    },
  );

  it.each(LAB_BOARDS.map((board) => board.uxBoard))("the UX board file %s exists", (uxBoard) => {
    const file = path.resolve(
      __dirname,
      "..",
      "..",
      "docs",
      "ux",
      "final-ux",
      "screens",
      `${uxBoard}.html`,
    );
    expect(fs.existsSync(file)).toBe(true);
  });
});

describe("Design Lab demos", () => {
  it.each(allEntries.map(({ board, entry }) => [`${board.id}/${entry.id}`, entry] as const))(
    "%s renders",
    (_name, entry) => {
      const { container } = renderWithMessages(<entry.Demo />);
      expect(container.firstElementChild).not.toBeNull();
    },
  );

  it.each(Object.entries(PREVIEWS))("preview %s renders", (_name, render) => {
    const { container } = renderWithMessages(<>{render()}</>);
    expect(container.firstElementChild).not.toBeNull();
  });

  it("the preview list and the previews agree", () => {
    expect(Object.keys(PREVIEWS).sort()).toEqual([...PREVIEW_NAMES].sort());
  });

  it("every iframe on a board points at a preview that exists", () => {
    const frameSources = allEntries.flatMap(({ entry }) => {
      const { container } = renderWithMessages(<entry.Demo />);
      return [...container.querySelectorAll("iframe")].map(
        (frame) => frame.getAttribute("src") ?? "",
      );
    });
    expect(frameSources.length).toBeGreaterThan(10);
    for (const source of frameSources) {
      const name = source.replace("/design-system/preview/", "");
      expect(Object.keys(PREVIEWS), source).toContain(name);
    }
  });
});

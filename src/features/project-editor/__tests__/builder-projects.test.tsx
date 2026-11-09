// @vitest-environment jsdom
import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import en from "@/i18n/messages/en.json";
import { BuilderProjects } from "../builder-projects.client";
import type { ProjectListRow } from "../view";

const words = en.builderPortal.projects;
const BASE = "https://storage.example.test";
const PROJECT = "11111111-1111-4111-8111-111111111111";

const project = (id: string, extra: Partial<ProjectListRow> = {}): ProjectListRow => ({
  id,
  name: `Project ${id}`,
  slug: `project-${id}`,
  locality: "OMR Navalur",
  priceMin: 7800000,
  priceMax: 14200000,
  cover: null,
  moderation: "approved",
  published: true,
  featured: false,
  ...extra,
});

const ROWS = [
  project("kadal-vista", {
    name: "Kadal Vista",
    slug: "kadal-vista",
    cover: `${PROJECT}/3f2a9c1b-front.jpg`,
    featured: true,
  }),
  project("kadal-courts", {
    name: "Kadal Courts",
    slug: "kadal-courts",
    locality: "OMR Siruseri",
    priceMin: 5400000,
    priceMax: 8600000,
    moderation: "pending",
    published: false,
  }),
  project("kadal-bay", {
    name: "Kadal Bay",
    slug: "kadal-bay",
    locality: "Guindy",
    priceMin: 9000000,
    priceMax: 9000000,
    moderation: "approved",
    published: false,
  }),
  project("nila-meadows", {
    name: "Nila Meadows",
    slug: "nila-meadows",
    locality: "Medavakkam",
    priceMin: null,
    priceMax: null,
    moderation: "rejected",
    published: false,
  }),
];

function open(rows: ProjectListRow[] = ROWS) {
  renderWithMessages(<BuilderProjects rows={rows} mediaBaseUrl={BASE} />);
}

const rowOf = (name: string) => {
  const cell = screen.getAllByText(name, { selector: "span, a, p" })[0];
  const found = cell?.closest("tr");
  if (!found) throw new Error(`no row for ${name}`);
  return found;
};

describe("BuilderProjects: the builder's Projects page (S7-T03)", () => {
  it("shows the heading, the approval warning, Add project, the tabs with their counts and the line under the list", () => {
    open();
    expect(screen.getByRole("heading", { level: 1, name: words.title })).toBeVisible();
    expect(screen.getByText(words.reapproval.title)).toBeVisible();
    expect(screen.getByRole("link", { name: words.add })).toHaveAttribute(
      "href",
      "/builder/projects/new",
    );
    expect(screen.getByRole("tab", { name: /All/ })).toHaveTextContent("4");
    expect(screen.getByRole("tab", { name: /Pending/ })).toHaveTextContent("1");
    expect(screen.getByRole("tab", { name: /Approved/ })).toHaveTextContent("2");
    expect(screen.getByRole("tab", { name: /Rejected/ })).toHaveTextContent("1");
    expect(screen.getByRole("tab", { name: /Draft/ })).toHaveTextContent("0");
    expect(screen.getByText("4 projects")).toBeVisible();
  });

  it("has no Builder column and none of the admin's buttons", () => {
    open();
    expect(screen.queryByRole("columnheader", { name: words.columns.builder })).toBeNull();
    for (const word of ["Approve", "Reject", "Publish", "Unpublish", "Delete", "Feature"]) {
      expect(screen.queryByRole("button", { name: new RegExp(`^${word}`) })).toBeNull();
    }
  });

  it("shows each project's place, price range and state, with Published, Unpublished and Featured badges", () => {
    open();
    const vista = within(rowOf("Kadal Vista"));
    expect(vista.getByText("OMR Navalur")).toBeVisible();
    expect(vista.getByText("₹78 L – ₹1.42 Cr")).toBeVisible();
    expect(vista.getByText("Approved")).toBeVisible();
    expect(vista.getByText(words.badges.published)).toBeVisible();
    expect(vista.getByText(words.badges.featured)).toBeVisible();
    const courts = within(rowOf("Kadal Courts"));
    expect(courts.getByText("Pending")).toBeVisible();
    expect(courts.queryByText(words.badges.published)).toBeNull();
    const bay = within(rowOf("Kadal Bay"));
    expect(bay.getByText(words.badges.unpublished)).toBeVisible();
    // The same price twice is one price.
    expect(bay.getByText("₹90 L")).toBeVisible();
    // A project with no price says so; a rejected one has no Published badge.
    const meadows = within(rowOf("Nila Meadows"));
    expect(meadows.getByText(words.noPrice)).toBeVisible();
    expect(meadows.getByText("Rejected")).toBeVisible();
  });

  it("gives every project an Edit link to its page, and View live only to one that is approved and published", () => {
    open();
    expect(screen.getAllByRole("link", { name: /^Edit / })).toHaveLength(4);
    expect(screen.getByRole("link", { name: "Edit Kadal Vista" })).toHaveAttribute(
      "href",
      "/builder/projects/kadal-vista",
    );
    const live = screen.getAllByRole("link", { name: /^View live/ });
    expect(live).toHaveLength(1);
    expect(live[0]).toHaveAttribute("href", "/projects/kadal-vista");
  });

  it("shows the cover from the media bucket when there is one", () => {
    open();
    const image = within(rowOf("Kadal Vista")).getByRole("img", { name: "Kadal Vista" });
    // Next serves the picture through its own address, with the bucket's address inside it.
    expect(decodeURIComponent(image.getAttribute("src") ?? "")).toContain(
      `${BASE}/storage/v1/object/public/project-media/${PROJECT}/3f2a9c1b-front.jpg`,
    );
    expect(within(rowOf("Kadal Courts")).queryByRole("img", { name: "Kadal Courts" })).toBeNull();
  });

  it("filters by the chosen tab and updates the line under the list", () => {
    open();
    fireEvent.mouseDown(screen.getByRole("tab", { name: /Pending/ }), { button: 0 });
    expect(screen.getByText("1 project")).toBeVisible();
    expect(screen.getAllByText("Kadal Courts", { selector: "span, a, p" }).length).toBeGreaterThan(
      0,
    );
    expect(screen.queryAllByText("Kadal Vista", { selector: "span, a, p" })).toHaveLength(0);
  });

  it("searches the name and the place, whatever the capitals", () => {
    open();
    const box = screen.getByRole("searchbox", { name: words.search });
    fireEvent.change(box, { target: { value: "guindy" } });
    expect(screen.getByText("1 project")).toBeVisible();
    expect(screen.getAllByText("Kadal Bay", { selector: "span, a, p" }).length).toBeGreaterThan(0);
    fireEvent.change(box, { target: { value: "KADAL" } });
    expect(screen.getByText("3 projects")).toBeVisible();
  });

  it("says nothing matched when a filter hides every project, not that there are none", () => {
    open();
    fireEvent.change(screen.getByRole("searchbox", { name: words.search }), {
      target: { value: "zzz" },
    });
    expect(screen.getByText(words.noMatch.title)).toBeVisible();
    expect(screen.queryByText(words.empty.title)).toBeNull();
  });

  it("invites the builder to add their first project when they have none", () => {
    open([]);
    expect(screen.getByText(words.empty.title)).toBeVisible();
    expect(screen.getByText(words.empty.text)).toBeVisible();
  });

  it("shows a state it does not know as Pending rather than failing", () => {
    open([project("odd", { name: "Odd One", moderation: "archived" })]);
    expect(within(rowOf("Odd One")).getByText("Pending")).toBeVisible();
  });
});

// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import { ProjectsManager, type ProjectRow, type ProjectsManagerProps } from "../projects-manager";

const COLUMNS = {
  project: "Project",
  builder: "Builder",
  priceRange: "Price range",
  status: "Status",
  actions: "Actions",
};

const TABS = [
  { value: "all", label: "All", count: 3 },
  { value: "pending", label: "Pending", count: 1, countTone: "new" as const },
];

function row(extra: Partial<ProjectRow> = {}): ProjectRow {
  return {
    id: "p1",
    name: "Kadal Vista",
    place: "OMR Navalur",
    builder: "Kadal Homes",
    priceRange: "₹78 L – ₹1.42 Cr",
    status: <span>Approved</span>,
    actions: [],
    ...extra,
  };
}

function withoutBuilder(): ProjectRow {
  const plain = row();
  delete plain.builder;
  return plain;
}

function manager(extra: Partial<ProjectsManagerProps> = {}) {
  const props: ProjectsManagerProps = {
    mode: "admin",
    title: "Projects",
    intro: "Review every builder project.",
    addLabel: "Add project",
    addHref: "/admin/projects/new",
    tabs: TABS,
    tab: "all",
    onTabChange: vi.fn(),
    tabsLabel: "Filter by status",
    search: {
      value: "",
      onChange: vi.fn(),
      label: "Search projects",
      placeholder: "Search projects",
    },
    builderFilter: {
      label: "Builder",
      allLabel: "All builders",
      options: [{ value: "kadal", label: "Kadal Homes" }],
      value: "",
      onChange: vi.fn(),
    },
    columns: COLUMNS,
    caption: "Projects",
    rows: [row()],
    countText: "1 project",
    empty: { title: "No projects yet", text: "Projects will appear here." },
    ...extra,
  };
  renderWithMessages(<ProjectsManager {...props} />);
  return props;
}

describe("ProjectsManager: the projects list of the admin and the builder (S7-T01)", () => {
  it("shows the heading, Add project as a link, the tabs with their counts and the line under the list", () => {
    manager();
    expect(screen.getByRole("heading", { level: 1, name: "Projects" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Add project" })).toHaveAttribute(
      "href",
      "/admin/projects/new",
    );
    expect(screen.getByRole("tab", { name: /Pending/ })).toHaveTextContent("1");
    expect(screen.getByRole("table", { name: "Projects" })).toBeVisible();
    expect(screen.getByText("1 project")).toBeVisible();
  });

  it("tells the page which tab was chosen, and what was typed and picked", () => {
    const props = manager();
    fireEvent.mouseDown(screen.getByRole("tab", { name: /Pending/ }), { button: 0 });
    expect(props.onTabChange).toHaveBeenCalledWith("pending");
    fireEvent.change(screen.getByRole("searchbox", { name: "Search projects" }), {
      target: { value: "nila" },
    });
    expect(props.search.onChange).toHaveBeenCalledWith("nila");
    fireEvent.change(screen.getByRole("combobox", { name: "Builder" }), {
      target: { value: "kadal" },
    });
    expect(props.builderFilter?.onChange).toHaveBeenCalledWith("kadal");
  });

  it("admin mode has the Builder column and its filter; builder mode has neither, and warns about approval", () => {
    manager();
    expect(screen.getByRole("columnheader", { name: "Builder" })).toBeInTheDocument();
    expect(screen.getByText("Kadal Homes", { selector: "span" })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "Builder" })).toBeVisible();
  });

  it("builder mode: no Builder column, no filter, and the warning that edits go back for approval", () => {
    manager({
      mode: "builder",
      reapproval: { title: "Edits go back for approval", text: "The project is set to Pending." },
      rows: [withoutBuilder()],
    });
    expect(screen.queryByRole("columnheader", { name: "Builder" })).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Builder" })).toBeNull();
    expect(screen.getByText("Edits go back for approval")).toBeVisible();
  });

  it("names each button by its word and the project, and runs what it was given", () => {
    const onApprove = vi.fn();
    manager({
      rows: [
        row({
          actions: [
            {
              id: "approve",
              label: "Approve",
              forName: "Kadal Vista",
              tone: "primary",
              onClick: onApprove,
            },
          ],
        }),
      ],
    });
    fireEvent.click(screen.getByRole("button", { name: "Approve Kadal Vista" }));
    expect(onApprove).toHaveBeenCalledTimes(1);
  });

  it("gives an address instead of a click for Edit and View live", () => {
    manager({
      rows: [
        row({
          actions: [
            {
              id: "edit",
              label: "Edit",
              forName: "Kadal Vista",
              tone: "secondary",
              href: "/admin/projects/p1",
            },
          ],
        }),
      ],
    });
    expect(screen.getByRole("link", { name: "Edit Kadal Vista" })).toHaveAttribute(
      "href",
      "/admin/projects/p1",
    );
  });

  it("keeps the label of a working button and does nothing if it is pressed again", () => {
    const onApprove = vi.fn();
    manager({
      rows: [
        row({
          actions: [
            {
              id: "approve",
              label: "Approve",
              forName: "Kadal Vista",
              tone: "primary",
              onClick: onApprove,
              pending: true,
            },
          ],
        }),
      ],
    });
    const button = screen.getByRole("button", { name: "Approve Kadal Vista" });
    expect(button).toHaveAttribute("aria-busy", "true");
    fireEvent.click(button);
    expect(onApprove).not.toHaveBeenCalled();
  });

  it("opens the row menu, says why Delete is off in its own words, and runs a chosen item", async () => {
    const onFeature = vi.fn();
    manager({
      rows: [
        row({
          moreLabel: "More actions for Kadal Vista",
          menu: [
            { id: "feature", label: "Feature", icon: "star", onSelect: onFeature },
            {
              id: "delete",
              label: "Delete (has 128 leads)",
              icon: "trash",
              destructive: true,
              disabled: true,
            },
          ],
        }),
      ],
    });
    fireEvent.pointerDown(screen.getByRole("button", { name: "More actions for Kadal Vista" }), {
      button: 0,
      ctrlKey: false,
      pointerType: "mouse",
    });
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: "Delete (has 128 leads)" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Feature" }));
    await waitFor(() => expect(onFeature).toHaveBeenCalledTimes(1));
  });

  it("shows what the page puts above the tabs", () => {
    manager({ notice: <p>This project can&apos;t be deleted</p> });
    expect(screen.getByText("This project can't be deleted")).toBeVisible();
  });

  it("shows the empty page with Add project instead of an empty table", () => {
    manager({ rows: [] });
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByRole("heading", { name: "No projects yet" })).toBeVisible();
    expect(screen.getAllByRole("link", { name: "Add project" })).toHaveLength(2);
  });
});

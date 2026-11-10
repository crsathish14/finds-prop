// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  SponsorsManager,
  type SponsorRow,
  type SponsorsManagerProps,
  type SponsorsManagerWords,
} from "../sponsors-manager";

const WORDS: SponsorsManagerWords = {
  ready: "Ready",
  missing: "Missing",
  statuses: { active: "Active", inactive: "Inactive", needsImages: "Needs images" },
  unnamed: "Unnamed sponsor",
};

const row = (id: string, name: string, over: Partial<SponsorRow> = {}): SponsorRow => ({
  id,
  advertiser: name,
  status: "active",
  strip: true,
  panel: false,
  moveUpLabel: `Move ${name} up`,
  moveDownLabel: `Move ${name} down`,
  editLabel: "Edit",
  editFor: name,
  onEdit: () => undefined,
  deleteLabel: `Delete ${name}`,
  onDelete: () => undefined,
  ...over,
});

const manager = (over: Partial<SponsorsManagerProps> = {}): SponsorsManagerProps => ({
  title: "Sponsors",
  intro: "Shown in this order, one after another.",
  addLabel: "Add sponsor",
  onAdd: () => undefined,
  columns: {
    advertiser: "Advertiser",
    status: "Status",
    strip: "Strip",
    panel: "Panel",
    order: "Order",
    actions: "Actions",
  },
  caption: "Sponsors",
  rows: [row("a", "Sample Developer"), row("b", "Sample Builder"), row("c", "Sample Finance")],
  countText: "3 sponsors · 2 active",
  note: "A campaign needs both the desktop and the phone image of a format.",
  words: WORDS,
  empty: { title: "No sponsors yet", text: "The homepage shows no banner." },
  onMove: () => undefined,
  ...over,
});

/** The body rows of the table, without the heading row. */
const bodyRows = () => screen.getAllByRole("row").slice(1);

describe("UT-sponsors-manager: the Sponsors list of the Hero page (S7-T11)", () => {
  it("is a named section with the heading, the line and Add sponsor", () => {
    render(<SponsorsManager {...manager()} />);
    const section = screen.getByRole("region", { name: "Sponsors" });
    expect(within(section).getByRole("heading", { name: "Sponsors", level: 2 })).toBeVisible();
    expect(screen.getByText("Shown in this order, one after another.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add sponsor" })).toBeEnabled();
  });

  it("lists the sponsors in the order given, with the count and the note under them", () => {
    render(<SponsorsManager {...manager()} />);
    const rows = bodyRows();
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent(/^SDSample Developer/);
    expect(rows[2]).toHaveTextContent(/^SFSample Finance/);
    expect(screen.getByText("3 sponsors · 2 active")).toBeInTheDocument();
    expect(screen.getByText(/needs both the desktop and the phone image/)).toBeInTheDocument();
  });

  it("shows each state as a word: Active, Inactive, Needs images; a format as Ready or Missing", () => {
    render(
      <SponsorsManager
        {...manager({
          rows: [
            row("a", "Alpha"),
            row("b", "Beta", { status: "inactive", strip: false, panel: true }),
            row("c", "Gamma", { status: "needs_images", strip: false }),
          ],
        })}
      />,
    );
    const [alpha, beta, gamma] = bodyRows() as [HTMLElement, HTMLElement, HTMLElement];
    expect(within(alpha).getByText("Active")).toBeInTheDocument();
    expect(within(alpha).getByText("Ready")).toBeInTheDocument();
    expect(within(alpha).getByText("Missing")).toBeInTheDocument();
    expect(within(beta).getByText("Inactive")).toBeInTheDocument();
    expect(within(gamma).getByText("Needs images")).toBeInTheDocument();
    expect(within(gamma).getAllByText("Missing")).toHaveLength(2);
  });

  it("turns the first sponsor's Up and the last one's Down off, and says whose arrow each is", () => {
    render(<SponsorsManager {...manager()} />);
    expect(screen.getByRole("button", { name: "Move Sample Developer up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move Sample Developer down" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Move Sample Builder up" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Move Sample Finance down" })).toBeDisabled();
  });

  it("a single sponsor has both arrows off", () => {
    render(<SponsorsManager {...manager({ rows: [row("a", "Only One")] })} />);
    expect(screen.getByRole("button", { name: "Move Only One up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move Only One down" })).toBeDisabled();
  });

  it("reports which sponsor moved and which way", async () => {
    const onMove = vi.fn();
    render(<SponsorsManager {...manager({ onMove })} />);
    await userEvent.click(screen.getByRole("button", { name: "Move Sample Builder up" }));
    await userEvent.click(screen.getByRole("button", { name: "Move Sample Builder down" }));
    expect(onMove).toHaveBeenNthCalledWith(1, "b", "up");
    expect(onMove).toHaveBeenNthCalledWith(2, "b", "down");
  });

  it("Edit is named after its sponsor and Delete says the whole name", async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
      <SponsorsManager
        {...manager({ rows: [row("a", "Sample Developer", { onEdit, onDelete })] })}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Edit Sample Developer" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete Sample Developer" }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("Add sponsor does what it is given, and is off when told to be", async () => {
    const onAdd = vi.fn();
    const { rerender } = render(<SponsorsManager {...manager({ onAdd })} />);
    await userEvent.click(screen.getByRole("button", { name: "Add sponsor" }));
    expect(onAdd).toHaveBeenCalledTimes(1);
    rerender(<SponsorsManager {...manager({ onAdd, addDisabled: true })} />);
    expect(screen.getByRole("button", { name: "Add sponsor" })).toBeDisabled();
  });

  it("a row that is being saved has every button off", () => {
    render(<SponsorsManager {...manager({ rows: [row("a", "Busy", { pending: true })] })} />);
    for (const name of ["Move Busy up", "Move Busy down", "Edit Busy", "Delete Busy"]) {
      expect(screen.getByRole("button", { name })).toBeDisabled();
    }
  });

  it("a sponsor saved without a name shows a plain word and a question mark", () => {
    render(<SponsorsManager {...manager({ rows: [row("a", "")] })} />);
    expect(screen.getByText("Unnamed sponsor")).toBeInTheDocument();
    expect(screen.getByText("?")).toBeInTheDocument();
  });

  it("draws the monogram from the first letters of the first two words", () => {
    render(<SponsorsManager {...manager({ rows: [row("a", "sample developer pvt")] })} />);
    expect(screen.getByText("SD")).toBeInTheDocument();
  });

  it("nothing yet: a message with its own Add sponsor button, and no table", () => {
    render(<SponsorsManager {...manager({ rows: [], countText: "0 sponsors" })} />);
    expect(screen.getByRole("heading", { name: "No sponsors yet" })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Add sponsor" })).toHaveLength(2);
  });

  it("the heading level can be changed for the page outline", () => {
    render(<SponsorsManager {...manager({ headingLevel: "h3" })} />);
    expect(screen.getByRole("heading", { name: "Sponsors", level: 3 })).toBeInTheDocument();
  });
});

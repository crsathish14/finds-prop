// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  MediaGroupField,
  type MediaGroupWords,
  type MediaItem,
} from "@/components/patterns/media-group-field";
import { PriceTrendsEditor, type PriceTrendsWords } from "../price-trends-editor";
import { ProjectMedia, type ProjectMediaProps, type ProjectMediaWords } from "../project-media";

const FILE_WORDS: MediaGroupWords = {
  add: "Add files",
  remove: (name) => `Remove: ${name}`,
  uploading: "Uploading",
  removing: "Removing",
  full: "The group is full.",
};

const done = (id: string, name: string): MediaItem => ({ id, name, kind: "file", stage: "done" });

describe("UT-media-group-field: one group of files (S7-T02)", () => {
  const setup = (props: Partial<React.ComponentProps<typeof MediaGroupField>> = {}) => {
    const onFiles = vi.fn();
    const onRemove = vi.fn();
    render(
      <MediaGroupField
        label="Floor plans"
        items={[]}
        max={3}
        accept="image/png"
        onFiles={onFiles}
        onRemove={onRemove}
        words={FILE_WORDS}
        {...props}
      />,
    );
    return { onFiles, onRemove };
  };

  it("is a group named by its label, with the count and a file input that takes the types given", () => {
    setup({ items: [done("a", "plan.png")] });
    const group = screen.getByRole("group", { name: "Floor plans" });
    expect(within(group).getByText("1 / 3")).toBeTruthy();
    const input = group.querySelector("input[type=file]");
    expect(input?.getAttribute("accept")).toBe("image/png");
    expect(input?.hasAttribute("multiple")).toBe(true);
  });

  it("is a single-file field when the limit is one", () => {
    setup({ max: 1 });
    expect(document.querySelector("input[type=file]")?.hasAttribute("multiple")).toBe(false);
  });

  it("hands over the chosen files and clears the input so the same file can be chosen again", () => {
    const { onFiles } = setup();
    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    const file = new File(["x"], "plan.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onFiles).toHaveBeenCalledWith([file]);
  });

  it("hands over only the first dropped file when the limit is one", () => {
    const { onFiles } = setup({ max: 1 });
    const first = new File(["a"], "a.pdf", { type: "application/pdf" });
    const second = new File(["b"], "b.pdf", { type: "application/pdf" });
    const zone = screen.getByText("Add files").closest("label") as HTMLElement;
    fireEvent.drop(zone, { dataTransfer: { files: [first, second] } });
    expect(onFiles).toHaveBeenCalledWith([first]);
  });

  it("shows each file's name with an x that names it, and removes only that one", async () => {
    const { onRemove } = setup({ items: [done("a", "plan.png"), done("b", "side.png")] });
    expect(screen.getByText("side.png")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Remove: side.png" }));
    expect(onRemove).toHaveBeenCalledWith("b");
  });

  it("shows a file on its way with a named progress bar and keeps its x off", () => {
    setup({ items: [{ id: "a", name: "plan.png", kind: "file", stage: "uploading" }] });
    expect(screen.getByText("Uploading")).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "plan.png" })).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Remove: plan.png" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("shows a file's error on its tile, does not count it, and still lets it be removed", async () => {
    const { onRemove } = setup({
      items: [
        { id: "a", name: "big.png", kind: "file", stage: "error", error: "Too large (14 MB)." },
      ],
    });
    expect(screen.getByText("Too large (14 MB).")).toBeTruthy();
    expect(screen.getByText("0 / 3")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Remove: big.png" }));
    expect(onRemove).toHaveBeenCalledWith("a");
  });

  it("takes the add tile away and says so when the group is full", () => {
    setup({ items: [done("a", "1.png"), done("b", "2.png"), done("c", "3.png")] });
    expect(screen.queryByText("Add files")).toBeNull();
    expect(screen.getByText("The group is full.")).toBeTruthy();
  });

  it("ties the hint and the group's error to the group", () => {
    setup({ hint: "PNG only", error: "Add at least one." });
    const group = screen.getByRole("group", { name: "Floor plans" });
    const described = group.getAttribute("aria-describedby") ?? "";
    expect(described.split(" ")).toHaveLength(2);
    expect(screen.getByText("Add at least one.").id).toBe(described.split(" ")[1]);
  });

  it("turns the input and every x off when disabled", () => {
    setup({ items: [done("a", "plan.png")], disabled: true });
    expect((document.querySelector("input[type=file]") as HTMLInputElement).disabled).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Remove: plan.png" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});

const MEDIA_WORDS: ProjectMediaWords = {
  locked: "Save the project first to add media.",
  groups: {
    images: { label: "Project images" },
    floorPlans: { label: "Floor plans" },
    elevations: { label: "Elevations" },
    plotImages: { label: "Plot images", hint: "Layout drawings." },
    brochure: { label: "Brochure (PDF)" },
  },
  files: FILE_WORDS,
  videos: {
    label: "Videos",
    tags: {
      placeholder: "Paste a video link",
      add: "Add",
      remove: "Remove",
      suggestions: "Suggestions",
      full: "The list is full.",
    },
  },
};

const EMPTY_GROUPS: ProjectMediaProps["groups"] = {
  images: { items: [] },
  floorPlans: { items: [] },
  elevations: { items: [] },
  plotImages: { items: [] },
  brochure: { items: [] },
};

describe("UT-project-media: the Media section's contents (S7-T02)", () => {
  const setup = (props: Partial<ProjectMediaProps> = {}) => {
    const handlers = { onFiles: vi.fn(), onRemove: vi.fn(), onVideosChange: vi.fn() };
    render(
      <ProjectMedia
        groups={EMPTY_GROUPS}
        videos={[]}
        words={MEDIA_WORDS}
        {...handlers}
        {...props}
      />,
    );
    return handlers;
  };

  it("has the four image groups, the brochure and the video links", () => {
    setup();
    for (const name of ["Project images", "Floor plans", "Elevations", "Plot images"]) {
      expect(screen.getByRole("group", { name })).toBeTruthy();
    }
    expect(screen.getByRole("group", { name: "Brochure (PDF)" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Videos" })).toBeTruthy();
  });

  it("offers pictures to the image groups and PDF to the brochure, the brochure one file only", () => {
    setup();
    const input = (name: string) =>
      screen.getByRole("group", { name }).querySelector("input[type=file]") as HTMLInputElement;
    expect(input("Project images").accept).toBe("image/jpeg,image/png,image/webp");
    expect(input("Brochure (PDF)").accept).toBe("application/pdf");
    expect(input("Brochure (PDF)").multiple).toBe(false);
    expect(
      within(screen.getByRole("group", { name: "Project images" })).getByText("0 / 20"),
    ).toBeTruthy();
    expect(
      within(screen.getByRole("group", { name: "Brochure (PDF)" })).getByText("0 / 1"),
    ).toBeTruthy();
  });

  it("tells the page which group a file was added to or removed from", async () => {
    const { onFiles, onRemove } = setup({
      groups: { ...EMPTY_GROUPS, elevations: { items: [done("e1", "front.png")] } },
    });
    const file = new File(["x"], "plan.png", { type: "image/png" });
    const input = screen
      .getByRole("group", { name: "Floor plans" })
      .querySelector("input[type=file]") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    expect(onFiles).toHaveBeenCalledWith("floorPlans", [file]);
    await userEvent.click(screen.getByRole("button", { name: "Remove: front.png" }));
    expect(onRemove).toHaveBeenCalledWith("elevations", "e1");
  });

  it("adds a video link as typed", async () => {
    const { onVideosChange } = setup();
    await userEvent.type(
      screen.getByRole("textbox", { name: "Videos" }),
      "https://example.com/tour{Enter}",
    );
    expect(onVideosChange).toHaveBeenCalledWith(["https://example.com/tour"]);
  });

  it("keeps a long link whole (up to 300 characters)", async () => {
    const { onVideosChange } = setup();
    const link = `https://example.com/${"a".repeat(150)}`;
    await userEvent.type(screen.getByRole("textbox", { name: "Videos" }), `${link}{Enter}`);
    expect(onVideosChange).toHaveBeenCalledWith([link]);
  });

  it("says why everything is off for a project that is not saved yet", () => {
    setup({ locked: true });
    expect(screen.getByText("Save the project first to add media.")).toBeTruthy();
    for (const box of document.querySelectorAll("input[type=file]")) {
      expect((box as HTMLInputElement).disabled).toBe(true);
    }
    expect((screen.getByRole("textbox", { name: "Videos" }) as HTMLInputElement).disabled).toBe(
      true,
    );
  });

  it("shows no locked note for a saved project, and turns everything off while saving", () => {
    setup({ disabled: true });
    expect(screen.queryByText("Save the project first to add media.")).toBeNull();
    for (const box of document.querySelectorAll("input[type=file]")) {
      expect((box as HTMLInputElement).disabled).toBe(true);
    }
  });

  it("shows a group's error and the videos' error", () => {
    setup({
      groups: { ...EMPTY_GROUPS, brochure: { items: [], error: "Pick a PDF." } },
      videosError: "Use an https link.",
    });
    expect(screen.getByText("Pick a PDF.")).toBeTruthy();
    expect(screen.getByText("Use an https link.")).toBeTruthy();
  });
});

const TREND_WORDS: PriceTrendsWords = {
  title: "Price trends",
  description: "Monthly price per sq.ft shown as a chart on the project page.",
  month: "Month",
  price: "₹ per sq.ft",
  monthFormat: "yyyy-mm",
  add: "Add month",
  remove: (month) => `Remove ${month}`,
  empty: "No months yet.",
  full: "The list is full.",
};

describe("UT-price-trends-editor: the admin's monthly prices (S7-T02)", () => {
  const rows = [
    { id: "r1", month: "2026-10", price: "8350" },
    { id: "r2", month: "2026-09", price: "8230" },
  ];
  const setup = (props: Partial<React.ComponentProps<typeof PriceTrendsEditor>> = {}) => {
    const handlers = { onAdd: vi.fn(), onRemove: vi.fn(), onChange: vi.fn() };
    render(<PriceTrendsEditor rows={rows} max={3} words={TREND_WORDS} {...handlers} {...props} />);
    return handlers;
  };

  it("is a group named by its title, with a month box and a price box for every row", () => {
    setup();
    const group = screen.getByRole("group", { name: "Price trends" });
    expect(within(group).getByText("2 / 3")).toBeTruthy();
    expect((screen.getByLabelText("Month 1") as HTMLInputElement).value).toBe("2026-10");
    expect((screen.getByLabelText("₹ per sq.ft 2") as HTMLInputElement).value).toBe("8230");
    expect((screen.getByLabelText("₹ per sq.ft 1") as HTMLInputElement).inputMode).toBe("numeric");
    expect((screen.getByLabelText("Month 1") as HTMLInputElement).type).toBe("month");
  });

  it("reports an edit by row and box", () => {
    const { onChange } = setup();
    fireEvent.change(screen.getByLabelText("₹ per sq.ft 2"), { target: { value: "8300" } });
    expect(onChange).toHaveBeenCalledWith("r2", "price", "8300");
    fireEvent.change(screen.getByLabelText("Month 1"), { target: { value: "2026-11" } });
    expect(onChange).toHaveBeenCalledWith("r1", "month", "2026-11");
  });

  it("adds and removes a row, naming the month on the x", async () => {
    const { onAdd, onRemove } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Add month" }));
    expect(onAdd).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Remove 2026-09" }));
    expect(onRemove).toHaveBeenCalledWith("r2");
  });

  it("names the x by the row's number when its month is still empty", () => {
    setup({ rows: [{ id: "n", month: "", price: "" }] });
    expect(screen.getByRole("button", { name: "Remove 1" })).toBeTruthy();
  });

  it("says so when empty, and shows no column headings", () => {
    setup({ rows: [] });
    expect(screen.getByText("No months yet.")).toBeTruthy();
    expect(screen.getByText("0 / 3")).toBeTruthy();
    expect(screen.queryByLabelText("Month 1")).toBeNull();
  });

  it("turns Add month off and says so when full", () => {
    setup({ max: 2 });
    expect((screen.getByRole("button", { name: "Add month" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(screen.getByText(/The list is full\./)).toBeTruthy();
  });

  it("marks a box with a problem invalid and ties its message to it", () => {
    setup({ errors: { r1: { month: "This month is listed twice." }, r2: { price: "Too high." } } });
    const month = screen.getByLabelText("Month 1");
    expect(month.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("This month is listed twice.").id).toBe(
      month.getAttribute("aria-describedby"),
    );
    const price = screen.getByLabelText("₹ per sq.ft 2");
    expect(price.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("Too high.").id).toBe(price.getAttribute("aria-describedby"));
    expect(screen.getByLabelText("Month 2").getAttribute("aria-invalid")).toBeNull();
  });

  it("turns every box and button off while saving", () => {
    setup({ disabled: true });
    for (const box of screen.getAllByRole("textbox")) {
      expect((box as HTMLInputElement).disabled).toBe(true);
    }
    expect((screen.getByLabelText("Month 1") as HTMLInputElement).disabled).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Remove 2026-10" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect((screen.getByRole("button", { name: "Add month" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});

// @vitest-environment jsdom
import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import { TopDevelopersForm } from "../top-developers-form.client";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const options = [
  { id: "a", name: "Alpha Homes", projects: 3 },
  { id: "b", name: "Beta Builders", projects: 1 },
  { id: "c", name: "Gamma Group", projects: 0 },
];

describe("TopDevelopersForm: the super admin's choice of developers (home page)", () => {
  it("shows the chosen developers in order and the others to add", () => {
    renderWithMessages(
      <TopDevelopersForm
        options={options}
        initial={["b"]}
        initialDates={{}}
        today="2026-11-26"
        max={10}
        save={vi.fn()}
      />,
    );
    expect(screen.getByText("1 of 10 chosen")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Alpha Homes" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Add Beta Builders" })).not.toBeInTheDocument();
  });

  it("adds, reorders and saves the ids in the chosen order", async () => {
    const save = vi.fn().mockResolvedValue({ ok: true, data: {} });
    renderWithMessages(
      <TopDevelopersForm
        options={options}
        initial={["a"]}
        initialDates={{}}
        today="2026-11-26"
        max={10}
        save={save}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Add Beta Builders" }));
    await userEvent.click(screen.getByRole("button", { name: "Move Beta Builders up" }));
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(save).toHaveBeenCalledWith({ builderIds: ["b", "a"], dates: {} });
  });

  it("stops adding at the limit", () => {
    renderWithMessages(
      <TopDevelopersForm
        options={options}
        initial={["a", "b"]}
        initialDates={{}}
        today="2026-11-26"
        max={2}
        save={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Add Gamma Group" })).toBeDisabled();
    expect(screen.getByText("2 developers chosen")).toBeInTheDocument();
  });

  it("says the home page picks by itself when none is chosen", () => {
    renderWithMessages(
      <TopDevelopersForm
        options={options}
        initial={[]}
        initialDates={{}}
        today="2026-11-26"
        max={10}
        save={vi.fn()}
      />,
    );
    expect(screen.getByText("No developer chosen")).toBeInTheDocument();
  });

  it("sends each chosen developer's dates and tags where each stands today (ADR-210)", async () => {
    const save = vi.fn().mockResolvedValue({ ok: true, data: {} });
    renderWithMessages(
      <TopDevelopersForm
        options={options}
        initial={["a", "b"]}
        initialDates={{ ["b"]: { startsOn: "", endsOn: "2026-11-01" } }}
        today="2026-11-26"
        max={10}
        save={save}
      />,
    );
    expect(screen.getByText("Ended")).toBeInTheDocument();
    expect(screen.getByText("Running")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Starts on, Alpha Homes"), {
      target: { value: "2026-12-01" },
    });
    expect(screen.getByText("Scheduled")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(save).toHaveBeenCalledWith({
      builderIds: ["a", "b"],
      dates: {
        ["a"]: { startsOn: "2026-12-01", endsOn: "" },
        ["b"]: { startsOn: "", endsOn: "2026-11-01" },
      },
    });
  });
});

// @vitest-environment jsdom
import { screen } from "@testing-library/react";
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
      <TopDevelopersForm options={options} initial={["b"]} max={10} save={vi.fn()} />,
    );
    expect(screen.getByText("1 of 10 chosen")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Alpha Homes" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Add Beta Builders" })).not.toBeInTheDocument();
  });

  it("adds, reorders and saves the ids in the chosen order", async () => {
    const save = vi.fn().mockResolvedValue({ ok: true, data: {} });
    renderWithMessages(
      <TopDevelopersForm options={options} initial={["a"]} max={10} save={save} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Add Beta Builders" }));
    await userEvent.click(screen.getByRole("button", { name: "Move Beta Builders up" }));
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(save).toHaveBeenCalledWith({ builderIds: ["b", "a"] });
  });

  it("stops adding at the limit", () => {
    renderWithMessages(
      <TopDevelopersForm options={options} initial={["a", "b"]} max={2} save={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "Add Gamma Group" })).toBeDisabled();
    expect(screen.getByText("2 developers chosen")).toBeInTheDocument();
  });

  it("says the home page picks by itself when none is chosen", () => {
    renderWithMessages(
      <TopDevelopersForm options={options} initial={[]} max={10} save={vi.fn()} />,
    );
    expect(screen.getByText("No developer chosen")).toBeInTheDocument();
  });
});

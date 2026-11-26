// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import en from "@/i18n/messages/en.json";
import { SponsoredBuildersForm } from "../sponsored-builders-form.client";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const words = en.admin.sponsoredBuilders;

const options = [
  { id: "a", name: "Alpha Homes", kind: "builder" as const, projects: 3 },
  { id: "b", name: "Beta Realty", kind: "agent" as const, projects: 1 },
  { id: "c", name: "Gamma Group", kind: "builder" as const, projects: 0 },
];

const featured = () => screen.getByRole("region", { name: words.featured.title });
const spotlight = () => screen.getByRole("region", { name: words.spotlight.title });

describe("SponsoredBuildersForm: who the Featured card and the Spotlight draw from (ADR-191)", () => {
  it("shows each place's picks and the active builders and agents to add, with their type", () => {
    renderWithMessages(
      <SponsoredBuildersForm
        options={options}
        initial={{ featured: ["b"], spotlight: [] }}
        initialDates={{ featured: {}, spotlight: {} }}
        today="2026-11-26"
        max={10}
        save={vi.fn()}
      />,
    );
    expect(within(featured()).getByText("1 of 10 picked")).toBeInTheDocument();
    expect(within(featured()).getByRole("button", { name: "Remove Beta Realty" })).toBeEnabled();
    expect(within(featured()).queryByRole("button", { name: "Add Beta Realty" })).toBeNull();
    expect(within(featured()).getAllByText("Agent").length).toBeGreaterThan(0);
    expect(within(spotlight()).getByText(words.empty.spotlight)).toBeInTheDocument();
    expect(within(spotlight()).getByRole("button", { name: "Add Beta Realty" })).toBeEnabled();
  });

  it("adds and removes in each place on its own, and saves both lists", async () => {
    const save = vi.fn().mockResolvedValue({ ok: true, data: {} });
    renderWithMessages(
      <SponsoredBuildersForm
        options={options}
        initial={{ featured: ["a"], spotlight: ["a"] }}
        initialDates={{ featured: {}, spotlight: {} }}
        today="2026-11-26"
        max={10}
        save={save}
      />,
    );
    await userEvent.click(within(featured()).getByRole("button", { name: "Add Beta Realty" }));
    await userEvent.click(within(spotlight()).getByRole("button", { name: "Remove Alpha Homes" }));
    await userEvent.click(within(spotlight()).getByRole("button", { name: "Add Gamma Group" }));
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(save).toHaveBeenCalledWith({
      featured: ["a", "b"],
      spotlight: ["c"],
      featuredDates: {},
      spotlightDates: {},
    });
  });

  it("stops adding at the limit, and names one that is no longer active", () => {
    renderWithMessages(
      <SponsoredBuildersForm
        options={options}
        initial={{ featured: ["a", "gone"], spotlight: [] }}
        initialDates={{ featured: {}, spotlight: {} }}
        today="2026-11-26"
        max={2}
        save={vi.fn()}
      />,
    );
    expect(within(featured()).getByRole("button", { name: "Add Gamma Group" })).toBeDisabled();
    expect(within(featured()).getByText(words.unknown)).toBeInTheDocument();
    expect(within(spotlight()).getByRole("button", { name: "Add Gamma Group" })).toBeEnabled();
  });

  it("puts both lists back on Discard", async () => {
    renderWithMessages(
      <SponsoredBuildersForm
        options={options}
        initial={{ featured: [], spotlight: [] }}
        initialDates={{ featured: {}, spotlight: {} }}
        today="2026-11-26"
        max={10}
        save={vi.fn()}
      />,
    );
    await userEvent.click(within(featured()).getByRole("button", { name: "Add Alpha Homes" }));
    expect(within(featured()).getByText("1 of 10 picked")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(within(featured()).getByText("None picked")).toBeInTheDocument();
  });
});

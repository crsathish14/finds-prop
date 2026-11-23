// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/site", () => ({
  getTranslate: async () => (key: string, values?: { place?: string }) =>
    values?.place ? `${key}:${values.place}` : key,
}));
vi.mock("@/features/search", () => ({ SEARCH_PATH: "/properties" }));
vi.mock("@/features/ai-chat", () => ({
  HomeAiSearch: (props: { examples?: string[]; suggestions?: string[]; appearance?: string }) => (
    <div
      data-testid="search"
      data-mode="ai"
      data-appearance={props.appearance}
      data-examples={props.examples?.length}
      data-suggestions={props.suggestions?.length}
    />
  ),
}));
vi.mock("@/components/domain/home-search-bar.client", () => ({
  HomeSearchBar: (props: {
    mode: string;
    action: string;
    examples?: string[];
    suggestions?: string[];
    appearance?: string;
  }) => (
    <div
      data-testid="search"
      data-mode={props.mode}
      data-action={props.action}
      data-appearance={props.appearance}
      data-examples={props.examples?.join("|")}
      data-suggestions={props.suggestions?.length}
    />
  ),
}));

const { ConversationalLive, sampleRequests } = await import("../conversational-live");

const translate = (key: string, values?: { place?: string }) =>
  values?.place ? `${key}:${values.place}` : key;

describe("UT-sample-requests: the typed hint of the Conversational hero", () => {
  it("names no place when there are no curated localities", () => {
    expect(sampleRequests(translate, [])).toEqual([
      "heroLab.plainExamples.budget",
      "heroLab.plainExamples.rent",
      "heroLab.plainExamples.ready",
      "heroLab.plainExamples.family",
    ]);
  });

  it("uses the first part of each curated locality's label and cycles when there are fewer than four", () => {
    const localities = [
      { label: "Adyar, Chennai", lat: 0, lng: 0, radiusKm: 3 },
      { label: "Porur", lat: 0, lng: 0, radiusKm: 3 },
    ];
    expect(sampleRequests(translate, localities)).toEqual([
      "heroLab.examples.budget:Adyar",
      "heroLab.examples.rent:Porur",
      "heroLab.examples.ready:Adyar",
      "heroLab.examples.family:Porur",
    ]);
  });
});

describe("UT-conversational-live: the hero as the live page and the hero lab render it (ADR-176)", () => {
  it("renders the shared hero with the joined keyword bar, three chips and the trust lines while AI search is off", async () => {
    render(
      await ConversationalLive({
        title: "Find the place",
        subtitle: "Line",
        aiSearch: false,
        localities: [],
        sponsor: <aside aria-label="Sponsored strip">strip</aside>,
      }),
    );
    const section = screen.getByRole("region", { name: "Find the place" });
    expect(section).toHaveAttribute("data-layout", "conversational");
    const search = within(section).getByTestId("search");
    expect(search).toHaveAttribute("data-mode", "keyword");
    expect(search).toHaveAttribute("data-action", "/properties");
    expect(search).toHaveAttribute("data-appearance", "joined");
    expect(search).toHaveAttribute("data-suggestions", "3");
    expect(within(section).getByText("heroLab.conversational.prompt")).toBeInTheDocument();
    expect(within(section).getAllByRole("listitem")).toHaveLength(3);
    expect(within(section).getByLabelText("Sponsored strip")).toBeInTheDocument();
  });

  it("uses the AI search with the same extras while FLAG_AI_SEARCH is on, and leaves out the strip when none is given", async () => {
    render(await ConversationalLive({ title: "Find the place", aiSearch: true, localities: [] }));
    const search = screen.getByTestId("search");
    expect(search).toHaveAttribute("data-mode", "ai");
    expect(search).toHaveAttribute("data-appearance", "joined");
    expect(search).toHaveAttribute("data-examples", "4");
    expect(document.querySelectorAll("aside")).toHaveLength(0);
  });
});

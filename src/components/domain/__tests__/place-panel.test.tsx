// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Combobox } from "@/components/patterns/combobox";
import en from "@/i18n/messages/en.json";
import { renderWithMessages } from "../../../../tests/render-intl";
import { usePlacePanel, type PlacePanelState } from "../place-panel";

const words = en.domain.places;

/** The notes are in the panel, beside the list; the same words are also read out by the polite live region. */
const inList = () => within(screen.getByRole("dialog"));

function Host({ state, query }: { state: PlacePanelState; query: string }) {
  const panel = usePlacePanel(state, query);
  return (
    <Combobox
      aria-label="Place"
      value={query}
      onValueChange={vi.fn()}
      onQueryChange={vi.fn()}
      onSelect={vi.fn()}
      options={[]}
      loading={state === "loading"}
      defaultOpen
      {...panel}
    />
  );
}

describe("usePlacePanel: what the panel says in each state (ADR-131)", () => {
  it("before three letters it says to type more and that only Tamil Nadu is covered", () => {
    renderWithMessages(<Host state="ready" query="" />);
    expect(inList().getByText("Type at least 3 characters")).toBeInTheDocument();
    expect(inList().getByText(words.idle.bodyEmpty)).toBeInTheDocument();
    expect(inList().getByText(words.region)).toBeInTheDocument();
  });

  it("with one or two letters it says to keep typing", () => {
    renderWithMessages(<Host state="ready" query="Ve" />);
    expect(inList().getByText(words.idle.bodyTyping)).toBeInTheDocument();
  });

  it("when nothing is found it names the text and offers the keyword row", () => {
    renderWithMessages(<Host state="empty" query="Velxy" />);
    expect(inList().getByText("No places found for “Velxy”")).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /Search for “Velxy” as a keyword/ }),
    ).toBeInTheDocument();
  });

  it("when the provider cannot answer it says so and still offers the keyword row", () => {
    renderWithMessages(<Host state="unavailable" query="Velachery" />);
    expect(inList().getByText(words.unavailable.title)).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /as a keyword/ })).toBeInTheDocument();
  });

  it("when our limit refused it says to wait, with no keyword row", () => {
    renderWithMessages(<Host state="limited" query="Vel" />);
    expect(inList().getByText(words.limited.title)).toBeInTheDocument();
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("always shows the Ola Maps credit and the OpenStreetMap licence link", () => {
    renderWithMessages(<Host state="ready" query="Vel" />);
    expect(screen.getByText(words.attribution.poweredBy)).toBeInTheDocument();
    const licence = screen.getByRole("link", { name: /OpenStreetMap contributors/ });
    expect(licence).toHaveAttribute("href", "https://www.openstreetmap.org/copyright");
    expect(licence).toHaveAttribute("target", "_blank");
    expect(licence.getAttribute("rel")).toContain("noopener");
  });

  it("shows grey rows while loading", () => {
    renderWithMessages(<Host state="loading" query="Vel" />);
    expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it("choosing the keyword row does not change the typed text", async () => {
    renderWithMessages(<Host state="empty" query="Velxy" />);
    await userEvent.click(screen.getByRole("option", { name: /as a keyword/ }));
    expect(screen.getByRole("combobox")).toHaveValue("Velxy");
  });
});

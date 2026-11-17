// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import en from "@/i18n/messages/en.json";
import { renderWithMessages } from "../../../../tests/render-intl";
import { LocationField } from "../location-field";
import { LocationPrompt } from "../location-prompt";

const words = en.domain.locationField;

describe("LocationField (ADR-131)", () => {
  it("asks where the property is, with the hint, the provider note and the privacy link", () => {
    renderWithMessages(<LocationField mode="search" box={<input aria-label="Address" />} />);
    expect(screen.getByRole("group", { name: /Where is the property\?/ })).toBeInTheDocument();
    expect(screen.getByText(words.hint)).toBeInTheDocument();
    expect(screen.getByText(/Suggestions come from Ola Maps/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute(
      "href",
      "/privacy",
    );
    expect(screen.getByRole("textbox", { name: "Address" })).toBeInTheDocument();
  });

  it("offers I can't find it while searching, and the way back while choosing the area", async () => {
    const onChooseArea = vi.fn();
    const onSearchAddress = vi.fn();
    const searching = renderWithMessages(
      <LocationField mode="search" onChooseArea={onChooseArea} onSearchAddress={onSearchAddress} />,
    );
    await userEvent.click(screen.getByRole("button", { name: words.chooseArea }));
    expect(onChooseArea).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: words.searchInstead })).not.toBeInTheDocument();
    searching.unmount();

    renderWithMessages(
      <LocationField mode="area" onChooseArea={onChooseArea} onSearchAddress={onSearchAddress} />,
    );
    expect(screen.getByRole("group", { name: /Which area is it in?/ })).toBeInTheDocument();
    expect(screen.queryByText(/Suggestions come from Ola Maps/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: words.searchInstead }));
    expect(onSearchAddress).toHaveBeenCalledTimes(1);
  });

  it("shows the found place with Change, and what visitors see", async () => {
    const onChange = vi.fn();
    renderWithMessages(
      <LocationField
        mode="found"
        found={{ label: "Velachery", detail: "Chennai, Tamil Nadu · 600042", approximate: false }}
        onChange={onChange}
      />,
    );
    expect(screen.getByText(words.foundTitle)).toBeInTheDocument();
    expect(screen.getByText("Velachery")).toBeInTheDocument();
    expect(screen.getByText(words.visitorsSee)).toBeInTheDocument();
    expect(screen.queryByText(words.approximateNote)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: words.change }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("says approximate when only the area was chosen", () => {
    renderWithMessages(
      <LocationField mode="found" found={{ label: "Adyar", approximate: true }} />,
    );
    expect(screen.getByText(words.approximateTitle)).toBeInTheDocument();
    expect(screen.getByText(words.approximateNote)).toBeInTheDocument();
  });

  it("warns that suggestions are unavailable and still lets the owner continue", () => {
    renderWithMessages(
      <LocationField mode="area" unavailable box={<select aria-label="Area" />} />,
    );
    expect(screen.getByText(en.domain.places.unavailable.title)).toBeInTheDocument();
    expect(screen.getByText(words.unavailableBody)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Area" })).toBeInTheDocument();
  });

  it("says a location is needed, as an alert that describes the group", () => {
    renderWithMessages(<LocationField mode="search" showError />);
    expect(screen.getByRole("alert")).toHaveTextContent(words.required);
    expect(
      screen.getByRole("group", { name: /Where is the property\?/ }),
    ).toHaveAccessibleDescription(words.required);
  });

  it("shows no error by default", () => {
    renderWithMessages(<LocationField mode="search" />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("LocationPrompt (ADR-131)", () => {
  it("says one listing has no location and links to add it", () => {
    renderWithMessages(<LocationPrompt count={1} href="/dashboard/listings/1" />);
    expect(screen.getByRole("status")).toHaveTextContent("1 of your listings has no location.");
    expect(screen.getByRole("link", { name: /Add location/ })).toHaveAttribute(
      "href",
      "/dashboard/listings/1",
    );
  });

  it("says several listings in the plural", () => {
    renderWithMessages(<LocationPrompt count={3} href="/dashboard/listings" />);
    expect(screen.getByRole("status")).toHaveTextContent("3 of your listings have no location.");
  });
});

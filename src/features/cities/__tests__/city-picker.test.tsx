// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import { CityPicker } from "../city-picker.client";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const cities = [
  { key: "chennai", name: "Chennai", count: 9 },
  { key: "coimbatore", name: "Coimbatore", count: 4 },
];
const labels = { button: "City: Chennai. Change city", heading: "Choose your city" };

beforeEach(() => {
  refresh.mockClear();
  document.cookie = "fp_city=; max-age=0; path=/";
});

describe("CityPicker", () => {
  it("shows the current city on the button", () => {
    renderWithMessages(<CityPicker cities={cities} selectedKey="chennai" labels={labels} />);
    expect(screen.getByRole("button", { name: labels.button })).toHaveTextContent("Chennai");
  });

  it("remembers the chosen city in a cookie and refreshes the page", async () => {
    const user = userEvent.setup();
    renderWithMessages(<CityPicker cities={cities} selectedKey="chennai" labels={labels} />);
    await user.click(screen.getByRole("button", { name: labels.button }));
    await user.click(await screen.findByRole("menuitem", { name: "Coimbatore" }));
    expect(document.cookie).toContain("fp_city=coimbatore");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("does nothing when the current city is chosen again", async () => {
    const user = userEvent.setup();
    renderWithMessages(<CityPicker cities={cities} selectedKey="chennai" labels={labels} />);
    await user.click(screen.getByRole("button", { name: labels.button }));
    await user.click(await screen.findByRole("menuitem", { name: "Chennai" }));
    expect(refresh).not.toHaveBeenCalled();
  });
});

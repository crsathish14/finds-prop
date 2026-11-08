// @vitest-environment jsdom
import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import { UnitForm, type UnitFormValues, type UnitFormWords } from "../unit-form";

const WORDS: UnitFormWords = {
  unitNumber: "Unit number",
  floor: "Floor",
  bhk: "BHK",
  area: "Area (sq.ft)",
  facing: "Facing",
  price: "Price (₹)",
  status: "Status",
  availableFrom: "Available from",
  floorPlanUrl: "Floor plan link",
  optional: "(optional)",
  notSet: "Not set",
  bhkOptions: [
    { value: "2", label: "2" },
    { value: "3", label: "3" },
  ],
  facingOptions: [{ value: "east", label: "East" }],
  statusOptions: [
    { value: "available", label: "Available" },
    { value: "hold", label: "On hold" },
  ],
};

const VALUES: UnitFormValues = {
  unitNumber: "B-303",
  floor: "3",
  bhk: "3",
  area: "1480",
  facing: "east",
  price: "11800000",
  status: "available",
  availableFrom: "2026-12-01",
  floorPlanUrl: "",
};

function show(extra: Partial<Parameters<typeof UnitForm>[0]> = {}) {
  const onChange = vi.fn();
  const onSubmit = vi.fn();
  renderWithMessages(
    <UnitForm
      id="unit-form"
      values={VALUES}
      onChange={onChange}
      onSubmit={onSubmit}
      words={WORDS}
      {...extra}
    />,
  );
  return { onChange, onSubmit };
}

describe("UnitForm: the fields of a unit (S7-T01)", () => {
  it("shows every box with its label and its value, and marks only the unit number required", () => {
    show();
    expect(screen.getByLabelText(/Unit number/)).toHaveValue("B-303");
    expect(screen.getByLabelText(/Unit number/)).toBeRequired();
    expect(screen.getByLabelText(/^Floor(?! plan)/)).toHaveValue("3");
    expect(screen.getByLabelText(/^BHK/)).toHaveValue("3");
    expect(screen.getByLabelText(/^Area/)).toHaveValue("1480");
    expect(screen.getByLabelText(/^Facing/)).toHaveValue("east");
    expect(screen.getByLabelText(/^Price/)).toHaveValue("11800000");
    expect(screen.getByLabelText(/^Status/)).toHaveValue("available");
    expect(screen.getByLabelText(/^Available from/)).toHaveValue("2026-12-01");
    expect(screen.getByLabelText(/^Floor plan link/)).toHaveValue("");
    expect(screen.getByLabelText(/^Floor plan link/)).not.toBeRequired();
  });

  it("offers Not set for bedrooms and facing, and the states in their words", () => {
    show();
    expect(screen.getAllByRole("option", { name: "Not set" })).toHaveLength(2);
    expect(screen.getByRole("option", { name: "On hold" })).toBeInTheDocument();
  });

  it("tells the page which box changed and to what", () => {
    const { onChange } = show();
    fireEvent.change(screen.getByLabelText(/Unit number/), { target: { value: "B-304" } });
    expect(onChange).toHaveBeenCalledWith("unitNumber", "B-304");
    fireEvent.change(screen.getByLabelText(/^Status/), { target: { value: "hold" } });
    expect(onChange).toHaveBeenCalledWith("status", "hold");
  });

  it("puts a message on its own box, tied to it", () => {
    show({ errors: { unitNumber: "Enter a unit number." } });
    expect(screen.getByLabelText(/Unit number/)).toBeInvalid();
    expect(screen.getByLabelText(/Unit number/)).toHaveAccessibleDescription(
      "Enter a unit number.",
    );
  });

  it("is sent by the form's own submit, without the browser leaving the page", () => {
    const { onSubmit } = show();
    expect(fireEvent.submit(document.getElementById("unit-form") as HTMLFormElement)).toBe(false);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("turns every box off while sending", () => {
    show({ disabled: true });
    for (const box of screen.getAllByRole("textbox")) expect(box).toBeDisabled();
    expect(screen.getByLabelText(/^Status/)).toBeDisabled();
  });
});

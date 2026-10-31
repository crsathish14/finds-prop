// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Combobox, type ComboboxOption } from "../combobox";

const LABELS = {
  clear: "Clear locality",
  loading: "Looking for localities",
  noResults: "No localities found",
  resultCount: (count: number) => `${count} localities found`,
};
const OPTIONS: ComboboxOption[] = [
  { value: "velachery", label: "Velachery", hint: "Chennai" },
  { value: "velappanchavadi", label: "Velappanchavadi" },
];

function Example({
  options = OPTIONS,
  loading = false,
  onQueryChange = vi.fn(),
  onSelect = vi.fn(),
}: {
  options?: ComboboxOption[];
  loading?: boolean;
  onQueryChange?: (query: string) => void;
  onSelect?: (option: ComboboxOption) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <Combobox
      aria-label="Locality"
      value={value}
      onValueChange={setValue}
      onQueryChange={onQueryChange}
      onSelect={onSelect}
      options={options}
      loading={loading}
      labels={LABELS}
    />
  );
}

describe("Combobox: roles and keyboard (spike S2-SPK-01)", () => {
  it("is a combobox with a listbox of options once the reader has typed enough", async () => {
    render(<Example />);
    const input = screen.getByRole("combobox", { name: "Locality" });
    expect(input).toHaveAttribute("aria-expanded", "false");
    await userEvent.type(input, "vel");
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(2);
  });

  it("stays closed until the minimum number of characters is typed", async () => {
    render(<Example />);
    await userEvent.type(screen.getByRole("combobox"), "ve");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("moves with the arrow keys, keeps focus in the input, and picks with Enter", async () => {
    const onSelect = vi.fn();
    render(<Example onSelect={onSelect} />);
    const input = screen.getByRole("combobox");
    await userEvent.type(input, "vel");
    await userEvent.keyboard("{ArrowDown}");
    expect(input).toHaveFocus();
    expect(input.getAttribute("aria-activedescendant")).toBeTruthy();
    await userEvent.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith(OPTIONS[1]);
    expect(input).toHaveValue("Velappanchavadi");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("picks with the mouse", async () => {
    const onSelect = vi.fn();
    render(<Example onSelect={onSelect} />);
    await userEvent.type(screen.getByRole("combobox"), "vel");
    await userEvent.click(screen.getByRole("option", { name: /Velachery/ }));
    expect(onSelect).toHaveBeenCalledWith(OPTIONS[0]);
    expect(screen.getByRole("combobox")).toHaveValue("Velachery");
  });

  it("closes the list with Escape and keeps the text", async () => {
    render(<Example />);
    const input = screen.getByRole("combobox");
    await userEvent.type(input, "vel");
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(input).toHaveValue("vel");
    expect(input).toHaveFocus();
  });

  it("clears the text with a named button", async () => {
    render(<Example />);
    const input = screen.getByRole("combobox");
    await userEvent.type(input, "vel");
    await userEvent.click(screen.getByRole("button", { name: "Clear locality" }));
    expect(input).toHaveValue("");
  });

  it("announces the result count, and shows when nothing matched or it is still loading", async () => {
    const { unmount } = render(<Example />);
    await userEvent.type(screen.getByRole("combobox"), "vel");
    expect(screen.getByText("2 localities found")).toHaveAttribute("aria-live", "polite");
    unmount();

    const empty = render(<Example options={[]} />);
    await userEvent.type(screen.getByRole("combobox"), "zzz");
    expect(screen.getAllByText("No localities found").length).toBeGreaterThan(0);
    empty.unmount();

    render(<Example options={[]} loading />);
    await userEvent.type(screen.getByRole("combobox"), "vel");
    expect(screen.getAllByText("Looking for localities").length).toBeGreaterThan(0);
  });
});

describe("Combobox: debounce and minimum length", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const typeText = (text: string) =>
    act(() => {
      fireEvent.change(screen.getByRole("combobox"), { target: { value: text } });
    });
  const wait = (milliseconds: number) =>
    act(() => {
      vi.advanceTimersByTime(milliseconds);
    });

  it("asks for suggestions once, 300 ms after the reader stops typing", () => {
    const onQueryChange = vi.fn();
    render(<Example onQueryChange={onQueryChange} />);
    typeText("vel");
    wait(200);
    typeText("vela");
    wait(299);
    expect(onQueryChange).not.toHaveBeenCalled();
    wait(2);
    expect(onQueryChange).toHaveBeenCalledTimes(1);
    expect(onQueryChange).toHaveBeenCalledWith("vela");
  });

  it("does not ask for a query shorter than three characters", () => {
    const onQueryChange = vi.fn();
    render(<Example onQueryChange={onQueryChange} />);
    typeText("ve");
    wait(1000);
    expect(onQueryChange).not.toHaveBeenCalled();
  });

  it("does not ask again for text the reader picked from the list", async () => {
    const onQueryChange = vi.fn();
    render(<Example onQueryChange={onQueryChange} />);
    typeText("vel");
    wait(301);
    expect(onQueryChange).toHaveBeenCalledTimes(1);
    act(() => {
      screen.getByRole("option", { name: /Velachery/ }).click();
    });
    wait(1000);
    expect(onQueryChange).toHaveBeenCalledTimes(1);
  });
});

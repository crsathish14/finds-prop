// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MapPin, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Combobox, type ComboboxOption } from "../combobox";

const LABELS = {
  clear: "Clear place",
  loading: "Looking for places",
  noResults: "No places found",
  resultCount: (count: number) => `${count} suggestions available`,
};

const PLACES: ComboboxOption[] = [
  { value: "velachery", label: "Velachery", description: "Chennai, Tamil Nadu · 600042" },
  { value: "vellore", label: "Vellore", description: "Vellore, Tamil Nadu" },
];

/** The notes are inside the list; the same words are also read out by the polite live region. */
const inList = () => within(screen.getByRole("listbox"));

type Note = { icon: LucideIcon; title: string; body?: string };

type ExampleProps = {
  options?: ComboboxOption[];
  loading?: boolean;
  notices?: Note[];
  idleNotices?: Note[];
  fallbackOption?: ComboboxOption;
  footer?: string;
  loadingRows?: boolean;
  onSelect?: (option: ComboboxOption) => void;
};

function Example({
  options = PLACES,
  loading = false,
  notices = [],
  idleNotices = [],
  fallbackOption,
  footer,
  loadingRows = false,
  onSelect = vi.fn(),
}: ExampleProps) {
  const [value, setValue] = useState("");
  return (
    <Combobox
      aria-label="Place"
      value={value}
      onValueChange={setValue}
      onQueryChange={vi.fn()}
      onSelect={onSelect}
      options={options}
      loading={loading}
      labels={LABELS}
      notices={notices}
      idleNotices={idleNotices}
      {...(fallbackOption ? { fallbackOption } : {})}
      {...(footer ? { footer } : {})}
      loadingRows={loadingRows}
    />
  );
}

describe("Combobox: place suggestions (ADR-131, UX addendum ADD-07)", () => {
  it("draws a place row with the address under the name and the typed letters marked", async () => {
    render(<Example />);
    await userEvent.type(screen.getByRole("combobox"), "vel");
    expect(screen.getAllByRole("option")).toHaveLength(2);
    expect(screen.getByText("Chennai, Tamil Nadu · 600042")).toBeInTheDocument();
    const marks = document.querySelectorAll("mark");
    expect(marks).toHaveLength(2);
    expect(marks[0]).toHaveTextContent("Vel");
  });

  it("shows the footer at the bottom of the panel", async () => {
    render(<Example footer="Powered by Ola Maps" />);
    await userEvent.type(screen.getByRole("combobox"), "vel");
    expect(screen.getByText("Powered by Ola Maps")).toBeInTheDocument();
  });

  it("shows the idle notes before enough letters are typed, and no options", async () => {
    render(
      <Example
        options={[]}
        idleNotices={[{ icon: MapPin, title: "Type at least 3 characters" }]}
      />,
    );
    const input = screen.getByRole("combobox");
    await userEvent.click(input);
    expect(inList().getByText("Type at least 3 characters")).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-expanded", "true");
    await userEvent.type(input, "ve");
    expect(inList().getByText("Type at least 3 characters")).toBeInTheDocument();
    await userEvent.type(input, "l");
    expect(inList().queryByText("Type at least 3 characters")).not.toBeInTheDocument();
  });

  it("stays closed when there is no idle note, as it always did", async () => {
    render(<Example />);
    await userEvent.click(screen.getByRole("combobox"));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("shows the notes and the keyword row, and the keyword row keeps the typed text", async () => {
    const onSelect = vi.fn();
    const keyword: ComboboxOption = {
      value: "keyword",
      label: "Search for “Velxy” as a keyword",
      description: "Matches listings by name",
    };
    render(
      <Example
        options={[]}
        notices={[
          { icon: MapPin, title: "No places found for “Velxy”", body: "Check the spelling." },
        ]}
        fallbackOption={keyword}
        onSelect={onSelect}
      />,
    );
    const input = screen.getByRole("combobox");
    await userEvent.type(input, "Velxy");
    expect(inList().getByText("No places found for “Velxy”")).toBeInTheDocument();
    expect(inList().queryByText(LABELS.noResults)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("option", { name: /Search for “Velxy” as a keyword/ }));
    expect(onSelect).toHaveBeenCalledWith(keyword);
    expect(input).toHaveValue("Velxy");
  });

  it("shows grey rows while loading when asked, and says so politely", async () => {
    render(<Example options={[]} loading loadingRows />);
    await userEvent.type(screen.getByRole("combobox"), "vel");
    expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThanOrEqual(6);
    expect(screen.getAllByText(LABELS.loading).length).toBeGreaterThan(0);
  });

  it("opens at once with defaultOpen, for the Design Lab", () => {
    render(
      <Combobox
        aria-label="Place"
        value="Vel"
        onValueChange={vi.fn()}
        onQueryChange={vi.fn()}
        onSelect={vi.fn()}
        options={PLACES}
        labels={LABELS}
        defaultOpen
      />,
    );
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });
});

// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Search, X } from "lucide-react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "../button";
import { Chip } from "../chip";
import { Icon } from "../icon";
import { IconButton } from "../icon-button";
import { Input } from "../input";
import { Label } from "../label";
import { NativeSelect } from "../native-select";
import { RemovableChip } from "../removable-chip";
import { SegmentedControl } from "../segmented-control";
import { Textarea } from "../textarea";

describe("Button: loading and icons", () => {
  it("keeps the label, is marked busy, and ignores clicks while loading", async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Send enquiry
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Send enquiry" });
    expect(button).toHaveAttribute("aria-busy", "true");
    await userEvent.click(button);
    button.focus();
    await userEvent.keyboard("{Enter}");
    expect(onClick).not.toHaveBeenCalled();
  });

  it("does not submit a form while loading", async () => {
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Button type="submit" loading>
          Send
        </Button>
      </form>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("works normally when not loading", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Send</Button>);
    expect(screen.getByRole("button")).not.toHaveAttribute("aria-busy");
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("shows icons before and after the label", () => {
    render(
      <Button iconStart={<Icon icon={Search} />} iconEnd={<Icon icon={X} />}>
        Search
      </Button>,
    );
    expect(screen.getByRole("button", { name: "Search" }).querySelectorAll("svg")).toHaveLength(2);
  });
});

describe("Input and Textarea extras", () => {
  it("shows a leading icon inside the field and leaves room for it", () => {
    render(<Input aria-label="Locality" leading={<Icon icon={Search} />} />);
    const input = screen.getByLabelText("Locality");
    expect(input).toHaveClass("pl-10");
    expect(input.parentElement?.querySelector("svg")).toBeInTheDocument();
  });

  it("keeps a trailing control reachable and named", async () => {
    const onClick = vi.fn();
    render(
      <Input
        aria-label="Search"
        trailing={
          <IconButton aria-label="Clear search" onClick={onClick}>
            <Icon icon={X} />
          </IconButton>
        }
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("sets aria-invalid from `invalid`", () => {
    render(<Input aria-label="Phone" invalid />);
    expect(screen.getByLabelText("Phone")).toBeInvalid();
  });

  it("announces the textarea counter politely", () => {
    render(<Textarea aria-label="Message" counter="120 / 500" />);
    expect(screen.getByText("120 / 500")).toHaveAttribute("aria-live", "polite");
  });

  it("grows with its text when autoGrow is set", () => {
    render(<Textarea aria-label="Message" autoGrow />);
    expect(screen.getByLabelText("Message")).toHaveClass("field-sizing-content");
  });

  it("marks a required label and an optional label", () => {
    render(
      <>
        <Label htmlFor="name" required>
          Name
        </Label>
        <Label htmlFor="note" optionalLabel="(optional)">
          Note
        </Label>
      </>,
    );
    expect(screen.getByText("*")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("(optional)")).toBeInTheDocument();
  });
});

describe("NativeSelect", () => {
  it("lets the reader pick an option", async () => {
    render(
      <>
        <Label htmlFor="bedrooms">Bedrooms</Label>
        <NativeSelect id="bedrooms" defaultValue="2">
          <option value="1">1 BHK</option>
          <option value="2">2 BHK</option>
          <option value="3">3 BHK</option>
        </NativeSelect>
      </>,
    );
    const select = screen.getByLabelText("Bedrooms");
    await userEvent.selectOptions(select, "3");
    expect(select).toHaveValue("3");
  });

  it("marks an invalid select", () => {
    render(
      <NativeSelect aria-label="Type" invalid>
        <option>Flat</option>
      </NativeSelect>,
    );
    expect(screen.getByLabelText("Type")).toBeInvalid();
  });
});

describe("Chip and RemovableChip", () => {
  it("toggles with aria-pressed and shows a tick when selected", async () => {
    function Example() {
      const [selected, setSelected] = useState(false);
      return (
        <Chip selected={selected} onClick={() => setSelected((value) => !value)}>
          Velachery
        </Chip>
      );
    }
    render(<Example />);
    const chip = screen.getByRole("button", { name: "Velachery" });
    expect(chip).toHaveAttribute("aria-pressed", "false");
    expect(chip.querySelector("svg")).not.toBeInTheDocument();
    await userEvent.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "true");
    expect(chip.querySelector("svg")).toBeInTheDocument();
  });

  it("can be a link without a pressed state", () => {
    render(
      <Chip asChild>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- checks that a chip can wrap a plain link */}
        <a href="/search?locality=adyar">Adyar</a>
      </Chip>,
    );
    const link = screen.getByRole("link", { name: "Adyar" });
    expect(link).not.toHaveAttribute("aria-pressed");
    expect(link).toHaveClass("rounded-pill");
  });

  it("removes through a button that names what will be removed", async () => {
    const onRemove = vi.fn();
    render(
      <RemovableChip onRemove={onRemove} removeLabel="Remove filter: 3 BHK">
        3 BHK
      </RemovableChip>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Remove filter: 3 BHK" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});

describe("SegmentedControl", () => {
  const options = [
    { value: "all", label: "All" },
    { value: "buy", label: "Buy", count: 12 },
    { value: "rent", label: "Rent" },
  ];

  it("selects one option and reports it", async () => {
    const onValueChange = vi.fn();
    render(
      <SegmentedControl
        aria-label="Listing type"
        options={options}
        defaultValue="all"
        onValueChange={onValueChange}
      />,
    );
    expect(screen.getByRole("radiogroup", { name: "Listing type" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: /Buy/ }));
    expect(onValueChange).toHaveBeenCalledWith("buy");
    expect(screen.getByRole("radio", { name: /Buy/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: "All" })).not.toBeChecked();
  });

  it("always keeps one option selected", async () => {
    const onValueChange = vi.fn();
    render(
      <SegmentedControl
        aria-label="Listing type"
        options={options}
        defaultValue="all"
        onValueChange={onValueChange}
      />,
    );
    await userEvent.click(screen.getByRole("radio", { name: "All" }));
    expect(screen.getByRole("radio", { name: "All" })).toBeChecked();
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("moves between options with the arrow keys", async () => {
    render(<SegmentedControl aria-label="Listing type" options={options} defaultValue="all" />);
    await userEvent.tab();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: /Buy/ })).toHaveFocus();
  });

  it("shows a link-tab that navigates instead of selecting", () => {
    render(
      <SegmentedControl
        aria-label="Search for"
        options={[...options, { href: "/projects", label: "New projects" }]}
        defaultValue="buy"
      />,
    );
    expect(screen.getByRole("link", { name: "New projects" })).toHaveAttribute("href", "/projects");
  });
});

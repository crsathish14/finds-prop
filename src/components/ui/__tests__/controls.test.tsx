// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Avatar, AvatarFallback } from "../avatar";
import { Badge } from "../badge";
import { Button } from "../button";
import { Checkbox } from "../checkbox";
import { Input } from "../input";
import { Label } from "../label";
import { RadioGroup, RadioGroupItem } from "../radio-group";
import { Separator } from "../separator";
import { Skeleton } from "../skeleton";
import { Switch } from "../switch";
import { Textarea } from "../textarea";

describe("Button", () => {
  it("is a native button that calls onClick", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not fire when disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Save
      </Button>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("maps variant and size to token classes, and has no shadcn default styles", () => {
    render(
      <Button variant="accent" size="lg" pill>
        Search
      </Button>,
    );
    const button = screen.getByRole("button");
    expect(button).toHaveClass("bg-cta", "text-on-cta", "h-(--size-btn-lg)", "rounded-pill");
    expect(button.className).not.toMatch(/bg-primary\/|text-primary-foreground|ring-ring/);
  });

  it("can render a link with the button look", () => {
    render(
      <Button asChild variant="secondary">
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- checks that the button look can sit on a plain link */}
        <a href="/properties">Browse</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Browse" });
    expect(link).toHaveAttribute("href", "/properties");
    expect(link).toHaveClass("text-primary", "border-primary");
  });
});

describe("Input, Textarea and Label", () => {
  it("connects a label to its input", async () => {
    render(
      <>
        <Label htmlFor="locality">Locality</Label>
        <Input id="locality" />
      </>,
    );
    await userEvent.type(screen.getByLabelText("Locality"), "Velachery");
    expect(screen.getByLabelText("Locality")).toHaveValue("Velachery");
  });

  it("marks an invalid field with aria-invalid", () => {
    render(<Input aria-label="Phone" aria-invalid="true" />);
    expect(screen.getByLabelText("Phone")).toBeInvalid();
  });

  it("keeps a disabled input out of the tab order", async () => {
    render(<Input aria-label="Phone" disabled />);
    await userEvent.tab();
    expect(screen.getByLabelText("Phone")).not.toHaveFocus();
  });

  it("accepts text in a textarea", async () => {
    render(<Textarea aria-label="Message" />);
    await userEvent.type(screen.getByLabelText("Message"), "Hello");
    expect(screen.getByLabelText("Message")).toHaveValue("Hello");
  });
});

describe("Checkbox, RadioGroup and Switch", () => {
  it("toggles a checkbox with the mouse and the space bar", async () => {
    render(
      <>
        <Checkbox id="parking" />
        <Label htmlFor="parking">Parking</Label>
      </>,
    );
    const checkbox = screen.getByRole("checkbox", { name: "Parking" });
    await userEvent.click(screen.getByText("Parking"));
    expect(checkbox).toBeChecked();
    await userEvent.keyboard(" ");
    expect(checkbox).not.toBeChecked();
  });

  it("shows the indeterminate state", () => {
    render(<Checkbox aria-label="All" checked="indeterminate" />);
    expect(screen.getByRole("checkbox", { name: "All" })).toHaveAttribute("aria-checked", "mixed");
  });

  it("selects one radio at a time and moves focus with the arrow keys", async () => {
    render(
      <RadioGroup defaultValue="buy" aria-label="Looking to">
        <RadioGroupItem value="buy" aria-label="Buy" />
        <RadioGroupItem value="rent" aria-label="Rent" />
      </RadioGroup>,
    );
    expect(screen.getByRole("radio", { name: "Buy" })).toBeChecked();
    await userEvent.tab();
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("radio", { name: "Rent" })).toHaveFocus();
    await userEvent.keyboard(" ");
    expect(screen.getByRole("radio", { name: "Rent" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Buy" })).not.toBeChecked();
  });

  it("flips a switch and reports the change", async () => {
    const onCheckedChange = vi.fn();
    render(<Switch aria-label="Show on map" onCheckedChange={onCheckedChange} />);
    const toggle = screen.getByRole("switch", { name: "Show on map" });
    expect(toggle).not.toBeChecked();
    await userEvent.click(toggle);
    expect(toggle).toBeChecked();
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });
});

describe("Badge, Avatar, Separator and Skeleton", () => {
  it("shows a status as a word with a dot", () => {
    render(
      <Badge tone="success" dot>
        Live
      </Badge>,
    );
    const badge = screen.getByText("Live");
    expect(badge).toHaveClass("bg-success-tint", "text-success", "before:rounded-pill");
  });

  it("shows initials when there is no image", () => {
    render(
      <Avatar>
        <AvatarFallback>SK</AvatarFallback>
      </Avatar>,
    );
    expect(screen.getByText("SK")).toBeInTheDocument();
  });

  it("hides a decorative separator from screen readers but exposes a meaningful one", () => {
    const { rerender } = render(<Separator />);
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
    rerender(<Separator decorative={false} />);
    expect(screen.getByRole("separator")).toBeInTheDocument();
  });

  it("hides a skeleton from screen readers", () => {
    render(<Skeleton data-testid="skeleton" />);
    expect(screen.getByTestId("skeleton")).toHaveAttribute("aria-hidden", "true");
  });
});

// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Heart } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { ArchIllustration } from "../arch-illustration";
import { ArchMark } from "../arch-mark";
import { Icon } from "../icon";
import { IconButton } from "../icon-button";
import { Link } from "../link";
import { Logo } from "../logo";
import { SkipLink } from "../skip-link";
import { VisuallyHidden } from "../visually-hidden";

describe("Icon", () => {
  it("is hidden from screen readers by default", () => {
    const { container } = render(<Icon icon={Heart} />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("becomes an image with a name when given a label", () => {
    render(<Icon icon={Heart} label="Saved" />);
    expect(screen.getByRole("img", { name: "Saved" })).toBeInTheDocument();
  });

  it("maps sizes to token-free size classes", () => {
    const { container } = render(<Icon icon={Heart} size="lg" />);
    expect(container.querySelector("svg")).toHaveClass("size-6");
  });
});

describe("IconButton", () => {
  it("is named by its aria-label and calls onClick", async () => {
    const onClick = vi.fn();
    render(
      <IconButton aria-label="Close menu" onClick={onClick}>
        <Icon icon={Heart} />
      </IconButton>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Close menu" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("is a toggle when `pressed` is given", () => {
    const { rerender } = render(
      <IconButton aria-label="Save" pressed={false}>
        <Icon icon={Heart} />
      </IconButton>,
    );
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("aria-pressed", "false");
    rerender(
      <IconButton aria-label="Save" pressed>
        <Icon icon={Heart} />
      </IconButton>,
    );
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("aria-pressed", "true");
  });

  it("does not submit a form by accident", () => {
    render(
      <IconButton aria-label="Close">
        <Icon icon={Heart} />
      </IconButton>,
    );
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });

  it("requires a label in its type", () => {
    // @ts-expect-error aria-label is required, so leaving it out is a type error (R-DS: label enforced by types)
    const missingLabel = <IconButton>x</IconButton>;
    expect(missingLabel).toBeTruthy();
  });
});

describe("Link", () => {
  it("renders an internal link and marks the current page", () => {
    render(
      <Link href="/properties" current>
        Properties
      </Link>,
    );
    const link = screen.getByRole("link", { name: "Properties" });
    expect(link).toHaveAttribute("href", "/properties");
    expect(link).toHaveAttribute("aria-current", "page");
    expect(link).not.toHaveAttribute("target");
  });

  it("opens an external link in a new tab safely and says so to screen readers", () => {
    render(
      <Link href="https://example.com/a" external newTabLabel="(opens in a new tab)">
        Example
      </Link>,
    );
    const link = screen.getByRole("link", { name: /Example/ });
    expect(link).toHaveTextContent("(opens in a new tab)");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener");
  });

  it("marks a sponsor link as sponsored", () => {
    render(
      <Link href="https://sponsor.example/offer" sponsored>
        Offer
      </Link>,
    );
    expect(screen.getByRole("link", { name: "Offer" })).toHaveAttribute(
      "rel",
      "sponsored noopener",
    );
  });

  it.each(["http://sponsor.example/offer", "javascript:alert(1)", "/relative"])(
    "shows a sponsor link that is not https (%s) as plain text",
    (href) => {
      render(
        <Link href={href} sponsored>
          Offer
        </Link>,
      );
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
      expect(screen.getByText("Offer")).toBeInTheDocument();
    },
  );

  it("adds a moving arrow to the arrow variant", () => {
    const { container } = render(
      <Link href="/more" variant="arrow">
        See all
      </Link>,
    );
    expect(container.querySelector("a svg")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("Logo, ArchMark, ArchIllustration, SkipLink, VisuallyHidden", () => {
  it("sets the last word of the brand name in bold", () => {
    render(<Logo name="Find Prop" />);
    expect(screen.getByText("Prop").tagName).toBe("B");
    expect(screen.getByText(/Find/)).toBeInTheDocument();
  });

  it("hides the mark from screen readers unless it has a title", () => {
    const { container, rerender } = render(<ArchMark />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    rerender(<ArchMark title="Find Prop" />);
    expect(screen.getByRole("img", { name: "Find Prop" })).toBeInTheDocument();
  });

  it("treats the empty-state drawing as decoration", () => {
    const { container } = render(<ArchIllustration />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("is a skip link to #main that is first in the tab order", async () => {
    render(
      <>
        <SkipLink>Skip to content</SkipLink>
        <button type="button">Other</button>
      </>,
    );
    await userEvent.tab();
    const link = screen.getByRole("link", { name: "Skip to content" });
    expect(link).toHaveFocus();
    expect(link).toHaveAttribute("href", "#main");
  });

  it("keeps visually hidden text in the reading order", () => {
    render(
      <button type="button">
        Share <VisuallyHidden>this property</VisuallyHidden>
      </button>,
    );
    expect(screen.getByRole("button", { name: "Share this property" })).toBeInTheDocument();
  });
});

// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Skeleton } from "../skeleton";
import { Spinner } from "../spinner";

describe("Spinner", () => {
  it("announces its label as a status", () => {
    render(<Spinner label="Loading homes" />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading homes");
  });

  it("is hidden from screen readers when it has no label", () => {
    const { container } = render(<Spinner />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("maps size to a size class", () => {
    const { container } = render(<Spinner size="lg" />);
    expect(container.firstElementChild).toHaveClass("size-10", "animate-spin");
  });
});

describe("Skeleton", () => {
  it("is hidden from screen readers and shimmers", () => {
    render(<Skeleton data-testid="skeleton" />);
    expect(screen.getByTestId("skeleton")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId("skeleton")).toHaveClass("animate-shimmer");
  });

  it.each([
    ["text", "h-3.5"],
    ["title", "h-5"],
    ["circle", "rounded-pill"],
    ["image", "aspect-4/3"],
    ["row", "h-14"],
    ["card", "min-h-64"],
  ] as const)("has a %s shape", (shape, expected) => {
    render(<Skeleton data-testid="skeleton" shape={shape} />);
    expect(screen.getByTestId("skeleton")).toHaveClass(expected);
  });
});

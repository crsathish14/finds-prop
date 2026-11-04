// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Heading, TitleWithEmphasis } from "../heading";
import { Price } from "../price";
import { Text } from "../text";

describe("Heading", () => {
  it("renders the element named by `as`, whatever the size", () => {
    render(
      <Heading as="h1" size="3">
        Title
      </Heading>,
    );
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.tagName).toBe("H1");
    expect(heading).toHaveClass("text-h3", "text-primary");
  });

  it("maps each size to its type style", () => {
    render(
      <>
        <Heading as="h2" size="display">
          First
        </Heading>
        <Heading as="h2" size="1">
          Second
        </Heading>
        <Heading as="h2" size="2">
          Third
        </Heading>
      </>,
    );
    expect(screen.getByText("First")).toHaveClass("text-display");
    expect(screen.getByText("Second")).toHaveClass("text-h1");
    expect(screen.getByText("Third")).toHaveClass("text-h2");
  });

  it("lets a caller class win over the default colour", () => {
    render(
      <Heading as="h2" size="2" className="text-on-dark">
        Title
      </Heading>,
    );
    const heading = screen.getByRole("heading");
    expect(heading).toHaveClass("text-on-dark");
    expect(heading).not.toHaveClass("text-primary");
  });

  it("renders italic copper emphasis inside a heading", () => {
    render(
      <Heading as="h1" size="display">
        Find a home <Heading.Em>you love</Heading.Em>
      </Heading>,
    );
    const emphasis = screen.getByText("you love");
    expect(emphasis.tagName).toBe("EM");
    expect(emphasis).toHaveClass("em-accent");
  });
});

describe("TitleWithEmphasis", () => {
  it("sets the named part of the title in italic copper and leaves the rest plain", () => {
    render(
      <Heading as="h1" size="display">
        <TitleWithEmphasis
          title="Find the place that fits your life in Chennai."
          emphasis="Chennai"
        />
      </Heading>,
    );
    const heading = screen.getByRole("heading", {
      name: "Find the place that fits your life in Chennai.",
    });
    expect(screen.getByText("Chennai").tagName).toBe("EM");
    expect(heading.textContent).toBe("Find the place that fits your life in Chennai.");
  });

  it("shows the title plain when the emphasis is missing or is not part of it", () => {
    const { container, rerender } = render(<TitleWithEmphasis title="Find a home" />);
    expect(container.textContent).toBe("Find a home");
    rerender(<TitleWithEmphasis title="Find a home" emphasis="Chennai" />);
    expect(container.textContent).toBe("Find a home");
    expect(container.querySelector("em")).not.toBeInTheDocument();
  });
});

describe("Text", () => {
  it("is a paragraph in body type and ink by default", () => {
    render(<Text>Hello</Text>);
    const text = screen.getByText("Hello");
    expect(text.tagName).toBe("P");
    expect(text).toHaveClass("text-body", "text-ink");
  });

  it("uses a muted tone for lead and overline", () => {
    render(
      <>
        <Text variant="lead">Lead</Text>
        <Text variant="overline">Overline</Text>
      </>,
    );
    expect(screen.getByText("Lead")).toHaveClass("text-lead", "text-muted");
    expect(screen.getByText("Overline")).toHaveClass("text-overline", "text-muted");
  });

  it("changes the element and the tone independently of the variant", () => {
    render(
      <Text as="span" variant="small" tone="accent">
        Note
      </Text>,
    );
    const text = screen.getByText("Note");
    expect(text.tagName).toBe("SPAN");
    expect(text).toHaveClass("text-small", "text-cta-text");
    expect(text).not.toHaveClass("text-ink");
  });
});

describe("Price", () => {
  it("is plain inline text with the price style", () => {
    render(<Price>78 L</Price>);
    const price = screen.getByText("78 L");
    expect(price.tagName).toBe("SPAN");
    expect(price).toHaveClass("text-price", "text-ink");
  });

  it("has a large size for detail pages", () => {
    render(<Price size="large">1.25 Cr</Price>);
    const price = screen.getByText("1.25 Cr");
    expect(price).toHaveClass("text-price-lg", "text-primary");
    expect(price).not.toHaveClass("text-price");
  });
});

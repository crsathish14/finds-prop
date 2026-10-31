// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "@/components/ui/button";
import { ErrorScreen } from "../error-screen";

const base = {
  code: "Error 404",
  title: "This page isn't here",
  emphasis: "here",
  description: "The link may be old or mistyped.",
};

describe("ErrorScreen", () => {
  it("is the main landmark, with the title as the page heading and the code above it", () => {
    render(<ErrorScreen {...base} />);
    expect(screen.getByRole("main")).toHaveAttribute("id", "main");
    expect(
      screen.getByRole("heading", { level: 1, name: "This page isn't here" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Error 404")).toHaveClass("text-cta-text");
    expect(screen.getByText("The link may be old or mistyped.")).toBeInTheDocument();
  });

  it("sets the emphasised part of the title in italic copper, and the rest plainly", () => {
    render(<ErrorScreen {...base} />);
    expect(screen.getByText("here")).toHaveClass("em-accent");
    expect(screen.getByRole("heading").textContent).toBe("This page isn't here");
  });

  it("ignores an emphasis that is not part of the title", () => {
    render(<ErrorScreen {...base} emphasis="missing" />);
    expect(screen.getByRole("heading").textContent).toBe("This page isn't here");
    expect(document.querySelector(".em-accent")).not.toBeInTheDocument();
  });

  it("can emphasise a part in the middle of the title", () => {
    render(<ErrorScreen {...base} title="We couldn't load this page" emphasis="this page" />);
    expect(screen.getByRole("heading").textContent).toBe("We couldn't load this page");
    expect(screen.getByText("this page")).toHaveClass("em-accent");
  });

  it("shows the next steps", () => {
    render(
      <ErrorScreen
        {...base}
        actions={
          <>
            <Button>Try again</Button>
            <Button variant="secondary">Go home</Button>
          </>
        }
      />,
    );
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go home" })).toBeInTheDocument();
  });

  it("keeps the support reference in a fold-out that is closed until asked", () => {
    render(
      <ErrorScreen {...base} details={{ summary: "Technical details", text: "Reference: 123" }} />,
    );
    const summary = screen.getByText("Technical details");
    expect(summary.closest("details")).not.toHaveAttribute("open");
    expect(screen.getByText("Reference: 123")).toBeInTheDocument();
  });

  it("has no fold-out when there are no details, and hides the drawing from screen readers", () => {
    const { container } = render(<ErrorScreen {...base} />);
    expect(container.querySelector("details")).not.toBeInTheDocument();
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("can sit inside a page that already has a main landmark", () => {
    render(<ErrorScreen {...base} as="div" />);
    expect(screen.queryByRole("main")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });
});

describe("ErrorScreen heading level", () => {
  it("uses a lower heading level when shown inside another page", () => {
    render(<ErrorScreen {...base} as="div" titleAs="h3" />);
    expect(
      screen.getByRole("heading", { level: 3, name: "This page isn't here" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
  });
});

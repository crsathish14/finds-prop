// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const { ProjectsRetry, ProjectsRetryView } = await import("../projects-retry.client");

beforeEach(() => {
  refresh.mockClear();
});

describe("ProjectsRetry: Try again for a list that failed to load", () => {
  it("asks the server for the page again", () => {
    render(<ProjectsRetry label="Try again" />);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("is only the button when it is given its own action (the Design Lab)", () => {
    const onRetry = vi.fn();
    render(<ProjectsRetryView label="Try again" onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows it is busy, and does nothing a second time, while pending", () => {
    const onRetry = vi.fn();
    render(<ProjectsRetryView label="Try again" pending onRetry={onRetry} />);
    const button = screen.getByRole("button", { name: "Try again" });
    expect(button).toHaveAttribute("aria-busy", "true");
    fireEvent.click(button);
    expect(onRetry).not.toHaveBeenCalled();
  });
});

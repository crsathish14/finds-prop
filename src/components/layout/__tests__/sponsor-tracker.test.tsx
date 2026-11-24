// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { SponsorTracker } from "../sponsor-tracker.client";

type Watcher = IntersectionObserver & { callback: IntersectionObserverCallback };

// tests/setup.ts provides a stub IntersectionObserver that keeps its callback.
let observe: MockInstance;
let disconnect: MockInstance;

const watching = () => {
  const stopped = new Set(disconnect.mock.contexts);
  return (observe.mock.contexts as Watcher[]).filter((observer) => !stopped.has(observer));
};

const show = (ratio: number) =>
  act(() => {
    for (const observer of watching()) {
      observer.callback(
        [{ isIntersecting: ratio > 0, intersectionRatio: ratio } as IntersectionObserverEntry],
        observer,
      );
    }
  });

beforeEach(() => {
  vi.useFakeTimers();
  observe = vi.spyOn(IntersectionObserver.prototype, "observe");
  disconnect = vi.spyOn(IntersectionObserver.prototype, "disconnect");
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const draw = (record = vi.fn(async () => ({ ok: true })), active = true) => {
  const view = render(
    <SponsorTracker slot="hero" sponsorKey="ad-1" record={record} active={active}>
      <a href="https://example.com/lake">View project</a>
      <span>Words</span>
    </SponsorTracker>,
  );
  return { record, view };
};

describe("SponsorTracker (ADR-194)", () => {
  it("counts a view once half of it has been on screen for a second", () => {
    const { record } = draw();
    show(0.6);
    act(() => vi.advanceTimersByTime(999));
    expect(record).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(record).toHaveBeenCalledExactlyOnceWith({ slot: "hero", key: "ad-1", kind: "view" });
    show(0.9);
    act(() => vi.advanceTimersByTime(5000));
    expect(record).toHaveBeenCalledTimes(1);
  });

  it("does not count a glimpse, or a sliver on screen", () => {
    const { record } = draw();
    show(0.3);
    act(() => vi.advanceTimersByTime(3000));
    show(0.7);
    act(() => vi.advanceTimersByTime(500));
    show(0);
    act(() => vi.advanceTimersByTime(3000));
    expect(record).not.toHaveBeenCalled();
  });

  it("does not count an ad waiting its turn in the frame", () => {
    const { record } = draw(undefined, false);
    expect(observe).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(3000));
    expect(record).not.toHaveBeenCalled();
  });

  it("counts a click on one of its links, once", () => {
    const { record } = draw();
    fireEvent.click(screen.getByText("Words"));
    expect(record).not.toHaveBeenCalled();
    const link = screen.getByRole("link", { name: "View project" });
    link.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(link);
    fireEvent.click(link);
    expect(record).toHaveBeenCalledExactlyOnceWith({ slot: "hero", key: "ad-1", kind: "click" });
  });

  it("counts nothing without the action, and never shows a failure", () => {
    render(
      <SponsorTracker slot="spotlight" sponsorKey="b1">
        <a href="https://example.com/x">Go</a>
      </SponsorTracker>,
    );
    expect(observe).not.toHaveBeenCalled();
    const failing = vi.fn(async () => {
      throw new Error("offline");
    });
    const { view } = draw(failing);
    show(1);
    act(() => vi.advanceTimersByTime(1000));
    expect(failing).toHaveBeenCalledTimes(1);
    expect(view.container).toHaveTextContent("View projectWords");
  });
});

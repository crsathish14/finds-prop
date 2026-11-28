// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { ANSWER_ID_ATTRIBUTE, pickMostInView, useActiveAnswer } from "../use-active-answer";

type Watcher = IntersectionObserver & { callback: IntersectionObserverCallback };

describe("pickMostInView: the answer most in view", () => {
  it("picks the biggest share, and the newest of two that tie", () => {
    const order = ["a1", "a2", "a3"];
    expect(
      pickMostInView(
        new Map([
          ["a1", 0.2],
          ["a2", 0.7],
          ["a3", 0.4],
        ]),
        order,
      ),
    ).toBe("a2");
    expect(
      pickMostInView(
        new Map([
          ["a1", 0.5],
          ["a2", 0.5],
        ]),
        order,
      ),
    ).toBe("a2");
  });

  it("never picks an answer with nothing showing", () => {
    expect(pickMostInView(new Map([["a1", 0]]), ["a1"])).toBeNull();
    expect(pickMostInView(new Map(), ["a1"])).toBeNull();
  });
});

// tests/setup.ts provides a stub IntersectionObserver that keeps its callback.
let observe: MockInstance;
let disconnect: MockInstance;

beforeEach(() => {
  observe = vi.spyOn(IntersectionObserver.prototype, "observe");
  disconnect = vi.spyOn(IntersectionObserver.prototype, "disconnect");
});

afterEach(() => vi.restoreAllMocks());

function watchers() {
  const stopped = new Set(disconnect.mock.contexts);
  return (observe.mock.contexts as Watcher[]).filter((observer) => !stopped.has(observer));
}

function report(id: string, ratio: number) {
  const target = document.querySelector(`[${ANSWER_ID_ATTRIBUTE}="${id}"]`) as Element;
  act(() => {
    for (const observer of watchers()) {
      observer.callback(
        [
          {
            target,
            isIntersecting: ratio > 0,
            intersectionRatio: ratio,
          } as IntersectionObserverEntry,
        ],
        observer,
      );
    }
  });
}

const ANSWERS = [
  { id: "a1", hasCards: true },
  { id: "a2", hasCards: false },
  { id: "a3", hasCards: true },
];

function Probe({ inFlight = null }: { inFlight?: string | null }) {
  const active = useActiveAnswer(ANSWERS, inFlight);
  return (
    <>
      {ANSWERS.map((answer) => (
        <div key={answer.id} {...{ [ANSWER_ID_ATTRIBUTE]: answer.id }} />
      ))}
      <output>{active ?? "none"}</output>
    </>
  );
}

describe("useActiveAnswer: the answer the cards page follows", () => {
  it("starts on the last answer with cards", () => {
    render(<Probe />);
    expect(screen.getByRole("status")).toHaveTextContent("a3");
  });

  it("follows the answer most in view as the visitor scrolls", () => {
    render(<Probe />);
    report("a1", 0.8);
    expect(screen.getByRole("status")).toHaveTextContent("a1");
    report("a3", 0.9);
    expect(screen.getByRole("status")).toHaveTextContent("a3");
  });

  it("keeps the cards of the answer before when the answer in view has none", () => {
    render(<Probe />);
    report("a1", 0.3);
    report("a2", 0.9);
    expect(screen.getByRole("status")).toHaveTextContent("a1");
  });

  it("follows the answer being written while it streams, whatever is in view", () => {
    const { rerender } = render(<Probe />);
    report("a1", 0.9);
    rerender(<Probe inFlight="a3" />);
    expect(screen.getByRole("status")).toHaveTextContent("a3");
  });

  it("stops watching when it is taken away", () => {
    const { unmount } = render(<Probe />);
    expect(watchers().length).toBeGreaterThan(0);
    unmount();
    expect(watchers()).toHaveLength(0);
  });
});

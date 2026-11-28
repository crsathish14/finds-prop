// @vitest-environment jsdom
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { renderWithMessages } from "../../../../tests/render-intl";
import { AiCardsPage, AiCardsPageList } from "../ai-cards-page.client";

const renderPage = (key: string) => (
  <AiCardsPageList>
    {[<p key="1">{`${key} first`}</p>, <p key="2">{`${key} second`}</p>]}
  </AiCardsPageList>
);

function draw(overrides: Partial<Parameters<typeof AiCardsPage>[0]> = {}) {
  const onAnswer = vi.fn();
  const onPage = vi.fn();
  const props = {
    pageKey: "a1",
    order: 0,
    renderPage,
    answers: { count: 3, current: 0, onSelect: onAnswer },
    pages: { count: 2, current: 0, onSelect: onPage },
    ...overrides,
  };
  const view = renderWithMessages(<AiCardsPage {...props} />);
  return { onAnswer, onPage, view, props };
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: false,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList,
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("AiCardsPage: the page of compact cards beside the chat (ADR-220)", () => {
  it("shows the cards of the page in a list", () => {
    draw();
    expect(screen.getByText("a1 first")).toBeInTheDocument();
    const list = document.querySelector("[data-slot=ai-cards-list]") as HTMLElement;
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
  });

  it("draws a grid of two when asked, and the leading control in the first row", () => {
    const view = renderWithMessages(
      <AiCardsPage
        pageKey="a1"
        order={0}
        renderPage={(key) => (
          <AiCardsPageList layout="grid">
            {[<p key="1">{key}</p>, <p key="2">two</p>]}
          </AiCardsPageList>
        )}
        answers={{ count: 2, current: 0, onSelect: vi.fn() }}
        leading={<button type="button">Back to the chat</button>}
      />,
    );
    expect(document.querySelector("[data-slot=ai-cards-list]")).toHaveClass("grid-cols-2");
    const back = screen.getByRole("button", { name: "Back to the chat" });
    expect(back.parentElement).toHaveClass("lg:hidden");
    // The row that holds it also holds the dots, and sits above the cards below lg.
    expect(back.parentElement?.parentElement).toContainElement(
      screen.getByRole("button", { name: "Show the cards for answer 2" }),
    );
    expect(back.parentElement?.parentElement).toHaveClass("max-lg:order-first");
    view.unmount();
  });

  it("says which answer it is on and marks that answer's dot", () => {
    draw({ answers: { count: 3, current: 1, onSelect: vi.fn() } });
    expect(screen.getByText("Answer 2 of 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show the cards for answer 2" })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  it("moves to the answer whose dot is pressed", async () => {
    const { onAnswer } = draw();
    await userEvent.click(screen.getByRole("button", { name: "Show the cards for answer 3" }));
    expect(onAnswer).toHaveBeenCalledExactlyOnceWith(2);
  });

  it("numbers the pages Show more added, and turns to the page pressed", async () => {
    const { onPage } = draw();
    expect(screen.getByRole("button", { name: "Page 1 of 2" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    await userEvent.click(screen.getByRole("button", { name: "Page 2 of 2" }));
    expect(onPage).toHaveBeenCalledExactlyOnceWith(1);
  });

  it("draws no dots and no numbers for one answer with one page", () => {
    draw({ answers: { count: 1, current: 0, onSelect: vi.fn() }, pages: undefined });
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText(/Answer \d of/)).not.toBeInTheDocument();
  });

  it("keeps the old page, hidden and inert, while the new one slides in, then drops it", async () => {
    function Harness() {
      const [index, setIndex] = useState(0);
      return (
        <>
          <button type="button" onClick={() => setIndex(1)}>
            next
          </button>
          <AiCardsPage
            pageKey={`a${index + 1}`}
            order={index}
            renderPage={renderPage}
            answers={{ count: 2, current: index, onSelect: vi.fn() }}
          />
        </>
      );
    }
    renderWithMessages(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "next" }));
    const leaving = screen.getByText("a1 first").closest("[data-ai-page]");
    expect(leaving).toHaveAttribute("data-ai-page", "leave");
    expect(leaving).toHaveAttribute("aria-hidden", "true");
    expect(leaving).toHaveAttribute("data-direction", "from-below");
    expect(screen.getByText("a2 first").closest("[data-ai-page]")).toHaveAttribute(
      "data-ai-page",
      "enter",
    );
    act(() => vi.advanceTimersByTime(300));
    expect(screen.queryByText("a1 first")).not.toBeInTheDocument();
    expect(screen.getByText("a2 first")).toBeInTheDocument();
  });
});

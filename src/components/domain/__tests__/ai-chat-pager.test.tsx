// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { createRef, type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import messages from "@/i18n/messages/en.json";
import { renderWithMessages } from "../../../../tests/render-intl";
import { AiChatPager } from "../ai-chat-pager.client";

const words = messages.ai;

/** What `renderWithMessages` wraps a component in, for a `rerender` that has to keep it. */
function inProviders(ui: ReactElement) {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <TooltipProvider>{ui}</TooltipProvider>
    </NextIntlClientProvider>
  );
}

/** What the pager's tests say the window matches: nothing, unless a test asks for reduced motion or a wide screen. */
let matching: (query: string) => boolean = () => false;

beforeEach(() => {
  matching = () => false;
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: matching(query),
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList,
  );
});

function draw(overrides: Partial<Parameters<typeof AiChatPager>[0]> = {}) {
  const onPaneChange = vi.fn();
  const chatRef = createRef<HTMLDivElement>();
  renderWithMessages(
    <AiChatPager
      chat={<p>The conversation</p>}
      cards={<p>The cards</p>}
      footer={<textarea aria-label="Message" />}
      pane={0}
      onPaneChange={onPaneChange}
      wide={false}
      cardsLabel={words.cardsPage.label}
      chatRef={chatRef}
      {...overrides}
    />,
  );
  return { onPaneChange, chatRef };
}

const chatPane = () => document.querySelector('[data-slot="ai-chat-pane"]') as HTMLElement;
const cardsPane = () => document.querySelector('[data-slot="ai-cards-aside"]') as HTMLElement;

describe("AiChatPager", () => {
  it("shows the chat and keeps the cards pane out of reach until it is the one shown", () => {
    draw();
    expect(chatPane()).not.toHaveAttribute("inert");
    expect(cardsPane()).toHaveAttribute("inert");
    expect(screen.getByText("The conversation")).toBeInTheDocument();
    expect(screen.getByText("The cards")).toBeInTheDocument();
  });

  it("swaps which pane is out of reach when the cards pane is shown", () => {
    draw({ pane: 1 });
    expect(chatPane()).toHaveAttribute("inert");
    expect(cardsPane()).not.toHaveAttribute("inert");
    expect(document.querySelector('[data-slot="ai-chat-pager"]')).toHaveAttribute(
      "data-pane",
      "cards",
    );
  });

  it("leaves both panes reachable from lg, where they are columns", () => {
    draw({ wide: true });
    expect(chatPane()).not.toHaveAttribute("inert");
    expect(cardsPane()).not.toHaveAttribute("inert");
  });

  it("names the cards pane and goes back to the chat from its button", async () => {
    const { onPaneChange } = draw({ pane: 1 });
    expect(screen.getByRole("complementary", { name: words.cardsPage.label })).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: words.pager.back }));
    expect(onPaneChange).toHaveBeenCalledWith(0);
  });

  it("keeps the footer outside both panes, so it stays on screen on either", () => {
    draw();
    const box = screen.getByRole("textbox", { name: "Message" });
    expect(chatPane()).not.toContainElement(box);
    expect(cardsPane()).not.toContainElement(box);
  });

  it("hands the chat pane's box to the island, and draws no footer when there is none", () => {
    const { chatRef } = draw({ footer: null });
    expect(chatRef.current).toBe(chatPane());
    expect(document.querySelector('[data-slot="ai-chat-footer"]')).toBeNull();
  });

  it("does not tell the island about a move it made itself (the line, the back button)", () => {
    const onSwipe = vi.fn();
    const props = {
      chat: <p>The conversation</p>,
      cards: <p>The cards</p>,
      onPaneChange: vi.fn(),
      onSwipe,
      wide: false,
      cardsLabel: words.cardsPage.label,
    } as const;
    const view = renderWithMessages(<AiChatPager {...props} pane={0} />);
    view.rerender(inProviders(<AiChatPager {...props} pane={1} />));
    expect(onSwipe).not.toHaveBeenCalled();
  });
});

describe("AiChatPager nudge (owner decision A9)", () => {
  const animate = vi.fn().mockReturnValue({ cancel: vi.fn() });
  const props = {
    chat: <p>The conversation</p>,
    cards: <p>The cards</p>,
    pane: 0,
    onPaneChange: vi.fn(),
    wide: false,
    cardsLabel: words.cardsPage.label,
  } as const;

  beforeEach(() => {
    animate.mockClear();
    Object.defineProperty(HTMLElement.prototype, "animate", { value: animate, configurable: true });
  });

  afterEach(() => {
    Reflect.deleteProperty(HTMLElement.prototype, "animate");
  });

  it("moves the row about 48 px to the left and back in 600 ms, once for each answer", () => {
    const view = renderWithMessages(<AiChatPager {...props} nudge="a1" />);
    expect(animate).toHaveBeenCalledTimes(1);
    expect(animate.mock.calls[0]?.[0]).toEqual([
      { translate: "0px" },
      { translate: "-48px", offset: 0.4 },
      { translate: "0px" },
    ]);
    expect(animate.mock.calls[0]?.[1]).toMatchObject({ duration: 600 });
    // The same answer again (a re-render, the visitor typing and stopping) does not play it twice.
    view.rerender(inProviders(<AiChatPager {...props} nudge="a1" />));
    view.rerender(inProviders(<AiChatPager {...props} nudge={null} />));
    view.rerender(inProviders(<AiChatPager {...props} nudge="a1" />));
    expect(animate).toHaveBeenCalledTimes(1);
    view.rerender(inProviders(<AiChatPager {...props} nudge="a2" />));
    expect(animate).toHaveBeenCalledTimes(2);
  });

  it("plays nothing with nothing to hint at", () => {
    renderWithMessages(<AiChatPager {...props} nudge={null} />);
    expect(animate).not.toHaveBeenCalled();
  });

  it("plays nothing under reduced motion", () => {
    matching = (query) => query.includes("prefers-reduced-motion");
    renderWithMessages(<AiChatPager {...props} nudge="a1" />);
    expect(animate).not.toHaveBeenCalled();
  });

  it("plays nothing from lg, where the cards are already beside the chat", () => {
    renderWithMessages(<AiChatPager {...props} wide nudge="a1" />);
    expect(animate).not.toHaveBeenCalled();
  });
});

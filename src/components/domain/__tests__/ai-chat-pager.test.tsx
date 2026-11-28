// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/i18n/messages/en.json";
import { renderWithMessages } from "../../../../tests/render-intl";
import { AiChatPager } from "../ai-chat-pager.client";

const words = messages.ai;

beforeEach(() => {
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
});

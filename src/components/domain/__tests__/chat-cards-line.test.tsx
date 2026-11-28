// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import { ChatCardsLine } from "../chat-cards-line.client";

describe("ChatCardsLine: where the answer's cards went (ADR-220)", () => {
  it("says how many, in the word for what they are", () => {
    for (const [count, kind, text] of [
      [6, "homes", "6 homes on the right"],
      [1, "homes", "1 home on the right"],
      [1, "projects", "1 project on the right"],
      [3, "projects", "3 projects on the right"],
      [1, "properties", "1 property on the right"],
      [4, "properties", "4 properties on the right"],
    ] as const) {
      const view = renderWithMessages(<ChatCardsLine count={count} kind={kind} onShow={vi.fn()} />);
      expect(screen.getByRole("button", { name: text })).toBeVisible();
      view.unmount();
    }
  });

  it("brings the cards forward when pressed", async () => {
    const onShow = vi.fn();
    renderWithMessages(<ChatCardsLine count={2} kind="homes" onShow={onShow} />);
    await userEvent.click(screen.getByRole("button", { name: "2 homes on the right" }));
    expect(onShow).toHaveBeenCalledTimes(1);
  });

  it("sits in a polite live region and draws nothing for no cards", () => {
    const { container } = renderWithMessages(
      <ChatCardsLine count={0} kind="homes" onShow={vi.fn()} />,
    );
    expect(container.querySelector("[aria-live=polite]")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

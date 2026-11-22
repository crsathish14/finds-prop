// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/i18n/messages/en.json";
import { renderWithMessages } from "../../../../tests/render-intl";
import { HOME_QUESTION_KEY } from "../chat/home-question";
import { HomeAiSearch } from "../home-ai-search.client";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const words = en.domain.homeSearchBar;

beforeEach(() => {
  push.mockClear();
  window.sessionStorage.clear();
});

describe("HomeAiSearch: the home page's search bar joined to the chat (ADR-150)", () => {
  it("keeps the words in this tab and opens the chat, with nothing in the address", async () => {
    const user = userEvent.setup();
    renderWithMessages(<HomeAiSearch />);
    await user.type(
      screen.getByRole("searchbox", { name: words.ai.fieldLabel }),
      "3 BHK near Velachery",
    );
    await user.click(screen.getByRole("button", { name: words.ai.button }));
    expect(push).toHaveBeenCalledWith("/ai-search");
    expect(JSON.parse(window.sessionStorage.getItem(HOME_QUESTION_KEY) ?? "null")).toEqual({
      text: "3 BHK near Velachery",
    });
  });

  it("opens the chat from an empty box too", async () => {
    const user = userEvent.setup();
    renderWithMessages(<HomeAiSearch />);
    await user.click(screen.getByRole("button", { name: words.ai.button }));
    expect(push).toHaveBeenCalledWith("/ai-search");
    expect(JSON.parse(window.sessionStorage.getItem(HOME_QUESTION_KEY) ?? "null")).toEqual({
      text: "",
    });
  });
});

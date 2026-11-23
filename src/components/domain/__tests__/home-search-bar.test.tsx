// @vitest-environment jsdom
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import en from "@/i18n/messages/en.json";
import { renderWithMessages } from "../../../../tests/render-intl";
import { HomeSearchBar } from "../home-search-bar.client";

const words = en.domain.homeSearchBar;

describe("HomeSearchBar: the home page's search box (ADR-150)", () => {
  it("is a search form with one labelled box and the Search with AI button", () => {
    renderWithMessages(<HomeSearchBar mode="ai" action="/ai-search" onSearch={() => undefined} />);
    const form = screen.getByRole("search", { name: words.label });
    expect(form).toHaveAttribute("action", "/ai-search");
    const box = screen.getByRole("searchbox", { name: words.ai.fieldLabel });
    expect(box).toHaveAttribute("placeholder", words.ai.placeholder);
    expect(screen.getByRole("button", { name: words.ai.button })).toHaveAttribute("type", "submit");
    expect(screen.getAllByRole("button")).toHaveLength(1);
    // No filters are left: no tabs, selects or chips.
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("hands over the trimmed words in AI mode, by the button or Enter, and keeps them out of the address", async () => {
    const onSearch = vi.fn();
    const user = userEvent.setup();
    renderWithMessages(
      <HomeSearchBar mode="ai" action="/ai-search" maxLength={1000} onSearch={onSearch} />,
    );
    const box = screen.getByRole("searchbox", { name: words.ai.fieldLabel });
    expect(box).not.toHaveAttribute("name");
    expect(box).toHaveAttribute("maxlength", "1000");
    await user.type(box, "  3 BHK near Velachery  ");
    await user.click(screen.getByRole("button", { name: words.ai.button }));
    expect(onSearch).toHaveBeenLastCalledWith("3 BHK near Velachery");
    await user.type(box, "{Enter}");
    expect(onSearch).toHaveBeenCalledTimes(2);
  });

  it("hands over an empty box too, so the chat can open with the cursor in it", async () => {
    const onSearch = vi.fn();
    const user = userEvent.setup();
    renderWithMessages(<HomeSearchBar mode="ai" action="/ai-search" onSearch={onSearch} />);
    await user.click(screen.getByRole("button", { name: words.ai.button }));
    expect(onSearch).toHaveBeenCalledWith("");
  });

  it("is a plain keyword search of the results while AI search is off", () => {
    renderWithMessages(<HomeSearchBar mode="keyword" action="/properties" />);
    expect(screen.getByRole("search", { name: words.label })).toHaveAttribute(
      "action",
      "/properties",
    );
    const box = screen.getByRole("searchbox", { name: words.keyword.fieldLabel });
    expect(box).toHaveAttribute("name", "q");
    expect(box).toHaveAttribute("placeholder", words.keyword.placeholder);
    expect(screen.getByRole("button", { name: words.keyword.button })).toBeVisible();
    expect(screen.queryByRole("button", { name: words.ai.button })).toBeNull();
  });

  it("offers suggestion chips (hero lab) that put their words in the box and focus it, without searching", async () => {
    const onSearch = vi.fn();
    const user = userEvent.setup();
    renderWithMessages(
      <HomeSearchBar
        mode="ai"
        action="/ai-search"
        onSearch={onSearch}
        suggestions={["2 BHK for rent in Adyar", "Villa in ECR"]}
      />,
    );
    const group = screen.getByRole("group", { name: words.suggestions });
    expect(group).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Villa in ECR" }));
    const box = screen.getByRole("searchbox", { name: words.ai.fieldLabel });
    expect(box).toHaveValue("Villa in ECR");
    expect(box).toHaveFocus();
    expect(onSearch).not.toHaveBeenCalled();
  });

  it("types the sample requests into the hint while the box is empty, and shows the usual hint while it has focus", async () => {
    vi.useFakeTimers();
    try {
      renderWithMessages(
        <HomeSearchBar mode="ai" action="/ai-search" examples={["3 BHK", "Villa"]} />,
      );
      const box = screen.getByRole("searchbox", { name: words.ai.fieldLabel });
      expect(box).toHaveAttribute("placeholder", words.ai.placeholder);
      await act(async () => {
        vi.advanceTimersByTime(900 + 45 * 4);
      });
      expect(box).toHaveAttribute("placeholder", "3 BHK");
      await act(async () => {
        box.focus();
      });
      expect(box).toHaveAttribute("placeholder", words.ai.placeholder);
    } finally {
      vi.useRealTimers();
    }
  });
});

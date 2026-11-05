// @vitest-environment jsdom
import { act, renderHook, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/i18n/messages/en.json";
import { renderWithMessages } from "../../../../tests/render-intl";
import { CompareBar } from "../compare-bar.client";
import { CompareButton, CompareCardToggle } from "../compare-controls.client";
import { COMPARE_KEY } from "../store";
import { resetCompareStore, useCompare } from "../use-compare.client";

let pathname = "/properties";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

const FIRST = "k3x9a2bd";
const SECOND = "m4y8b3ce";
const THIRD = "n5z7c4dh";
const FOURTH = "p6a2d5ej";

const entry = (id: string, title = `Home ${id}`) => ({ id, title, cover: null });
const words = en.compare;

beforeEach(() => {
  window.localStorage.clear();
  resetCompareStore();
  pathname = "/properties";
});

describe("useCompare: the selection in the browser (S4-T02)", () => {
  it("starts empty, adds, removes and clears", () => {
    const { result } = renderHook(() => useCompare());
    expect(result.current.list).toEqual([]);
    act(() => result.current.add(entry(FIRST)));
    act(() => result.current.add(entry(SECOND)));
    expect(result.current.ids).toEqual([FIRST, SECOND]);
    expect(result.current.has(FIRST)).toBe(true);
    act(() => result.current.remove(FIRST));
    expect(result.current.ids).toEqual([SECOND]);
    act(() => result.current.clear());
    expect(result.current.list).toEqual([]);
  });

  it("keeps it under the key and reads it back after a reload", () => {
    const first = renderHook(() => useCompare());
    act(() => first.result.current.add(entry(FIRST, "Arivu Heights")));
    expect(JSON.parse(window.localStorage.getItem(COMPARE_KEY) ?? "[]")).toEqual([
      { id: FIRST, title: "Arivu Heights", cover: null },
    ]);
    first.unmount();
    resetCompareStore();
    const second = renderHook(() => useCompare());
    expect(second.result.current.ids).toEqual([FIRST]);
  });

  it("stops at three and says it is full", () => {
    const { result } = renderHook(() => useCompare());
    for (const id of [FIRST, SECOND, THIRD, FOURTH]) act(() => result.current.add(entry(id)));
    expect(result.current.ids).toEqual([FIRST, SECOND, THIRD]);
    expect(result.current.full).toBe(true);
  });

  it("follows a change made in another tab", () => {
    const { result } = renderHook(() => useCompare());
    act(() => {
      window.localStorage.setItem(COMPARE_KEY, JSON.stringify([entry(THIRD)]));
      window.dispatchEvent(new StorageEvent("storage", { key: COMPARE_KEY }));
    });
    expect(result.current.ids).toEqual([THIRD]);
  });

  it("ignores what is kept that does not fit", () => {
    window.localStorage.setItem(COMPARE_KEY, "{{{ not json");
    const { result } = renderHook(() => useCompare());
    expect(result.current.list).toEqual([]);
  });

  it("works for the visit when the browser refuses to keep it", () => {
    const refuse = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    const { result } = renderHook(() => useCompare());
    act(() => result.current.add(entry(FIRST)));
    expect(result.current.ids).toEqual([FIRST]);
    act(() => result.current.add(entry(SECOND)));
    expect(result.current.ids).toEqual([FIRST, SECOND]);
    refuse.mockRestore();
  });
});

describe("CompareCardToggle and CompareButton: choosing a home (S4-T02)", () => {
  it("adds and removes the home from a card, and shows it as added", async () => {
    renderWithMessages(<CompareCardToggle shortId={FIRST} title="Arivu Heights" cover={null} />);
    const toggle = screen.getByRole("button", { name: en.domain.propertyCard.compare });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(toggle);
    expect(screen.getByRole("button", { name: en.domain.propertyCard.compared })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(window.localStorage.getItem(COMPARE_KEY)).toContain(FIRST);
    await userEvent.click(screen.getByRole("button", { name: en.domain.propertyCard.compared }));
    expect(screen.getByRole("button", { name: en.domain.propertyCard.compare })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("is switched off, with the reason, when three other homes are chosen", () => {
    window.localStorage.setItem(
      COMPARE_KEY,
      JSON.stringify([entry(FIRST), entry(SECOND), entry(THIRD)]),
    );
    renderWithMessages(<CompareCardToggle shortId={FOURTH} title="Fourth" cover={null} />);
    const toggle = screen.getByRole("button", { name: en.domain.propertyCard.compare });
    expect(toggle).toBeDisabled();
    expect(toggle).toHaveAttribute("title", en.domain.propertyCard.compareLimit);
  });

  it("keeps a chosen home's own toggle on when three are chosen, so it can be removed", () => {
    window.localStorage.setItem(
      COMPARE_KEY,
      JSON.stringify([entry(FIRST), entry(SECOND), entry(THIRD)]),
    );
    renderWithMessages(<CompareCardToggle shortId={SECOND} title="Second" cover={null} />);
    expect(screen.getByRole("button", { name: en.domain.propertyCard.compared })).toBeEnabled();
  });

  it("shares one selection between a card and the property page's button", async () => {
    renderWithMessages(
      <>
        <CompareCardToggle shortId={FIRST} title="Arivu Heights" cover={null} />
        <CompareButton shortId={FIRST} title="Arivu Heights" cover={null} />
      </>,
    );
    await userEvent.click(screen.getByRole("button", { name: words.add }));
    expect(screen.getAllByRole("button", { name: en.domain.propertyCard.compared })).toHaveLength(
      2,
    );
  });
});

describe("CompareBar: appears after the first home is chosen (S4-T02)", () => {
  function choose(...ids: string[]) {
    window.localStorage.setItem(COMPARE_KEY, JSON.stringify(ids.map((id) => entry(id))));
  }

  it("draws nothing while nothing is chosen", () => {
    const view = renderWithMessages(<CompareBar />);
    expect(view.container).toBeEmptyDOMElement();
  });

  it("says how many are chosen and asks for another while Compare now is off", () => {
    choose(FIRST);
    renderWithMessages(<CompareBar />);
    const bar = screen.getByRole("region", { name: words.bar.label });
    expect(within(bar).getByText("1 of 3 selected")).toBeVisible();
    expect(within(bar).getByText(words.bar.chooseMore)).toBeInTheDocument();
    expect(within(bar).getByRole("button", { name: words.bar.compareNow })).toBeDisabled();
    expect(within(bar).queryByRole("link", { name: words.bar.compareNow })).not.toBeInTheDocument();
  });

  it("leads to the comparison, with the ids in order, from two homes", () => {
    choose(FIRST, SECOND);
    renderWithMessages(<CompareBar />);
    const link = screen.getByRole("link", { name: words.bar.compareNow });
    expect(link).toHaveAttribute("href", `/compare?ids=${FIRST},${SECOND}`);
    expect(screen.getByText(en.domain.propertyCard.compareLimit)).toBeInTheDocument();
  });

  it("removes one home from its slot and clears all", async () => {
    choose(FIRST, SECOND, THIRD);
    renderWithMessages(<CompareBar />);
    await userEvent.click(
      screen.getByRole("button", { name: words.bar.remove.replace("{title}", `Home ${SECOND}`) }),
    );
    expect(screen.getByText("2 of 3 selected")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: words.bar.clearAll }));
    expect(screen.queryByRole("region", { name: words.bar.label })).not.toBeInTheDocument();
    expect(window.localStorage.getItem(COMPARE_KEY)).toBe("[]");
  });

  it("is drawn on the homepage and the results, and beside a home's page, but not on the comparison", () => {
    choose(FIRST);
    for (const [path, shown] of [
      ["/", true],
      ["/properties", true],
      ["/properties/3-bhk-velachery-k3x9a2bd", true],
      ["/compare", false],
      ["/projects", false],
    ] as const) {
      pathname = path;
      resetCompareStore();
      const view = renderWithMessages(<CompareBar />);
      expect(screen.queryByRole("region", { name: words.bar.label }) !== null, path).toBe(shown);
      view.unmount();
    }
  });

  it("is hidden below 1024 px on a home's page, where the sticky price bar is", () => {
    choose(FIRST);
    pathname = "/properties/3-bhk-velachery-k3x9a2bd";
    renderWithMessages(<CompareBar />);
    expect(screen.getByRole("region", { name: words.bar.label })).toHaveClass("max-lg:hidden");
  });
});

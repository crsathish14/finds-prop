// @vitest-environment jsdom
import { act, renderHook, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import { CompareChatBar } from "../compare-chat-bar.client";
import { resetCompareStore, useCompare } from "../use-compare.client";

vi.mock("next/navigation", () => ({ usePathname: () => "/ai-search" }));

const entry = (id: string) => ({ id, title: `Home ${id}`, cover: null });

beforeEach(() => {
  window.localStorage.clear();
  resetCompareStore();
});

describe("UT-compare-chat-bar: the compare bar inside the AI chat", () => {
  it("shows no bar and reports no ids while fewer than two homes are ticked", () => {
    const onIds = vi.fn();
    const store = renderHook(() => useCompare());
    renderWithMessages(<CompareChatBar onIds={onIds} />);
    expect(screen.queryByRole("region")).toBeNull();
    act(() => store.result.current.add(entry("k3x9a2bd")));
    expect(screen.queryByRole("region")).toBeNull();
    expect(onIds).toHaveBeenLastCalledWith([]);
  });

  it("shows the bar with a link to the comparison, and reports ids only, from two homes", () => {
    const onIds = vi.fn();
    const store = renderHook(() => useCompare());
    renderWithMessages(<CompareChatBar onIds={onIds} />);
    act(() => store.result.current.add(entry("k3x9a2bd")));
    act(() => store.result.current.add(entry("m4y8b3ce")));
    expect(onIds).toHaveBeenLastCalledWith(["k3x9a2bd", "m4y8b3ce"]);
    expect(screen.getByRole("link", { name: /compare now/i })).toHaveAttribute(
      "href",
      "/compare?ids=k3x9a2bd,m4y8b3ce",
    );
  });

  it("reports at most three, and none again after Clear all", () => {
    const onIds = vi.fn();
    const store = renderHook(() => useCompare());
    renderWithMessages(<CompareChatBar onIds={onIds} />);
    for (const id of ["k3x9a2bd", "m4y8b3ce", "n5z7c4dh", "p6a2d5ej"]) {
      act(() => store.result.current.add(entry(id)));
    }
    expect(onIds).toHaveBeenLastCalledWith(["k3x9a2bd", "m4y8b3ce", "n5z7c4dh"]);
    act(() => store.result.current.clear());
    expect(onIds).toHaveBeenLastCalledWith([]);
    expect(screen.queryByRole("region")).toBeNull();
  });
});

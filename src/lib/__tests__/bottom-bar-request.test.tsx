// @vitest-environment jsdom
import { act, render, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useBottomBarRequested, useRequestBottomBar } from "../bottom-bar-request";

function Page() {
  useRequestBottomBar();
  return null;
}

describe("UT-bottom-bar-request: an error page asks for the phone bottom bar", () => {
  it("is not requested while no error page is on screen", () => {
    const { result } = renderHook(() => useBottomBarRequested());
    expect(result.current).toBe(false);
  });

  it("is requested while an error page is mounted, and stops when it goes away", () => {
    const { result } = renderHook(() => useBottomBarRequested());
    const page = render(<Page />);
    expect(result.current).toBe(true);
    page.unmount();
    expect(result.current).toBe(false);
  });

  it("stays requested until every page that asked has gone away", () => {
    const { result } = renderHook(() => useBottomBarRequested());
    const first = render(<Page />);
    const second = render(<Page />);
    first.unmount();
    expect(result.current).toBe(true);
    act(() => second.unmount());
    expect(result.current).toBe(false);
  });
});

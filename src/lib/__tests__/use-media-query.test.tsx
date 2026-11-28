// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMediaQuery } from "../use-media-query";

function Probe() {
  return <output>{useMediaQuery("(min-width: 1024px)") ? "wide" : "narrow"}</output>;
}

afterEach(() => vi.restoreAllMocks());

describe("useMediaQuery", () => {
  it("follows the window as it changes size", () => {
    let matches = false;
    let notify: () => void = () => undefined;
    vi.spyOn(window, "matchMedia").mockImplementation(
      () =>
        ({
          get matches() {
            return matches;
          },
          addEventListener: (_name: string, listener: () => void) => {
            notify = listener;
          },
          removeEventListener: () => undefined,
        }) as unknown as MediaQueryList,
    );
    render(<Probe />);
    expect(screen.getByRole("status")).toHaveTextContent("narrow");
    matches = true;
    act(() => notify());
    expect(screen.getByRole("status")).toHaveTextContent("wide");
  });
});

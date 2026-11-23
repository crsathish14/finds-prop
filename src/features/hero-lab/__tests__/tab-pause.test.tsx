// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PauseWhenHidden } from "../tab-pause.client";

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, value: state });
  document.dispatchEvent(new Event("visibilitychange"));
}

afterEach(() => setVisibility("visible"));

describe("UT-pause-when-hidden: the hero's loops stop in a background tab (ADR-176)", () => {
  it("adds no box of its own and is not paused while the tab is shown", () => {
    render(
      <PauseWhenHidden>
        <p>hero</p>
      </PauseWhenHidden>,
    );
    const wrapper = screen.getByText("hero").parentElement;
    expect(wrapper).toHaveClass("contents");
    expect(wrapper).not.toHaveAttribute("data-hl-paused");
  });

  it("is marked paused while the tab is hidden and runs again when it is shown", () => {
    render(
      <PauseWhenHidden>
        <p>hero</p>
      </PauseWhenHidden>,
    );
    const wrapper = screen.getByText("hero").parentElement;
    act(() => setVisibility("hidden"));
    expect(wrapper).toHaveAttribute("data-hl-paused");
    act(() => setVisibility("visible"));
    expect(wrapper).not.toHaveAttribute("data-hl-paused");
  });
});

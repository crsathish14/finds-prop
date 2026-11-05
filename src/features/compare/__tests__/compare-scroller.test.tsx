// @vitest-environment jsdom
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CompareScroller } from "../compare-scroller.client";

/** jsdom has no layout, so the box's sizes are set by hand and the scroll event asks for a new measure. */
function size(
  box: HTMLElement,
  sizes: { scrollWidth: number; clientWidth: number; scrollLeft: number },
) {
  for (const [name, value] of Object.entries(sizes)) {
    Object.defineProperty(box, name, { configurable: true, value });
  }
  fireEvent.scroll(box);
}

function setup() {
  const view = render(
    <CompareScroller>
      <table>
        <tbody>
          <tr>
            <td>cell</td>
          </tr>
        </tbody>
      </table>
    </CompareScroller>,
  );
  const box = view.container.querySelector<HTMLElement>(".overflow-x-auto") as HTMLElement;
  const hint = () => view.container.querySelector("[data-slot=compare-scroll-hint]");
  return { box, hint };
}

describe("CompareScroller: the fade that says there is more (S4-T02)", () => {
  it("shows no fade when everything fits", () => {
    const { box, hint } = setup();
    size(box, { scrollWidth: 700, clientWidth: 700, scrollLeft: 0 });
    expect(hint()).toBeNull();
  });

  it("shows the fade while there is more to the right, and takes it away at the end", () => {
    const { box, hint } = setup();
    size(box, { scrollWidth: 672, clientWidth: 322, scrollLeft: 0 });
    expect(hint()).not.toBeNull();
    size(box, { scrollWidth: 672, clientWidth: 322, scrollLeft: 200 });
    expect(hint()).not.toBeNull();
    size(box, { scrollWidth: 672, clientWidth: 322, scrollLeft: 350 });
    expect(hint()).toBeNull();
  });

  it("counts a fraction of a pixel short of the end as the end", () => {
    const { box, hint } = setup();
    size(box, { scrollWidth: 672, clientWidth: 322, scrollLeft: 349.4 });
    expect(hint()).toBeNull();
  });

  it("brings the fade back when the box becomes too narrow for the table", () => {
    const { box, hint } = setup();
    size(box, { scrollWidth: 672, clientWidth: 700, scrollLeft: 0 });
    expect(hint()).toBeNull();
    size(box, { scrollWidth: 672, clientWidth: 322, scrollLeft: 0 });
    expect(hint()).not.toBeNull();
  });

  it("is decoration: hidden from screen readers and takes no clicks", () => {
    const { box, hint } = setup();
    size(box, { scrollWidth: 672, clientWidth: 322, scrollLeft: 0 });
    expect(hint()).toHaveAttribute("aria-hidden", "true");
    expect(hint()).toHaveClass("pointer-events-none");
  });

  it("keeps the table inside a box that scrolls sideways", () => {
    const { box } = setup();
    expect(box).toHaveClass("overflow-x-auto");
    expect(box.querySelector("table")).not.toBeNull();
  });
});

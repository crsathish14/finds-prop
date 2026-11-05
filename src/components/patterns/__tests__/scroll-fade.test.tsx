// @vitest-environment jsdom
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScrollFade } from "../scroll-fade.client";

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
    <ScrollFade>
      <table>
        <tbody>
          <tr>
            <td>cell</td>
          </tr>
        </tbody>
      </table>
    </ScrollFade>,
  );
  const box = view.container.querySelector<HTMLElement>(".overflow-x-auto") as HTMLElement;
  const hint = () => view.container.querySelector("[data-slot=scroll-fade-hint]");
  return { box, hint };
}

describe("ScrollFade: the fade that says there is more (S4-T02)", () => {
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

  it("is a named group that takes keyboard focus when it is given the heading that names it", () => {
    const view = render(
      <>
        <h2 id="units-title">Units</h2>
        <ScrollFade labelledBy="units-title">
          <table>
            <tbody>
              <tr>
                <td>cell</td>
              </tr>
            </tbody>
          </table>
        </ScrollFade>
      </>,
    );
    const box = view.container.querySelector<HTMLElement>(".overflow-x-auto") as HTMLElement;
    expect(box).toHaveAttribute("role", "group");
    expect(box).toHaveAttribute("aria-labelledby", "units-title");
    expect(box).toHaveAttribute("tabindex", "0");
  });

  it("is a plain overflow area, not a tab stop, when it is not given one", () => {
    const { box } = setup();
    expect(box).not.toHaveAttribute("tabindex");
    expect(box).not.toHaveAttribute("role");
  });

  it("keeps the table inside a box that scrolls sideways", () => {
    const { box } = setup();
    expect(box).toHaveClass("overflow-x-auto");
    expect(box.querySelector("table")).not.toBeNull();
  });
});

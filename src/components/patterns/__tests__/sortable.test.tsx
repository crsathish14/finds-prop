// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { SortableList, SortableRow } from "../sortable-list";

const NAMES: Record<string, string> = { front: "Front", kitchen: "Kitchen", bedroom: "Bedroom" };

function Example({ initial = ["front", "kitchen", "bedroom"] }: { initial?: string[] }) {
  const [ids, setIds] = useState(initial);
  return (
    <SortableList ids={ids} onReorder={setIds}>
      {ids.map((id) => (
        <SortableRow
          key={id}
          id={id}
          labels={{
            drag: `Drag ${NAMES[id]}`,
            moveUp: `Move ${NAMES[id]} up`,
            moveDown: `Move ${NAMES[id]} down`,
          }}
        >
          {NAMES[id]}
        </SortableRow>
      ))}
    </SortableList>
  );
}

const order = () => screen.getAllByRole("listitem").map((item) => item.textContent);

describe("SortableList and SortableRow", () => {
  it("lists the rows in order, each with a named grip and move buttons", () => {
    render(<Example />);
    expect(order()).toEqual(["Front", "Kitchen", "Bedroom"]);
    expect(screen.getByRole("button", { name: "Drag Kitchen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Move Kitchen up" })).toBeEnabled();
  });

  it("moves a row up and down with the buttons, without dragging", async () => {
    render(<Example />);
    await userEvent.click(screen.getByRole("button", { name: "Move Bedroom up" }));
    expect(order()).toEqual(["Front", "Bedroom", "Kitchen"]);
    await userEvent.click(screen.getByRole("button", { name: "Move Front down" }));
    expect(order()).toEqual(["Bedroom", "Front", "Kitchen"]);
  });

  it("disables Move up on the first row and Move down on the last", () => {
    render(<Example />);
    expect(screen.getByRole("button", { name: "Move Front up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move Bedroom down" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move Kitchen up" })).toBeEnabled();
  });

  it("keeps keyboard focus on the button after it moves its row", async () => {
    render(<Example />);
    const button = screen.getByRole("button", { name: "Move Bedroom up" });
    button.focus();
    await userEvent.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: "Move Bedroom up" })).toHaveFocus();
  });

  it("makes the grip a keyboard-draggable button that dnd-kit describes", () => {
    render(<Example />);
    const grip = screen.getByRole("button", { name: "Drag Front" });
    expect(grip).toHaveAttribute("aria-roledescription", "sortable");
    expect(grip).toHaveAttribute("tabindex", "0");
  });
});

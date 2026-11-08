// @vitest-environment jsdom
import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import { ManagerDrawer } from "../manager-drawer";

function open(extra: { pending?: boolean; sends?: boolean; onSubmit?: () => void } = {}) {
  const onOpenChange = vi.fn();
  const onSubmit = extra.onSubmit ?? vi.fn();
  renderWithMessages(
    <ManagerDrawer
      open
      onOpenChange={onOpenChange}
      title="Add unit"
      description="Add a unit so buyers can see what is available."
      closeLabel="Close"
      cancelLabel="Cancel"
      {...(extra.sends === false ? {} : { submitLabel: "Save unit", formId: "unit-form" })}
      {...(extra.pending ? { pending: true } : {})}
    >
      <form
        id="unit-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <label>
          Unit number
          <input name="unit" defaultValue="B-303" />
        </label>
      </form>
    </ManagerDrawer>,
  );
  return { onOpenChange, onSubmit };
}

describe("ManagerDrawer: add or edit a row (S7-T01)", () => {
  it("is a dialog named by its title, with its line, its form and both footer buttons", () => {
    open();
    const drawer = screen.getByRole("dialog", { name: "Add unit" });
    expect(
      within(drawer).getByText("Add a unit so buyers can see what is available."),
    ).toBeVisible();
    expect(within(drawer).getByLabelText("Unit number")).toHaveValue("B-303");
    expect(within(drawer).getByRole("button", { name: "Cancel" })).toBeVisible();
    expect(within(drawer).getByRole("button", { name: "Save unit" })).toBeVisible();
  });

  it("sends the form from the footer button, which sits outside it", () => {
    const { onSubmit } = open();
    fireEvent.click(screen.getByRole("button", { name: "Save unit" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("asks to close from Cancel and from the close button", () => {
    const { onOpenChange } = open();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onOpenChange).toHaveBeenCalledTimes(2);
  });

  it("keeps the main button's label and does nothing a second time while sending", () => {
    const { onSubmit } = open({ pending: true });
    const save = screen.getByRole("button", { name: "Save unit" });
    expect(save).toHaveAttribute("aria-busy", "true");
    fireEvent.click(save);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows one button, Cancel's word, when there is nothing to send", () => {
    open({ sends: false });
    expect(screen.queryByRole("button", { name: "Save unit" })).toBeNull();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeVisible();
  });
});

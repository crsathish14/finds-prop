// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { notify } from "@/lib/notify";
import { Toaster } from "../toaster";

afterEach(() => {
  act(() => notify.dismiss());
});

describe("Toaster and notify", () => {
  it("shows a success message in a labelled live region", async () => {
    render(<Toaster closeLabel="Close" containerLabel="Notifications" />);
    act(() => {
      notify.success("Saved to your list");
    });
    expect(await screen.findByText("Saved to your list")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Notifications alt+T" })).toBeInTheDocument();
  });

  it("shows an error and an info message", async () => {
    render(<Toaster closeLabel="Close" containerLabel="Notifications" />);
    act(() => {
      notify.error("Could not save", { description: "Check your connection." });
      notify.info("Photos are processing");
    });
    expect(await screen.findByText("Could not save")).toBeInTheDocument();
    expect(screen.getByText("Check your connection.")).toBeInTheDocument();
    expect(screen.getByText("Photos are processing")).toBeInTheDocument();
  });

  it("offers an Undo button that runs the undo", async () => {
    const onUndo = vi.fn();
    render(<Toaster closeLabel="Close" containerLabel="Notifications" />);
    act(() => {
      notify.undo("Removed from saved", { actionLabel: "Undo", onUndo });
    });
    await userEvent.click(await screen.findByRole("button", { name: "Undo" }));
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it("has a close button with the translated name", async () => {
    render(<Toaster closeLabel="Dismiss message" containerLabel="Notifications" />);
    act(() => {
      notify.success("Saved");
    });
    expect(await screen.findByRole("button", { name: "Dismiss message" })).toBeInTheDocument();
  });
});

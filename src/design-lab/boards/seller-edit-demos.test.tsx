// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ListingEditDemo } from "./seller-edit-demos";

describe("Design Lab: Edit a listing (S6-T05)", () => {
  it("shows the three states with the words of an edit", () => {
    render(<ListingEditDemo />);
    expect(screen.getByText("You're editing a live listing")).toBeVisible();
    // Twice: the not approved listing, and the same one while it is being resubmitted.
    expect(screen.getAllByText("This listing was not approved")).toHaveLength(2);
    expect(screen.getAllByText(/Reason: Add a photo of the home itself/)).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Save changes" })).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Resubmit for review" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Resubmitting" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });

  it("asks before sending a Live listing back to review, and Keep editing closes the question", () => {
    render(<ListingEditDemo />);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: "Save changes" })[0] as HTMLElement);
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText("Send this listing back to review?")).toBeVisible();
    expect(
      within(dialog).getByText(
        "Saving these changes sends your listing back to review. It stays hidden until it is approved again.",
      ),
    ).toBeVisible();
    fireEvent.click(within(dialog).getByRole("button", { name: "Keep editing" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});

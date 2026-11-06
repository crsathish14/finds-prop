// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import messages from "@/i18n/messages/en.json";
import { renderWithMessages } from "../../../../tests/render-intl";
import { SessionEndedAlert } from "../session-ended-alert";

const words = messages.domain.sessionEnded;

describe("SessionEndedAlert: the session ended before the form was sent (S5-T07)", () => {
  it("says the session has ended and that what was typed is kept", () => {
    renderWithMessages(<SessionEndedAlert href="/auth?gate=expired" />);
    expect(screen.getByText(words.title)).toBeVisible();
    expect(screen.getByText(words.body)).toBeVisible();
  });

  it("offers Sign in again as a real link to the address it was given", () => {
    renderWithMessages(<SessionEndedAlert href="/auth?gate=expired&redirect=%2Fp" />);
    expect(screen.getByRole("link", { name: words.action })).toHaveAttribute(
      "href",
      "/auth?gate=expired&redirect=%2Fp",
    );
  });

  it("calls onSignIn when the link is pressed, so the form can keep what was typed", async () => {
    const onSignIn = vi.fn();
    renderWithMessages(<SessionEndedAlert href="#" onSignIn={onSignIn} />);
    await userEvent.click(screen.getByRole("link", { name: words.action }));
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });
});

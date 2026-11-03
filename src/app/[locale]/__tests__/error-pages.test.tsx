// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import en from "@/i18n/messages/en.json";
import { useBottomBarRequested } from "@/lib/bottom-bar-request";
import { renderWithMessages } from "../../../../tests/render-intl";
import GlobalError from "../../global-error";
import ErrorPage from "../error";

// next/font only works inside the Next.js build; the class names do not matter to these tests.
vi.mock("@/styles/fonts", () => ({ fontVariables: "" }));

describe("error page (inside the site layout)", () => {
  it("shows the approved message with Try again and Go home", async () => {
    const reset = vi.fn();
    renderWithMessages(<ErrorPage error={new Error("boom")} reset={reset} />);
    expect(screen.getByRole("heading", { level: 1, name: en.errorPage.title })).toBeInTheDocument();
    expect(screen.getByText(en.errorPage.code)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: en.common.goHome })).toHaveAttribute("href", "/");
    await userEvent.click(screen.getByRole("button", { name: en.common.tryAgain }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("never shows the error message, only the reference for support", () => {
    const error = Object.assign(new Error("secret database detail"), { digest: "abc123" });
    renderWithMessages(<ErrorPage error={error} reset={vi.fn()} />);
    expect(screen.queryByText(/secret database detail/)).not.toBeInTheDocument();
    expect(screen.getByText("Reference: abc123")).toBeInTheDocument();
    expect(screen.getByText(en.common.technicalDetails)).toBeInTheDocument();
  });

  it("asks for the phone bottom bar while it is on screen, as the approved screen shows it", () => {
    const seen: boolean[] = [];
    function Watcher() {
      seen.push(useBottomBarRequested());
      return null;
    }
    const page = renderWithMessages(
      <>
        <Watcher />
        <ErrorPage error={new Error("boom")} reset={vi.fn()} />
      </>,
    );
    expect(seen.at(-1)).toBe(true);
    page.unmount();
  });

  it("has no technical details when there is no reference", () => {
    renderWithMessages(<ErrorPage error={new Error("boom")} reset={vi.fn()} />);
    expect(screen.queryByText(en.common.technicalDetails)).not.toBeInTheDocument();
  });
});

describe("global error page (replaces the whole layout)", () => {
  it("renders without the language provider, from en.json", async () => {
    const reset = vi.fn();
    // It renders its own <html>; jsdom warns about nesting it in a <div>, which does not matter here.
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<GlobalError error={Object.assign(new Error("x"), { digest: "d9" })} reset={reset} />);
    expect(screen.getByRole("heading", { level: 1, name: en.errorPage.title })).toBeInTheDocument();
    expect(screen.getByText("Reference: d9")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: en.common.tryAgain }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});

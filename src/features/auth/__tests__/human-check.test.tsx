// @vitest-environment jsdom
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/i18n/messages/en.json";
import { renderWithMessages } from "../../../../tests/render-intl";
import { HumanCheck } from "../human-check.client";

type RenderOptions = {
  sitekey: string;
  appearance: string;
  size: string;
  callback: (token: string) => void;
  "error-callback": () => void;
  "expired-callback": () => void;
  "timeout-callback": () => void;
};

const words = en.auth.phone.check;

let rendered: RenderOptions[];
let removed: string[];

beforeEach(() => {
  rendered = [];
  removed = [];
  // The page's script is replaced by a fake, so the test never reaches Cloudflare (R-TEST-04).
  Object.defineProperty(window, "turnstile", {
    configurable: true,
    value: {
      render: (_container: HTMLElement, options: RenderOptions) => {
        rendered.push(options);
        return `widget-${rendered.length}`;
      },
      remove: (id: string) => removed.push(id),
    },
  });
});

afterEach(() => {
  Reflect.deleteProperty(window, "turnstile");
});

describe("HumanCheck", () => {
  it("shows the check running, and asks for a widget that appears only when it must", async () => {
    renderWithMessages(<HumanCheck siteKey="site-key" onChange={vi.fn()} onRetry={vi.fn()} />);
    expect(await screen.findByText(words.checking)).toBeInTheDocument();
    await vi.waitFor(() => expect(rendered).toHaveLength(1));
    expect(rendered[0]).toMatchObject({
      sitekey: "site-key",
      appearance: "interaction-only",
      size: "flexible",
    });
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
  });

  it("says Verified and hands over the token when the check passes", async () => {
    const onChange = vi.fn();
    renderWithMessages(<HumanCheck siteKey="site-key" onChange={onChange} onRetry={vi.fn()} />);
    await vi.waitFor(() => expect(rendered).toHaveLength(1));
    act(() => rendered[0]?.callback("the-token"));
    expect(screen.getByText(words.verified)).toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith("verified", "the-token");
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "false");
  });

  it.each(["error-callback", "expired-callback", "timeout-callback"] as const)(
    "fails, with no token and a Try again button, on %s",
    async (callback) => {
      const onChange = vi.fn();
      const onRetry = vi.fn();
      renderWithMessages(<HumanCheck siteKey="site-key" onChange={onChange} onRetry={onRetry} />);
      await vi.waitFor(() => expect(rendered).toHaveLength(1));
      act(() => rendered[0]?.[callback]());
      expect(screen.getByText(words.failed)).toBeInTheDocument();
      expect(onChange).toHaveBeenLastCalledWith("failed", null);
      await userEvent.click(screen.getByRole("button", { name: en.auth.phone.tryAgain }));
      expect(onRetry).toHaveBeenCalledOnce();
    },
  );

  it("cannot pass without a site key, and never starts a widget", () => {
    renderWithMessages(<HumanCheck siteKey={undefined} onChange={vi.fn()} onRetry={vi.fn()} />);
    expect(screen.getByText(words.failed)).toBeInTheDocument();
    expect(rendered).toHaveLength(0);
  });

  it("removes its widget when it goes away", async () => {
    const { unmount } = renderWithMessages(
      <HumanCheck siteKey="site-key" onChange={vi.fn()} onRetry={vi.fn()} />,
    );
    await vi.waitFor(() => expect(rendered).toHaveLength(1));
    unmount();
    expect(removed).toEqual(["widget-1"]);
  });
});

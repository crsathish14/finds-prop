// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { MouseEvent } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AiCta } from "../ai-cta.client";
import { AiSparkle } from "../ai-sparkle";
import { Button } from "../button";
import { Link } from "../link";

const stayOnPage = (event: MouseEvent) => event.preventDefault();

afterEach(() => {
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("AiCta", () => {
  it("merges onto its link without a box of its own, and keeps the link's name", () => {
    const { container } = render(
      <AiCta name="nav" variant="pill">
        <Link href="/ai-search" className="pill">
          <AiSparkle />
          AI Search
        </Link>
      </AiCta>,
    );
    const link = screen.getByRole("link", { name: "AI Search" });
    expect(container.firstElementChild).toBe(link);
    expect(link).toHaveAttribute("data-ai-cta", "pill");
    expect(link).toHaveClass("pill", "ai-cta");
    expect(link).not.toHaveAttribute("data-ai-cta-state");
    // The shimmer layer and the sparkle are decoration
    expect(link.querySelector(".ai-cta__sweep")).toHaveAttribute("aria-hidden", "true");
    expect(link.querySelector(".ai-sparkle")).toHaveAttribute("aria-hidden", "true");
  });

  it("draws no shimmer layer for the text variant", () => {
    render(
      <AiCta name="hero" variant="text">
        <Link href="/ai-search">Describe it in words</Link>
      </AiCta>,
    );
    expect(screen.getByRole("link").querySelector(".ai-cta__sweep")).toBeNull();
  });

  it("calms down once clicked, for every CTA with that name, and keeps the child's own click", async () => {
    const onClick = vi.fn(stayOnPage);
    render(
      <>
        <AiCta name="nav" variant="pill">
          <Link href="/ai-search" onClick={onClick}>
            AI Search
          </Link>
        </AiCta>
        <AiCta name="nav" variant="disc">
          <Link href="/ai-search" onClick={stayOnPage}>
            AI
          </Link>
        </AiCta>
        <AiCta name="hero" variant="text">
          <Link href="/ai-search">Describe it in words</Link>
        </AiCta>
      </>,
    );
    await userEvent.click(screen.getByRole("link", { name: "AI Search" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem("findsprop.aiCta.clicked.nav")).toBe("1");
    expect(screen.getByRole("link", { name: "AI Search" })).toHaveAttribute(
      "data-ai-cta-state",
      "calm",
    );
    expect(screen.getByRole("link", { name: "AI" })).toHaveAttribute("data-ai-cta-state", "calm");
    expect(screen.getByRole("link", { name: "Describe it in words" })).not.toHaveAttribute(
      "data-ai-cta-state",
    );
  });

  it("starts calm when it was already clicked in this session", () => {
    window.sessionStorage.setItem("findsprop.aiCta.clicked.ask", "1");
    render(
      <AiCta name="ask" variant="outline">
        <Link href="/ai-search">Ask about this home</Link>
      </AiCta>,
    );
    expect(screen.getByRole("link")).toHaveAttribute("data-ai-cta-state", "calm");
  });

  it("waits for the entrance until it is on screen, inside a Button drawn as a link", () => {
    // tests/setup.ts provides a stub that keeps its callback
    const observe = vi.spyOn(IntersectionObserver.prototype, "observe");
    const disconnect = vi.spyOn(IntersectionObserver.prototype, "disconnect");
    render(
      <Button asChild variant="secondary" size="sm">
        <AiCta name="ask" variant="outline" entrance>
          <Link href="/ai-search">Ask about this home</Link>
        </AiCta>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Ask about this home" });
    expect(link).toHaveAttribute("data-slot", "button");
    expect(link).toHaveAttribute("data-ai-cta-entrance", "wait");
    expect(observe).toHaveBeenCalledWith(link);
    // next/link watches the same element for prefetching, so report it to every observer
    const observers = observe.mock.contexts as (IntersectionObserver & {
      callback: IntersectionObserverCallback;
    })[];
    act(() => {
      for (const observer of observers)
        observer.callback([{ isIntersecting: true } as IntersectionObserverEntry], observer);
    });
    expect(link).toHaveAttribute("data-ai-cta-entrance", "play");
    expect(disconnect).toHaveBeenCalled();
  });
});

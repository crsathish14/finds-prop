// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/i18n/messages/en.json";

const state = vi.hoisted(() => ({ aiSearch: false }));

vi.mock("server-only", () => ({}));
vi.mock("@/features/site", () => ({
  getFeatureFlags: () => ({ aiSearch: state.aiSearch, mapView: false, pgListings: false }),
  getTranslate: async () => (key: string) => {
    const found = key
      .split(".")
      .reduce<unknown>(
        (node, part) => (node as Record<string, unknown> | undefined)?.[part],
        messages,
      );
    return typeof found === "string" ? found : key;
  },
}));

import { AskAboutButton } from "../ask-about-button";

// UT-ai-ask-about (AI-P7-T01): the buttons are absent while the flag is off, and are links that carry ids only.

async function show(subject: Parameters<typeof AskAboutButton>[0]["subject"]) {
  return render(await AskAboutButton({ subject }));
}

describe("AskAboutButton", () => {
  beforeEach(() => {
    state.aiSearch = false;
  });

  it("draws nothing for any subject while FLAG_AI_SEARCH is off", async () => {
    for (const subject of [
      { kind: "home", shortId: "k3m9p2xw" },
      { kind: "project", slug: "green-park" },
      { kind: "compare", shortIds: ["k3m9p2xw", "b4c5d6e7"] },
    ] as const) {
      const { container } = await show(subject);
      expect(container).toBeEmptyDOMElement();
    }
  });

  it("is a link to the chat with the home's id", async () => {
    state.aiSearch = true;
    await show({ kind: "home", shortId: "k3m9p2xw" });
    expect(screen.getByRole("link", { name: "Ask about this home" })).toHaveAttribute(
      "href",
      "/ai-search?home=k3m9p2xw",
    );
  });

  it("is a link to the chat with the project's slug", async () => {
    state.aiSearch = true;
    await show({ kind: "project", slug: "green-park" });
    expect(screen.getByRole("link", { name: "Ask about this project" })).toHaveAttribute(
      "href",
      "/ai-search?project=green-park",
    );
  });

  it("is a link to the chat with the compared ids", async () => {
    state.aiSearch = true;
    await show({ kind: "compare", shortIds: ["k3m9p2xw", "b4c5d6e7"] });
    expect(screen.getByRole("link", { name: "Ask about these homes" })).toHaveAttribute(
      "href",
      "/ai-search?compare=k3m9p2xw,b4c5d6e7",
    );
  });
});

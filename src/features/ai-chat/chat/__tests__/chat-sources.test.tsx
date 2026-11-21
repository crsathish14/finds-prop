// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AI_MAX_SOURCES_PER_ANSWER } from "@/config/ai";
import messages from "@/i18n/messages/en.json";
import { renderWithMessages } from "../../../../../tests/render-intl";
import { encodeChatEvent, type ChatStreamEvent } from "../../endpoint/events";
import { loadChat, STORAGE_KEY, type StoredChat } from "../chat-model";
import { readChatEvents } from "../chat-stream";

// UT-ai-chat-sources (ADR-143 section 6.5): the "Sources" row under a content answer. The server builds each link; the
// chat draws it as a link with the page's title, and only for an address of the shapes `source-links.ts` builds.

vi.mock("../../actions", () => ({
  readChatCardsAction: vi.fn().mockResolvedValue({ ok: true, data: [] }),
  confirmChatProposal: vi.fn(),
}));

const { ChatIsland } = await import("../chat.client");

const controls = {
  Save: () => null,
  Compare: () => null,
};
const words = messages.ai;
const FAQ_ID = "f1000000-0000-4000-8000-000000000002";

function stream(events: ChatStreamEvent[]): Response {
  const lines = events.map((event) => encodeChatEvent(event));
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const bytes of lines) controller.enqueue(bytes);
        controller.close();
      },
    }),
    { headers: { "content-type": "application/x-ndjson" } },
  );
}

const answered = (...more: ChatStreamEvent[]): Response =>
  stream([
    { type: "start", requestId: "r" },
    { type: "text", text: "Registration is paid at the sub-registrar office." },
    ...more,
    { type: "done", outcome: "answered" },
  ]);

const source = (kind: "article" | "faq", title: string, href: string): ChatStreamEvent => ({
  type: "source",
  kind,
  title,
  href,
});

const fetchMock = vi.fn<typeof fetch>();

async function ask() {
  renderWithMessages(<ChatIsland signedIn={false} controls={controls} />);
  await screen.findByText(words.examples.label);
  const user = userEvent.setup();
  await user.type(
    screen.getByRole("textbox", { name: words.composer.label }),
    "how are registration charges paid",
  );
  await user.click(screen.getByRole("button", { name: words.composer.send }));
  await screen.findByText("Registration is paid at the sub-registrar office.");
}

beforeEach(() => {
  window.sessionStorage.clear();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("UT-ai-chat-sources: the stream and the kept transcript", () => {
  it("reads a source event, and ignores one that does not fit", async () => {
    const body = stream([
      source("article", "Guide", "/blog/guide"),
      { type: "done", outcome: "answered" },
    ]).body;
    if (body === null) throw new Error("no body");
    const events = [];
    for await (const event of readChatEvents(body)) events.push(event);
    expect(events).toEqual([
      { type: "source", kind: "article", title: "Guide", href: "/blog/guide" },
      { type: "done", outcome: "answered" },
    ]);
    const bad = new Response('{"type":"source","kind":"person","title":"x","href":"/x"}\n').body;
    if (bad === null) throw new Error("no body");
    const none = [];
    for await (const event of readChatEvents(bad)) none.push(event);
    expect(none).toEqual([]);
  });

  it("keeps the sources of an answer in the tab and reads them back, at most the cap", () => {
    const entry = {
      id: "a1",
      role: "assistant" as const,
      text: "An answer.",
      notes: [],
      references: [],
      sources: [{ kind: "article" as const, title: "Guide", href: "/blog/guide" }],
      replaced: false,
    };
    const raw = JSON.stringify({
      version: 1,
      entries: [entry],
      draft: "",
      gate: false,
      account: false,
    });
    const loaded = loadChat({ getItem: () => raw });
    expect(loaded.entries).toHaveLength(1);
    const tooMany = {
      ...entry,
      sources: Array.from({ length: AI_MAX_SOURCES_PER_ANSWER + 1 }, (_, index) => ({
        kind: "faq" as const,
        title: `Q${index}`,
        href: `/faq#faq-${FAQ_ID}`,
      })),
    };
    const rawBad = JSON.stringify({
      version: 1,
      entries: [tooMany],
      draft: "",
      gate: false,
      account: false,
    });
    expect(loadChat({ getItem: () => rawBad }).entries).toHaveLength(0);
  });
});

describe("UT-ai-chat-sources: the Sources row", () => {
  it("draws each source as a link with its title, under the answer, and keeps them in the tab", async () => {
    fetchMock.mockResolvedValueOnce(
      answered(
        source("article", "Registration charges explained", "/blog/registration-charges"),
        source("faq", "How do I post a home?", `/faq#faq-${FAQ_ID}`),
      ),
    );
    await ask();
    const row = document.querySelector("[data-slot='chat-sources']") as HTMLElement;
    expect(row).not.toBeNull();
    expect(within(row).getByText(words.sources.label)).toBeVisible();
    expect(
      within(row).getByRole("link", { name: /Registration charges explained/ }),
    ).toHaveAttribute("href", "/blog/registration-charges");
    expect(within(row).getByRole("link", { name: /How do I post a home\?/ })).toHaveAttribute(
      "href",
      `/faq#faq-${FAQ_ID}`,
    );
    await waitFor(() => {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      const kept = raw === null ? null : (JSON.parse(raw) as StoredChat);
      const answer = kept?.entries.find((entry) => entry.role === "assistant");
      expect(answer && "sources" in answer ? answer.sources : []).toHaveLength(2);
    });
  });

  it("draws no row for an answer with no source", async () => {
    fetchMock.mockResolvedValueOnce(answered());
    await ask();
    expect(document.querySelector("[data-slot='chat-sources']")).toBeNull();
    expect(screen.queryByText(words.sources.label)).toBeNull();
  });

  it("draws only addresses the server could have built, never an address that leaves the site or reaches elsewhere", async () => {
    fetchMock.mockResolvedValueOnce(
      answered(
        source("article", "Off site", "https://evil.example/blog/x"),
        source("article", "Protocol relative", "//evil.example/blog/x"),
        source("article", "Admin page", "/admin/blog/x"),
        source("faq", "Real question", `/faq#faq-${FAQ_ID}`),
      ),
    );
    await ask();
    expect(screen.queryByRole("link", { name: /Off site/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /Protocol relative/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /Admin page/ })).toBeNull();
    expect(screen.getByRole("link", { name: /Real question/ })).toBeVisible();
  });

  it("draws at most the cap, each address once", async () => {
    fetchMock.mockResolvedValueOnce(
      answered(
        source("article", "One", "/blog/one"),
        source("article", "One again", "/blog/one"),
        source("article", "Two", "/blog/two"),
        source("article", "Three", "/blog/three"),
        source("article", "Four", "/blog/four"),
      ),
    );
    await ask();
    const row = document.querySelector("[data-slot='chat-sources']") as HTMLElement;
    expect(within(row).getAllByRole("link")).toHaveLength(AI_MAX_SOURCES_PER_ANSWER);
    expect(within(row).queryByRole("link", { name: /One again/ })).toBeNull();
  });

  it("shows the title as text, never as markup", async () => {
    fetchMock.mockResolvedValueOnce(
      answered(source("article", "<b>Bold</b> <img src=x onerror=alert(1)>", "/blog/bold")),
    );
    await ask();
    expect(
      document.querySelector("[data-slot='chat-sources'] b, [data-slot='chat-sources'] img"),
    ).toBeNull();
    expect(screen.getByRole("link", { name: /<b>Bold<\/b>/ })).toHaveAttribute(
      "href",
      "/blog/bold",
    );
  });

  it("draws nothing for an answer a fixed line replaced", async () => {
    fetchMock.mockResolvedValueOnce(
      stream([
        { type: "start", requestId: "r" },
        source("article", "Guide", "/blog/guide"),
        { type: "replace", key: "ai.fallback", text: "I couldn't finish that." },
        { type: "done", outcome: "blocked" },
      ]),
    );
    renderWithMessages(<ChatIsland signedIn={false} controls={controls} />);
    await screen.findByText(words.examples.label);
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox", { name: words.composer.label }), "a question");
    await user.click(screen.getByRole("button", { name: words.composer.send }));
    await screen.findByText("I couldn't finish that.");
    expect(document.querySelector("[data-slot='chat-sources']")).toBeNull();
  });
});

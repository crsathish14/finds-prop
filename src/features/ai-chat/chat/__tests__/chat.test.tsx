// @vitest-environment jsdom
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/i18n/messages/en.json";
import { renderWithMessages } from "../../../../../tests/render-intl";
import { encodeChatEvent, type ChatStreamEvent } from "../../endpoint/events";
import { limitResponse, serverErrorResponse } from "../../endpoint/responses";
import { STORAGE_KEY, type StoredChat } from "../chat-model";

const cards = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("../../actions", () => ({ readChatCardsAction: cards.read }));

const { ChatIsland } = await import("../chat.client");

const controls = {
  Save: ({ shortId }: { shortId: string }) => <button type="button">Save {shortId}</button>,
  Compare: ({ shortId }: { shortId: string }) => <span>Compare {shortId}</span>,
};

const words = messages.ai;
const translate = ((key: string, values?: Record<string, unknown>) =>
  `${key}${values ? JSON.stringify(values) : ""}`) as never;

function stream(events: ChatStreamEvent[]): Response {
  const encoder = events.map((event) => encodeChatEvent(event));
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const bytes of encoder) controller.enqueue(bytes);
        controller.close();
      },
    }),
    { headers: { "content-type": "application/x-ndjson" } },
  );
}

const answered = (text: string, more: ChatStreamEvent[] = []): Response =>
  stream([
    { type: "start", requestId: "r" },
    { type: "status", text: "Searching…" },
    ...more,
    { type: "text", text },
    { type: "done", outcome: "answered" },
  ]);

const fetchMock = vi.fn<typeof fetch>();

function stored(): StoredChat | null {
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  return raw === null ? null : (JSON.parse(raw) as StoredChat);
}

function sentMessages(call: number): unknown {
  const body = fetchMock.mock.calls[call]?.[1]?.body;
  return JSON.parse(String(body)).messages;
}

const box = () => screen.getByRole("textbox", { name: words.composer.label });
const sendButton = () => screen.getByRole("button", { name: words.composer.send });

async function type(text: string) {
  const user = userEvent.setup();
  await user.type(box(), text);
  return user;
}

async function ready() {
  await screen.findByText(words.examples.label);
}

beforeEach(() => {
  window.sessionStorage.clear();
  fetchMock.mockReset();
  cards.read.mockReset();
  cards.read.mockResolvedValue({ ok: true, data: [] });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("the chat page's first screen (AI-P5-T02)", () => {
  it("shows the heading, the line, the five example prompts and the composer", async () => {
    renderWithMessages(<ChatIsland signedIn={false} controls={controls} />);
    await ready();
    expect(screen.getByRole("heading", { level: 1, name: words.heading })).toBeVisible();
    expect(screen.getByText(words.intro)).toBeVisible();
    for (const key of ["search", "builder", "emi", "tamil", "tanglish"] as const) {
      expect(screen.getByRole("button", { name: words.examples[key] })).toBeVisible();
    }
    expect(box()).toBeEnabled();
  });

  it("fills the box and moves focus there when a prompt is chosen, and sends nothing", async () => {
    const user = userEvent.setup();
    renderWithMessages(<ChatIsland signedIn={false} controls={controls} />);
    await ready();
    await user.click(screen.getByRole("button", { name: words.examples.emi }));
    expect(box()).toHaveValue(words.examples.emi);
    expect(box()).toHaveFocus();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("sending a message and reading the answer (AI-P5-T02)", () => {
  it("sends the text, draws the answer, keeps focus in the box and keeps the transcript", async () => {
    fetchMock.mockResolvedValueOnce(answered("I found two homes in Velachery."));
    renderWithMessages(<ChatIsland signedIn={false} controls={controls} />);
    await ready();
    const user = await type("3 BHK in Velachery");
    await user.click(sendButton());

    expect(await screen.findByText("I found two homes in Velachery.")).toBeVisible();
    expect(sentMessages(0)).toEqual([{ role: "user", text: "3 BHK in Velachery" }]);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/ai/chat");
    const thread = screen.getByRole("list", { name: words.thread.label });
    expect(within(thread).getAllByRole("listitem")).toHaveLength(2);
    expect(box()).toHaveValue("");
    expect(box()).toHaveFocus();
    // The examples give way to the title bar: the only h1 is the assistant's name.
    expect(screen.getByRole("heading", { level: 1, name: words.assistantName })).toBeVisible();
    await waitFor(() =>
      expect(stored()?.entries.map((entry) => entry.role)).toEqual(["user", "assistant"]),
    );
    expect(stored()?.draft).toBe("");
  });

  it("says Searching… and turns Send off while the answer is written, with the box still usable", async () => {
    let finish: (response: Response) => void = () => undefined;
    fetchMock.mockReturnValueOnce(new Promise<Response>((resolve) => (finish = resolve)));
    renderWithMessages(<ChatIsland signedIn={false} controls={controls} />);
    await ready();
    const user = await type("hello");
    await user.click(sendButton());

    expect(await screen.findByRole("status")).toHaveTextContent(words.searching);
    expect(box()).toBeEnabled();
    await user.type(box(), "more");
    expect(sendButton()).toBeDisabled();
    await user.keyboard("{Enter}");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => finish(answered("Hello there.")));
    expect(await screen.findByText("Hello there.")).toBeVisible();
    expect(screen.queryByText(words.searching)).toBeNull();
    expect(sendButton()).toBeEnabled();
  });

  it("sends the earlier turns with the next message", async () => {
    fetchMock
      .mockResolvedValueOnce(answered("First answer."))
      .mockResolvedValueOnce(answered("Second."));
    renderWithMessages(<ChatIsland signedIn={false} controls={controls} />);
    await ready();
    const user = await type("first");
    await user.click(sendButton());
    await screen.findByText("First answer.");
    await user.type(box(), "second");
    await user.keyboard("{Enter}");
    await screen.findByText("Second.");
    expect(sentMessages(1)).toEqual([
      { role: "user", text: "first" },
      { role: "assistant", text: "First answer." },
      { role: "user", text: "second" },
    ]);
  });

  it("shows the personal-details notice under the visitor's bubble and the fixed notes under the answer", async () => {
    fetchMock.mockResolvedValueOnce(
      answered("Prices are an example.", [
        { type: "notice", key: "ai.maskedNotice", text: words.maskedNotice },
        { type: "notice", key: "ai.disclaimer", text: words.disclaimer },
      ]),
    );
    renderWithMessages(<ChatIsland signedIn={false} controls={controls} />);
    await ready();
    const user = await type("call me");
    await user.click(sendButton());
    await screen.findByText("Prices are an example.");
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items.at(0) as HTMLElement).getByRole("status")).toHaveTextContent(
      words.maskedNotice,
    );
    expect(within(items.at(1) as HTMLElement).getByRole("note")).toHaveTextContent(
      words.disclaimer,
    );
  });

  it("draws a fixed line that replaced the answer, with a link to the filters", async () => {
    fetchMock.mockResolvedValueOnce(
      stream([
        { type: "start", requestId: "r" },
        { type: "replace", key: "ai.fallback", text: words.fallback, href: "/properties" },
        { type: "done", outcome: "fallback" },
      ]),
    );
    renderWithMessages(<ChatIsland signedIn={false} controls={controls} />);
    await ready();
    const user = await type("anything");
    await user.click(sendButton());
    expect(await screen.findByText(words.fallback)).toBeVisible();
    expect(screen.getByRole("link", { name: words.notice.useFilters })).toHaveAttribute(
      "href",
      "/properties",
    );
  });

  it("does not draw a link that leaves the site", async () => {
    fetchMock.mockResolvedValueOnce(
      stream([
        { type: "start", requestId: "r" },
        { type: "replace", key: "ai.fallback", text: words.fallback, href: "https://example.com" },
        { type: "done", outcome: "fallback" },
      ]),
    );
    renderWithMessages(<ChatIsland signedIn={false} controls={controls} />);
    await ready();
    const user = await type("anything");
    await user.click(sendButton());
    await screen.findByText(words.fallback);
    expect(screen.queryByRole("link", { name: words.notice.useFilters })).toBeNull();
  });

  it("asks the server for the cards an answer names and draws them", async () => {
    cards.read.mockResolvedValue({
      ok: true,
      data: [
        {
          kind: "home",
          key: "home:aaaaaaaa",
          shortId: "aaaaaaaa",
          card: {
            href: "/properties/two-bhk-aaaaaaaa",
            title: "Two bedroom flat in Velachery",
            locality: "Velachery",
            city: "Chennai",
            rupees: 12500000,
            listingType: "sale",
            cover: null,
          },
        },
        {
          kind: "project",
          key: "project:kadal-vista",
          card: {
            href: "/projects/kadal-vista",
            name: "Kadal Vista",
            developerName: "Kadal Homes",
            locality: "Adyar",
            city: "",
            minRupees: 9000000,
            maxRupees: 15000000,
            bedrooms: [2, 3],
            status: null,
            featured: false,
            cover: null,
          },
        },
      ],
    });
    fetchMock.mockResolvedValueOnce(
      answered("Here are two.", [
        { type: "card", reference: { kind: "home", homeId: "aaaaaaaa", slug: "two-bhk" } },
        { type: "card", reference: { kind: "project", slug: "kadal-vista" } },
      ]),
    );
    renderWithMessages(<ChatIsland signedIn={false} controls={controls} />);
    await ready();
    const user = await type("show me");
    await user.click(sendButton());
    expect(
      await screen.findByRole("link", { name: /Two bedroom flat in Velachery/ }),
    ).toHaveAttribute("href", "/properties/two-bhk-aaaaaaaa");
    expect(screen.getByRole("link", { name: /Kadal Vista/ })).toHaveAttribute(
      "href",
      "/projects/kadal-vista",
    );
    // The home card keeps its heart and Compare control, handed in by the server screen.
    expect(screen.getByRole("button", { name: "Save aaaaaaaa" })).toBeVisible();
    expect(screen.getByText("Compare aaaaaaaa")).toBeVisible();
    expect(cards.read).toHaveBeenLastCalledWith({
      references: [
        { kind: "home", homeId: "aaaaaaaa", slug: "two-bhk" },
        { kind: "project", slug: "kadal-vista" },
      ],
    });
  });

  it("draws no more than three cards", async () => {
    fetchMock.mockResolvedValueOnce(
      answered(
        "Many.",
        ["aaaaaaaa", "bbbbbbbb", "cccccccc", "dddddddd"].map((homeId) => ({
          type: "card" as const,
          reference: { kind: "home" as const, homeId, slug: "x" },
        })),
      ),
    );
    renderWithMessages(<ChatIsland signedIn={false} controls={controls} />);
    await ready();
    const user = await type("show me");
    await user.click(sendButton());
    await screen.findByText("Many.");
    await waitFor(() => expect(cards.read).toHaveBeenCalled());
    const request = cards.read.mock.calls.at(-1)?.[0] as { references: unknown[] };
    expect(request.references).toHaveLength(3);
  });
});

describe("when an answer cannot be given (AI-P5-T02)", () => {
  it("offers Try again after an error, keeps the message and sends it once more", async () => {
    fetchMock
      .mockResolvedValueOnce(serverErrorResponse("r", translate))
      .mockResolvedValueOnce(answered("Now it works."));
    renderWithMessages(<ChatIsland signedIn={false} controls={controls} />);
    await ready();
    const user = await type("3 BHK");
    await user.click(sendButton());

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(words.errorTitle);
    expect(screen.getAllByText("3 BHK")).toHaveLength(1);
    await user.click(within(alert).getByRole("button", { name: words.notice.retry }));
    expect(await screen.findByText("Now it works.")).toBeVisible();
    expect(sentMessages(1)).toEqual([{ role: "user", text: "3 BHK" }]);
    // The message is in the thread once, not twice, and the notice is gone.
    expect(screen.getAllByText("3 BHK")).toHaveLength(1);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("treats a network failure and a stream that stops before done as an error", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    renderWithMessages(<ChatIsland signedIn={false} controls={controls} />);
    await ready();
    const user = await type("first");
    await user.click(sendButton());
    expect(await screen.findByRole("alert")).toHaveTextContent(words.errorTitle);

    fetchMock.mockResolvedValueOnce(
      stream([
        { type: "start", requestId: "r" },
        { type: "text", text: "Half an answ" },
      ]),
    );
    await user.click(screen.getByRole("button", { name: words.notice.retry }));
    expect(await screen.findByRole("alert")).toHaveTextContent(words.errorTitle);
    expect(screen.queryByText(/Half an answ/)).toBeNull();
  });
});

describe("the limits (AI-P5-T02)", () => {
  it("shows the wait, keeps the draft, turns the composer off and turns it on again", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchMock.mockResolvedValueOnce(limitResponse("ai_chat_burst", 30, "r", translate));
    renderWithMessages(<ChatIsland signedIn={false} controls={controls} />);
    await ready();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.type(box(), "hello");
    await user.click(sendButton());

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(words.tooManyMessagesTitle);
    expect(alert).toHaveTextContent("30 seconds");
    expect(within(alert).getByRole("link", { name: words.notice.useFilters })).toHaveAttribute(
      "href",
      "/properties",
    );
    expect(box()).toBeDisabled();
    expect(box()).toHaveValue("hello");
    expect(screen.getByText(words.composer.offWithDraft)).toBeVisible();
    // The message went back to the box, so it is not in the conversation.
    expect(screen.queryByRole("list", { name: words.thread.label })).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(31_000);
    });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(box()).toBeEnabled();
    expect(box()).toHaveValue("hello");
  });

  it("shows the daily limit with the composer off", async () => {
    fetchMock.mockResolvedValueOnce(limitResponse("ai_chat_user_day", 3600, "r", translate));
    renderWithMessages(<ChatIsland signedIn controls={controls} />);
    await ready();
    const user = await type("hello");
    await user.click(sendButton());
    expect(await screen.findByRole("alert")).toHaveTextContent(words.dailyLimitTitle);
    expect(box()).toBeDisabled();
  });

  it("shows that the assistant is unavailable, with a link to the filters", async () => {
    fetchMock.mockResolvedValueOnce(limitResponse("ai_chat_global_day", 3600, "r", translate));
    renderWithMessages(<ChatIsland signedIn controls={controls} />);
    await ready();
    const user = await type("hello");
    await user.click(sendButton());
    const notice = await screen.findByText(words.unavailableTitle);
    expect(notice).toBeVisible();
    expect(screen.getByRole("link", { name: words.notice.searchWithFilters })).toHaveAttribute(
      "href",
      "/properties",
    );
    expect(box()).toBeDisabled();
  });
});

describe("the sign-in gate and the way back (AI-P5-T02)", () => {
  it("shows the gate in place of the composer, quotes the unsent message and leads to sign-in", async () => {
    fetchMock
      .mockResolvedValueOnce(answered("Answer one."))
      .mockResolvedValueOnce(answered("Answer two."))
      .mockResolvedValueOnce(limitResponse("ai_chat_trial", undefined, "r", translate));
    renderWithMessages(<ChatIsland signedIn={false} controls={controls} />);
    await ready();
    const user = await type("one");
    await user.click(sendButton());
    await screen.findByText("Answer one.");
    await user.type(box(), "two");
    await user.click(sendButton());
    await screen.findByText("Answer two.");
    await user.type(box(), "Same size in Adyar?");
    await user.click(sendButton());

    const heading = await screen.findByRole("heading", { name: words.signInGateTitle });
    expect(heading).toHaveFocus();
    const gate = screen.getByRole("region", { name: words.signInGateTitle });
    expect(within(gate).getByText("Same size in Adyar?")).toBeVisible();
    expect(within(gate).getByRole("link", { name: words.gate.signIn })).toHaveAttribute(
      "href",
      "/auth?redirect=%2Fai-search",
    );
    expect(screen.queryByRole("textbox")).toBeNull();
    // The unsent message is not a bubble in the conversation; the two answered turns are.
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await waitFor(() => expect(stored()?.gate).toBe(true));
    expect(stored()?.draft).toBe("Same size in Adyar?");
    expect(stored()?.entries).toHaveLength(4);
  });

  it("brings the conversation and the draft back after signing in, and sends nothing by itself", async () => {
    const chat: StoredChat = {
      version: 1,
      gate: true,
      account: false,
      draft: "Same size in Adyar?",
      entries: [
        { id: "a", role: "user", text: "3 BHK in Velachery", masked: false },
        {
          id: "b",
          role: "assistant",
          text: "I found two homes.",
          notes: [],
          references: [],
          replaced: false,
        },
      ],
    };
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(chat));
    renderWithMessages(<ChatIsland signedIn controls={controls} />);

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent(words.returnedTitle);
    expect(status).toHaveTextContent(words.returnedBody);
    expect(screen.getByText("3 BHK in Velachery")).toBeVisible();
    expect(screen.getByText("I found two homes.")).toBeVisible();
    expect(box()).toHaveValue("Same size in Adyar?");
    expect(box()).toHaveFocus();
    expect(screen.queryByRole("heading", { name: words.signInGateTitle })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();

    // The person presses Send, and the earlier turns go with it.
    fetchMock.mockResolvedValueOnce(answered("Similar in Adyar."));
    await userEvent.setup().click(sendButton());
    expect(await screen.findByText("Similar in Adyar.")).toBeVisible();
    expect(sentMessages(0)).toEqual([
      { role: "user", text: "3 BHK in Velachery" },
      { role: "assistant", text: "I found two homes." },
      { role: "user", text: "Same size in Adyar?" },
    ]);
    expect(screen.queryByText(words.returnedTitle)).toBeNull();
    expect(stored()?.gate).toBe(false);
  });

  it("keeps the gate when the visitor comes back without having signed in", async () => {
    const chat: StoredChat = {
      version: 1,
      gate: true,
      account: false,
      draft: "next question",
      entries: [],
    };
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(chat));
    renderWithMessages(<ChatIsland signedIn={false} controls={controls} />);
    expect(await screen.findByRole("heading", { name: words.signInGateTitle })).toBeVisible();
    expect(screen.getByText("next question")).toBeVisible();
    expect(screen.queryByText(words.returnedTitle)).toBeNull();
    // Behind the gate the example prompts do not fill a box that is not there.
    expect(screen.getByRole("button", { name: words.examples.emi })).toBeDisabled();
  });

  it("starts empty when what the tab kept is not a conversation", async () => {
    window.sessionStorage.setItem(STORAGE_KEY, "{broken");
    renderWithMessages(<ChatIsland signedIn={false} controls={controls} />);
    await ready();
    expect(box()).toHaveValue("");
    expect(screen.queryByRole("list", { name: words.thread.label })).toBeNull();
  });
});

describe("what the tab keeps, and for whom (AI-P5-T02)", () => {
  it("keeps what the visitor typed while waiting when the message is refused", async () => {
    let refuse: (response: Response) => void = () => undefined;
    fetchMock.mockReturnValueOnce(new Promise<Response>((resolve) => (refuse = resolve)));
    renderWithMessages(<ChatIsland signedIn={false} controls={controls} />);
    await ready();
    const user = await type("third message");
    await user.click(sendButton());
    await screen.findByRole("status");
    await user.type(box(), "Same size in Adyar?");
    await act(async () => refuse(limitResponse("ai_chat_trial", undefined, "r", translate)));
    expect(await screen.findByRole("heading", { name: words.signInGateTitle })).toBeVisible();
    expect(screen.getByText("Same size in Adyar?")).toBeVisible();
    expect(screen.queryByText("third message")).toBeNull();
  });

  it("shows nothing of a conversation kept while signed in to a visitor who is not", async () => {
    const chat: StoredChat = {
      version: 1,
      gate: false,
      account: true,
      draft: "private draft",
      entries: [{ id: "a", role: "user", text: "my earlier question", masked: false }],
    };
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(chat));
    renderWithMessages(<ChatIsland signedIn={false} controls={controls} />);
    await ready();
    expect(screen.queryByText("my earlier question")).toBeNull();
    expect(box()).toHaveValue("");
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("does not leave a message with removed personal details in the browser", async () => {
    fetchMock.mockResolvedValueOnce(
      answered("Noted.", [{ type: "notice", key: "ai.maskedNotice", text: words.maskedNotice }]),
    );
    renderWithMessages(<ChatIsland signedIn={false} controls={controls} />);
    await ready();
    const user = await type("call me on 98400 12345");
    await user.click(sendButton());
    await screen.findByText("Noted.");
    expect(screen.getByText(/98400 12345/)).toBeVisible();
    await waitFor(() => expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull());
  });
});

describe("the cards under an answer, when they cannot be read (AI-P5-T02)", () => {
  it("leaves the answer's text on its own when the read fails, and reads the cards once", async () => {
    cards.read.mockRejectedValueOnce(new Error("network"));
    fetchMock.mockResolvedValueOnce(
      answered("Here is one.", [
        { type: "card", reference: { kind: "home", homeId: "bbbbbbbb", slug: "x" } },
      ]),
    );
    renderWithMessages(<ChatIsland signedIn={false} controls={controls} />);
    await ready();
    const user = await type("show me");
    await user.click(sendButton());
    expect(await screen.findByText("Here is one.")).toBeVisible();
    await waitFor(() => expect(cards.read).toHaveBeenCalledTimes(1));
  });

  it("does not read the cards again when the answer finishes", async () => {
    cards.read.mockResolvedValue({ ok: true, data: [] });
    fetchMock.mockResolvedValueOnce(
      answered("Here is one.", [
        { type: "card", reference: { kind: "home", homeId: "cccccccc", slug: "x" } },
      ]),
    );
    renderWithMessages(<ChatIsland signedIn={false} controls={controls} />);
    await ready();
    const user = await type("show me");
    await user.click(sendButton());
    await screen.findByText("Here is one.");
    await waitFor(() => expect(sendButton()).toBeDisabled());
    await act(async () => undefined);
    expect(cards.read).toHaveBeenCalledTimes(1);
  });
});

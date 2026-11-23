// @vitest-environment jsdom
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/i18n/messages/en.json";
import { renderWithMessages } from "../../../../../tests/render-intl";
import { encodeChatEvent, type ChatStreamEvent } from "../../endpoint/events";
import { limitResponse, serverErrorResponse } from "../../endpoint/responses";
import { STORAGE_KEY, type StoredChat } from "../chat-model";
import { HOME_QUESTION_KEY } from "../home-question";

const cards = vi.hoisted(() => ({ read: vi.fn(), confirm: vi.fn() }));
vi.mock("../../actions", () => ({
  readChatCardsAction: cards.read,
  confirmChatProposal: cards.confirm,
}));

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
  cards.confirm.mockReset();
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

describe("the time of the visitor's message is shown beside it (ADR-185)", () => {
  it("shows the time under the visitor's message and none inside the assistant's answer", async () => {
    fetchMock.mockResolvedValueOnce(answered("I found one home."));
    renderWithMessages(<ChatIsland signedIn={false} controls={controls} />);
    await ready();
    const user = await type("3 BHK in Velachery");
    await user.click(sendButton());
    await screen.findByText("I found one home.");
    const times = document.querySelectorAll("time");
    expect(times).toHaveLength(1);
    expect(times[0]?.closest("[data-slot='chat-user-message']")).not.toBeNull();
    expect(times[0]?.textContent).toMatch(/^\d{1,2}:\d{2}\s?(am|pm)$/iu);
    await waitFor(() =>
      expect(stored()?.entries[0]).toMatchObject({ role: "user", at: expect.any(Number) }),
    );
  });
});

describe("the assistant's questions are drawn in bold (ADR-184)", () => {
  it("puts the question sentence in bold and leaves the rest as plain text, with the words unchanged", async () => {
    fetchMock.mockResolvedValueOnce(
      answered("I found one home for ₹1.29 Cr. Shall I prepare an enquiry for it? Tell me if not."),
    );
    renderWithMessages(<ChatIsland signedIn={false} controls={controls} />);
    await ready();
    const user = await type("homes in Velachery");
    await user.click(sendButton());
    const bold = await screen.findByText("Shall I prepare an enquiry for it?");
    expect(bold.tagName).toBe("STRONG");
    const paragraph = bold.closest("p");
    expect(paragraph?.textContent).toBe(
      "I found one home for ₹1.29 Cr. Shall I prepare an enquiry for it? Tell me if not.",
    );
    expect(paragraph?.querySelectorAll("strong")).toHaveLength(1);
  });
});

describe("the reply buttons under an answer (ADR-175)", () => {
  const withReplies = (text: string): Response =>
    answered(text, [
      {
        type: "replies",
        items: [
          { key: "enquireHome", text: words.replies.enquireHome },
          { key: "workOutEmi", text: words.replies.workOutEmi },
        ],
      },
    ]);

  it("draws the buttons in a labelled list under the newest answer only", async () => {
    fetchMock.mockResolvedValueOnce(withReplies("I found one home."));
    renderWithMessages(<ChatIsland signedIn={false} controls={controls} />);
    await ready();
    const user = await type("3 BHK in Velachery");
    await user.click(sendButton());
    const list = await screen.findByRole("list", { name: words.replies.label });
    expect(
      within(list)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual([words.replies.enquireHome, words.replies.workOutEmi]);
  });

  it("sends the words of a button as the next message, and draws none after a plain answer", async () => {
    fetchMock
      .mockResolvedValueOnce(withReplies("I found one home."))
      .mockResolvedValueOnce(answered("I can prepare it."));
    renderWithMessages(<ChatIsland signedIn={false} controls={controls} />);
    await ready();
    const user = await type("3 BHK in Velachery");
    await user.click(sendButton());
    await user.click(await screen.findByRole("button", { name: words.replies.enquireHome }));
    expect(await screen.findByText("I can prepare it.")).toBeVisible();
    expect(sentMessages(1)).toEqual([
      { role: "user", text: "3 BHK in Velachery" },
      { role: "assistant", text: "I found one home." },
      { role: "user", text: words.replies.enquireHome },
    ]);
    await waitFor(() =>
      expect(screen.queryByRole("list", { name: words.replies.label })).not.toBeInTheDocument(),
    );
  });

  it("leaves the buttons out when the message was refused at the sign-in gate", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { state: "sign_in_required" } }), { status: 401 }),
    );
    renderWithMessages(<ChatIsland signedIn={false} controls={controls} />);
    await ready();
    const user = await type("3 BHK in Velachery");
    await user.click(sendButton());
    await waitFor(() =>
      expect(screen.queryByRole("list", { name: words.replies.label })).not.toBeInTheDocument(),
    );
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

describe("the question from the home page's search bar (ADR-150)", () => {
  const keep = (text: string) =>
    window.sessionStorage.setItem(HOME_QUESTION_KEY, JSON.stringify({ text }));

  it("sends it as the first message once, and not again after a reload", async () => {
    fetchMock.mockResolvedValueOnce(answered("I found two homes in Velachery."));
    keep("3 BHK near Velachery under 90 lakh");
    const view = renderWithMessages(<ChatIsland signedIn={false} controls={controls} />);

    expect(await screen.findByText("I found two homes in Velachery.")).toBeVisible();
    expect(sentMessages(0)).toEqual([{ role: "user", text: "3 BHK near Velachery under 90 lakh" }]);
    expect(window.sessionStorage.getItem(HOME_QUESTION_KEY)).toBeNull();
    expect(box()).toHaveValue("");
    expect(box()).toHaveFocus();

    view.unmount();
    renderWithMessages(<ChatIsland signedIn={false} controls={controls} />);
    expect(await screen.findByText("I found two homes in Velachery.")).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("adds it to the conversation already kept in the tab", async () => {
    const chat: StoredChat = {
      version: 1,
      gate: false,
      account: false,
      draft: "",
      entries: [
        { id: "a", role: "user", text: "Plots in Porur", masked: false },
        {
          id: "b",
          role: "assistant",
          text: "Here are three plots.",
          notes: [],
          references: [],
          replaced: false,
        },
      ],
    };
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(chat));
    fetchMock.mockResolvedValueOnce(answered("Two villas in Adyar."));
    keep("Villas in Adyar");
    renderWithMessages(<ChatIsland signedIn={false} controls={controls} />);

    expect(await screen.findByText("Two villas in Adyar.")).toBeVisible();
    expect(screen.getByText("Here are three plots.")).toBeVisible();
    expect(sentMessages(0)).toEqual([
      { role: "user", text: "Plots in Porur" },
      { role: "assistant", text: "Here are three plots." },
      { role: "user", text: "Villas in Adyar" },
    ]);
  });

  it("only puts the cursor in the box when the search bar was empty", async () => {
    keep("");
    renderWithMessages(<ChatIsland signedIn={false} controls={controls} />);
    await ready();
    await waitFor(() => expect(box()).toHaveFocus());
    expect(box()).toHaveValue("");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(HOME_QUESTION_KEY)).toBeNull();
  });

  it("waits in the box, unsent, while the sign-in gate is up", async () => {
    const chat: StoredChat = { version: 1, gate: true, account: false, draft: "", entries: [] };
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(chat));
    keep("Same size in Adyar?");
    renderWithMessages(<ChatIsland signedIn={false} controls={controls} />);

    const gate = await screen.findByRole("region", { name: words.signInGateTitle });
    expect(within(gate).getByText("Same size in Adyar?")).toBeVisible();
    await waitFor(() => expect(stored()?.draft).toBe("Same size in Adyar?"));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("the confirm card in the conversation (AI-P6-T02)", () => {
  const MESSAGE = "Is this home still available? I would like to visit this Saturday.";
  const target = { title: "3 BHK apartment", meta: "Velachery · ₹1.25 Cr" };
  const readyCard: ChatStreamEvent = {
    type: "confirm",
    card: {
      state: "ready",
      kind: "enquiry",
      proposal: "body.signature",
      target,
      name: "Priya Raman",
      phone: "+91 98400 12345",
      message: MESSAGE,
    },
  };
  const signedOut: ChatStreamEvent = {
    type: "confirm",
    card: { state: "signed_out", kind: "enquiry", target, message: MESSAGE },
  };
  const cardWords = messages.ai.confirm;

  it("draws the card under the answer, and a typed 'yes' is only a message to the assistant: nothing is sent", async () => {
    fetchMock
      .mockResolvedValueOnce(answered("I have prepared an enquiry. Press Send.", [readyCard]))
      .mockResolvedValueOnce(answered("Please press the Send button on the card."));
    renderWithMessages(<ChatIsland signedIn controls={controls} />);
    await ready();
    const user = await type("please ask the owner");
    await user.click(sendButton());
    expect(await screen.findByRole("region", { name: cardWords.enquiryTitle })).toBeVisible();
    expect(screen.getByText("Priya Raman")).toBeVisible();

    await user.type(box(), "yes");
    await user.keyboard("{Enter}");
    await screen.findByText("Please press the Send button on the card.");
    expect(sentMessages(1)).toEqual([
      { role: "user", text: "please ask the owner" },
      { role: "assistant", text: "I have prepared an enquiry. Press Send." },
      { role: "user", text: "yes" },
    ]);
    expect(cards.confirm).not.toHaveBeenCalled();
  });

  it("sends only when the card's own button is pressed, with the proposal and a fresh key, and keeps the card in place when the answer ends", async () => {
    cards.confirm.mockResolvedValue({ ok: true, data: { received: true } });
    fetchMock.mockResolvedValueOnce(
      answered("I have prepared an enquiry. Press Send.", [readyCard]),
    );
    renderWithMessages(<ChatIsland signedIn controls={controls} />);
    await ready();
    const user = await type("please ask the owner");
    await user.click(sendButton());
    const press = await screen.findByRole("button", {
      name: new RegExp(messages.domain.enquiry.form.send),
    });
    await user.click(press);
    expect(cards.confirm).toHaveBeenCalledExactlyOnceWith({
      proposal: "body.signature",
      idempotencyKey: expect.any(String),
    });
    expect(
      await screen.findByRole("heading", { name: messages.domain.enquiry.sent.title }),
    ).toBeVisible();
  });

  it("keeps the signed proposal and the customer's own details out of the tab's storage", async () => {
    fetchMock.mockResolvedValueOnce(
      answered("I have prepared an enquiry. Press Send.", [readyCard]),
    );
    renderWithMessages(<ChatIsland signedIn controls={controls} />);
    await ready();
    const user = await type("please ask the owner");
    await user.click(sendButton());
    await screen.findByRole("region", { name: cardWords.enquiryTitle });
    await waitFor(() => expect(stored()?.entries).toHaveLength(2));
    const raw = window.sessionStorage.getItem(STORAGE_KEY) ?? "";
    expect(raw).not.toContain("body.signature");
    expect(raw).not.toContain("98400 12345");
    expect(raw).not.toContain("Priya Raman");
    expect(raw).toContain("I have prepared an enquiry. Press Send.");
  });

  it("brings the message back into the box after the visitor signs in from the card, and sends nothing by itself", async () => {
    fetchMock.mockResolvedValueOnce(answered("Please sign in to send this.", [signedOut]));
    const first = renderWithMessages(<ChatIsland signedIn={false} controls={controls} />);
    await ready();
    const user = await type("please ask the owner");
    await user.click(sendButton());
    const signIn = await screen.findByRole("link", { name: cardWords.signInToSend });
    expect(signIn).toHaveAttribute("href", "/auth?redirect=%2Fai-search");
    await user.click(signIn);
    first.unmount();

    // The way back: signed in, the same page, the same tab.
    renderWithMessages(<ChatIsland signedIn controls={controls} />);
    await screen.findByText("Please sign in to send this.");
    await waitFor(() => expect(box()).toHaveValue(MESSAGE));
    expect(screen.getByText("Please sign in to send this.")).toBeVisible();
    expect(screen.queryByRole("region", { name: cardWords.enquiryTitle })).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(cards.confirm).not.toHaveBeenCalled();
  });

  it("does not overwrite what the visitor was typing when the kept message comes back", async () => {
    fetchMock.mockResolvedValueOnce(answered("Please sign in to send this.", [signedOut]));
    const first = renderWithMessages(<ChatIsland signedIn={false} controls={controls} />);
    await ready();
    const user = await type("please ask the owner");
    await user.click(sendButton());
    await user.type(box(), "my next question");
    await user.click(await screen.findByRole("link", { name: cardWords.signInToSend }));
    first.unmount();

    renderWithMessages(<ChatIsland signedIn controls={controls} />);
    await screen.findByText("Please sign in to send this.");
    await waitFor(() => expect(box()).toHaveValue("my next question"));
  });
});

describe("the homes the last answer showed travel with the next message (ADR-180)", () => {
  it("sends the ids of the shown homes and projects, so 'compare these' needs no new search, and none before any answer", async () => {
    fetchMock
      .mockResolvedValueOnce(
        answered("Here are two.", [
          { type: "card", reference: { kind: "home", homeId: "k3x9a2bd", slug: "one" } },
          { type: "card", reference: { kind: "home", homeId: "m4y8b3ce", slug: "two" } },
          { type: "card", reference: { kind: "project", slug: "kadal-vista" } },
        ]),
      )
      .mockResolvedValueOnce(answered("Compared."));
    renderWithMessages(<ChatIsland signedIn controls={controls} />);
    await ready();
    const user = await type("homes in Velachery");
    await user.click(sendButton());
    await screen.findByText("Here are two.");
    await waitFor(() => expect(box()).toBeEnabled());
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).not.toHaveProperty("context");

    await user.type(box(), "compare these");
    await user.click(sendButton());
    await screen.findByText("Compared.");
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)).context).toEqual({
      shownHomes: ["k3x9a2bd", "m4y8b3ce"],
      shownProjects: ["kadal-vista"],
    });
  });
});

describe("the ticked homes travel with the message (AI chat compare)", () => {
  const Bar = ({ onIds }: { onIds: (ids: readonly string[]) => void }) => (
    <button type="button" onClick={() => onIds(["k3x9a2bd", "m4y8b3ce"])}>
      tick two
    </button>
  );

  it("sends the ids as compare context, and none when nothing is ticked", async () => {
    fetchMock.mockImplementation(async () => answered("Done."));
    const user = userEvent.setup();
    renderWithMessages(<ChatIsland signedIn controls={{ ...controls, CompareBar: Bar }} />);
    await ready();
    await user.type(box(), "any news");
    await user.click(sendButton());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).not.toHaveProperty("context");

    await user.click(screen.getByRole("button", { name: "tick two" }));
    await waitFor(() => expect(box()).toBeEnabled());
    await user.type(box(), "compare the selected ones");
    await user.click(sendButton());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)).context).toEqual({
      compare: ["k3x9a2bd", "m4y8b3ce"],
    });
  });
});

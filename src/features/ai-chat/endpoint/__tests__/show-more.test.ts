import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { textTurn, toolCallTurn } from "@/server/ai";
import type { AiChatTool } from "../../tools/types";
import { chatRequest, createHarness, readEvents, say, SIGNED_IN } from "./harness";

// UT-ai-endpoint-show-more (ADR-206): the answer hands on a signed requirements state; the Show more button with that
// state brings the next page of the same search with no model call and no repeat; a state that does not verify is
// ignored and the message goes to the model as any other. The homes are made up.

vi.mock("@/server/env", () => ({
  env: { RATE_LIMIT_HMAC_SECRET: "a-made-up-secret-of-thirty-two-chars!" },
}));

const { handleAiChat } = await import("../handler");
const { cutPage, filtersOf, pageInput } = await import("../../tools/paging");

/** Fifteen made-up homes, best match first. */
const HOMES = Array.from("abcdefghjkmnpqr", (letter) => letter.repeat(8));

const searchInput = z.object({ bhk: z.int().nullable(), page: pageInput });

/** A stand-in for `search_properties` that pages its list as the real tool does. */
const pagedSearch: AiChatTool<
  z.infer<typeof searchInput>,
  { total: number; shownSoFar: number; homes: { homeId: string }[] }
> = {
  name: "search_properties",
  kind: "read",
  description: "Searches made-up homes, for the endpoint tests.",
  input: searchInput,
  output: z.object({
    total: z.number(),
    shownSoFar: z.number(),
    homes: z.array(z.object({ homeId: z.string() })),
  }),
  async run(input, context) {
    const filters = filtersOf(input);
    const cut = cutPage(
      HOMES,
      (id) => id,
      { tool: "search_properties", page: input.page, filters },
      context,
    );
    context.search?.record({
      tool: "search_properties",
      filters,
      shown: cut.shown,
      total: HOMES.length,
      place: false,
    });
    return {
      output: {
        total: HOMES.length,
        shownSoFar: cut.shown.length,
        homes: cut.items.map((homeId) => ({ homeId })),
      },
      references: cut.items.map((homeId) => ({ kind: "home", homeId, slug: `home-${homeId}` })),
    };
  },
};

const SEARCH = toolCallTurn([
  { id: "call-1", name: "search_properties", input: { bhk: 2, page: null } },
]);

function body(text: string, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({ messages: say(text), ...extra });
}

function cardIds(events: readonly { type: string }[]): string[] {
  return events.flatMap((event) =>
    event.type === "card"
      ? [(event as unknown as { reference: { homeId: string } }).reference.homeId]
      : [],
  );
}

function tokenOf(events: readonly { type: string }[]): string | undefined {
  const event = events.find((item) => item.type === "state") as { token: string } | undefined;
  return event?.token;
}

async function firstAnswer(message = "2 BHK homes") {
  const harness = createHarness({ script: [SEARCH, textTurn("Here are six 2 BHK homes.")] });
  harness.session = SIGNED_IN;
  const deps = { ...harness.deps, tools: [pagedSearch] };
  const events = await readEvents(await handleAiChat(chatRequest(say(message)), deps));
  return { harness, deps, events };
}

describe("UT-ai-endpoint-show-more: the state and the next page", () => {
  it("hands on a signed state after a search, with Show more and no See all link the customer did not ask for (ADR-209)", async () => {
    const { events } = await firstAnswer();
    expect(cardIds(events)).toEqual(HOMES.slice(0, 6));
    expect(tokenOf(events)).toEqual(expect.any(String));
    const replies = events.find((event) => event.type === "replies") as
      { items: { key: string }[] } | undefined;
    expect(replies?.items.map((item) => item.key)).toEqual(["compareHomes", "showMore"]);
    expect(events.some((event) => event.type === "see_all")).toBe(false);
    expect(events.at(-1)).toEqual({ type: "done", outcome: "answered" });
  });

  it("adds the See all link when the customer asks for the link to all the results", async () => {
    const { events } = await firstAnswer("2 BHK homes, send me the link to see all of them");
    expect(events.find((event) => event.type === "see_all")).toMatchObject({
      href: "/properties?bhk=2",
      text: "See all 15 matching homes",
    });
  });

  it("serves the next six and then the rest from the button, with no model call and no repeat", async () => {
    const { harness, deps, events } = await firstAnswer();
    const callsBefore = harness.provider.calls.length;
    const second = await readEvents(
      await handleAiChat(
        chatRequest([], { body: body("Show more", { state: tokenOf(events), more: true }) }),
        deps,
      ),
    );
    expect(harness.provider.calls.length).toBe(callsBefore);
    expect(cardIds(second)).toEqual(HOMES.slice(6, 12));
    // Show more is a button, not a request for a link: the next page stays in the chat.
    expect(second.some((event) => event.type === "see_all")).toBe(false);
    expect(second.find((event) => event.type === "text")).toEqual({
      type: "text",
      text: "Here are 6 more homes that match your search (12 of 15 shown so far).",
    });
    const third = await readEvents(
      await handleAiChat(
        chatRequest([], { body: body("Show more", { state: tokenOf(second), more: true }) }),
        deps,
      ),
    );
    expect(cardIds(third)).toEqual(HOMES.slice(12));
    // Nothing is left: no Show more, no See all.
    const replies = third.find((event) => event.type === "replies") as
      { items: { key: string }[] } | undefined;
    expect(replies?.items.map((item) => item.key)).toEqual(["compareHomes"]);
    expect(third.some((event) => event.type === "see_all")).toBe(false);
    const fourth = await readEvents(
      await handleAiChat(
        chatRequest([], { body: body("Show more", { state: tokenOf(third), more: true }) }),
        deps,
      ),
    );
    expect(cardIds(fourth)).toEqual([]);
    expect(fourth.find((event) => event.type === "text")).toMatchObject({
      text: "That is every match for this search. Tell me what to change and I will look again.",
    });
    // A press of the button counts toward the short limit only, and the usage row says no model ran.
    expect(harness.scopesAsked.at(-1)).toEqual(["ai_chat_burst"]);
    expect(harness.usage.at(-1)).toMatchObject({
      outcome: "answered",
      rounds: 0,
      toolsRan: ["search_properties"],
    });
  });

  it("puts the remembered search into the prompt when the customer types", async () => {
    const { harness, events } = await firstAnswer();
    const next = createHarness({ script: [textTurn("Sure.")] });
    next.session = SIGNED_IN;
    await readEvents(
      await handleAiChat(
        chatRequest([], { body: body("only 3 BHK please", { state: tokenOf(events) }) }),
        {
          ...next.deps,
          tools: [pagedSearch],
        },
      ),
    );
    expect(harness.provider.calls.length).toBeGreaterThan(0);
    const system = next.provider.calls[0]?.system ?? "";
    expect(system).toContain('search_properties {"bhk":2}: 6 of 15 shown.');
  });

  it("ignores a changed state: the button then goes to the model like a typed message", async () => {
    const { events } = await firstAnswer();
    const token = tokenOf(events) ?? "";
    const forged = `${token.slice(0, 10)}${token.charAt(10) === "A" ? "B" : "A"}${token.slice(11)}`;
    const next = createHarness({ script: [textTurn("What would you like to see?")] });
    next.session = SIGNED_IN;
    const answer = await readEvents(
      await handleAiChat(
        chatRequest([], { body: body("Show more", { state: forged, more: true }) }),
        {
          ...next.deps,
          tools: [pagedSearch],
        },
      ),
    );
    expect(next.provider.calls).toHaveLength(1);
    expect(next.provider.calls[0]?.system ?? "").not.toContain("Current search");
    expect(cardIds(answer)).toEqual([]);
  });
});

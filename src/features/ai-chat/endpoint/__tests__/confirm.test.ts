import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { inventedPhoneTurn, textTurn, toolCallTurn } from "@/server/ai";
import type { ConfirmCard } from "../../confirm/confirm-card";
import type { AiChatTool } from "../../tools/types";
import type { ChatDeps } from "../types";
import { handleAiChat } from "../handler";
import { chatRequest, createHarness, eventTypes, readEvents, say, SIGNED_IN } from "./harness";

// UT-ai-endpoint-confirm (ADR-128 D-ACTION, AI-P6-T02): the confirm card is streamed after the checked answer, built
// by the server for the caller of the request, and never when the answer was replaced. Everything here is made up.

const READY_CARD: ConfirmCard = {
  state: "ready",
  kind: "enquiry",
  proposal: "body.signature",
  target: { title: "3 BHK apartment", meta: "Velachery · ₹1.25 Cr" },
  name: "Priya Raman",
  phone: "+91 98400 12345",
  message: "Is this home still available?",
};

const proposeOutput = z.looseObject({ status: z.string(), proposal: z.string().optional() });

/** A stand-in propose tool that gives the output it is told to. */
function proposeTool(
  output: z.infer<typeof proposeOutput> & Record<string, unknown>,
): AiChatTool<unknown, z.infer<typeof proposeOutput>> {
  return {
    name: "propose_enquiry",
    kind: "propose",
    description: "A stand-in for the enquiry proposal.",
    input: z.object({}),
    output: proposeOutput,
    async run() {
      return { output, references: [] };
    },
  };
}

const PROPOSE_CALL = toolCallTurn([{ id: "call-1", name: "propose_enquiry", input: {} }]);
const ANSWER = textTurn("I have prepared an enquiry. Check it and press Send.");

function withCard(
  harness: ReturnType<typeof createHarness>,
  tool: AiChatTool<unknown, unknown>,
  confirmCard: NonNullable<ChatDeps["confirmCard"]>,
): ChatDeps {
  return { ...harness.deps, tools: [tool], confirmCard };
}

describe("UT-ai-endpoint-confirm: the card after the answer", () => {
  it("streams start, status, text, confirm and done, with the offer and the caller's session handed to the builder", async () => {
    const harness = createHarness({ script: [PROPOSE_CALL, ANSWER] });
    harness.session = SIGNED_IN;
    const build = vi.fn(async () => READY_CARD);
    const deps = withCard(
      harness,
      proposeTool({ status: "ready", proposal: "body.signature" }),
      build,
    );
    const events = await readEvents(await handleAiChat(chatRequest(say("enquire about it")), deps));

    expect(eventTypes(events)).toEqual(["start", "status", "text", "text", "confirm", "done"]);
    expect(events.find((event) => event.type === "confirm")).toEqual({
      type: "confirm",
      card: READY_CARD,
    });
    expect(build).toHaveBeenCalledExactlyOnceWith(
      { state: "ready", proposal: "body.signature" },
      SIGNED_IN,
    );
  });

  it("hands a visitor's sign-in offer to the builder with no session, and streams the sign-in card it makes", async () => {
    const harness = createHarness({ script: [PROPOSE_CALL, ANSWER] });
    const signedOut: ConfirmCard = {
      state: "signed_out",
      kind: "enquiry",
      target: READY_CARD.target,
      message: READY_CARD.message,
    };
    const build = vi.fn(async () => signedOut);
    const deps = withCard(
      harness,
      proposeTool({
        status: "sign_in_required",
        target: { homeId: "k3x9a2bd" },
        untrustedText: { message: "Is this home still available?" },
      } as never),
      build,
    );
    const events = await readEvents(await handleAiChat(chatRequest(say("enquire about it")), deps));
    expect(events.find((event) => event.type === "confirm")).toEqual({
      type: "confirm",
      card: signedOut,
    });
    expect(build).toHaveBeenCalledExactlyOnceWith(
      {
        state: "sign_in_required",
        kind: "enquiry",
        homeId: "k3x9a2bd",
        message: "Is this home still available?",
      },
      null,
    );
  });

  it("sends no card when the answer was replaced by the output check, and does not even build one", async () => {
    const harness = createHarness({ script: [PROPOSE_CALL, inventedPhoneTurn()] });
    harness.session = SIGNED_IN;
    const build = vi.fn(async () => READY_CARD);
    const deps = withCard(
      harness,
      proposeTool({ status: "ready", proposal: "body.signature" }),
      build,
    );
    const events = await readEvents(await handleAiChat(chatRequest(say("enquire about it")), deps));
    expect(eventTypes(events)).toContain("replace");
    expect(eventTypes(events)).not.toContain("confirm");
    expect(build).not.toHaveBeenCalled();
  });

  it("sends no card, and no error, when the builder gives none or fails: the answer's text stands alone", async () => {
    for (const build of [
      vi.fn(async () => null),
      vi.fn(async () => {
        throw new Error("the account could not be read");
      }),
    ]) {
      const harness = createHarness({ script: [PROPOSE_CALL, ANSWER] });
      harness.session = SIGNED_IN;
      const deps = withCard(
        harness,
        proposeTool({ status: "ready", proposal: "body.signature" }),
        build,
      );
      const events = await readEvents(
        await handleAiChat(chatRequest(say("enquire about it")), deps),
      );
      expect(eventTypes(events)).toEqual(["start", "status", "text", "text", "done"]);
      expect(events.at(-1)).toEqual({ type: "done", outcome: "answered" });
    }
  });

  it("builds no card for a message whose tools made no offer", async () => {
    const harness = createHarness({ script: [textTurn("Hello! Ask me about homes.")] });
    const build = vi.fn(async () => READY_CARD);
    const deps = withCard(harness, proposeTool({ status: "ready", proposal: "x.y" }), build);
    const events = await readEvents(await handleAiChat(chatRequest(say("hi there friend")), deps));
    expect(eventTypes(events)).not.toContain("confirm");
    expect(build).not.toHaveBeenCalled();
  });

  it("sends no card when the endpoint has no builder (the default of every other test)", async () => {
    const harness = createHarness({ script: [PROPOSE_CALL, ANSWER] });
    harness.session = SIGNED_IN;
    const without: ChatDeps = {
      ...harness.deps,
      tools: [proposeTool({ status: "ready", proposal: "body.signature" })],
    };
    const events = await readEvents(
      await handleAiChat(chatRequest(say("enquire about it")), without),
    );
    expect(eventTypes(events)).not.toContain("confirm");
  });
});

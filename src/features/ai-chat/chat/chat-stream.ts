import { z } from "zod";

/**
 * Reads what `POST /api/ai/chat` answers (`endpoint/events.ts` and `endpoint/responses.ts` are the other side). The
 * body is newline-delimited JSON, one event a line. Each line is checked: a line that is not an event of the closed
 * set is ignored, so a bad line never reaches the screen.
 */

const referenceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("home"), homeId: z.string(), slug: z.string() }),
  z.object({ kind: z.literal("project"), slug: z.string() }),
]);

const eventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("start"), requestId: z.string() }),
  z.object({ type: z.literal("status"), text: z.string() }),
  z.object({ type: z.literal("text"), text: z.string() }),
  z.object({ type: z.literal("card"), reference: referenceSchema }),
  z.object({ type: z.literal("notice"), key: z.string(), text: z.string() }),
  z.object({
    type: z.literal("replace"),
    key: z.string(),
    text: z.string(),
    href: z.string().optional(),
  }),
  z.object({ type: z.literal("done"), outcome: z.string() }),
]);

export type ChatEvent = z.infer<typeof eventSchema>;

function parseLine(line: string): ChatEvent | null {
  const trimmed = line.trim();
  if (trimmed === "") return null;
  let json: unknown;
  try {
    json = JSON.parse(trimmed);
  } catch {
    return null;
  }
  const parsed = eventSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}

/** The events of a streamed answer, in order. Ends when the body ends; the caller checks that `done` came. */
export async function* readChatEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<ChatEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      let newline = pending.indexOf("\n");
      while (newline !== -1) {
        const event = parseLine(pending.slice(0, newline));
        pending = pending.slice(newline + 1);
        if (event !== null) yield event;
        newline = pending.indexOf("\n");
      }
    }
    pending += decoder.decode();
    const last = parseLine(pending);
    if (last !== null) yield last;
  } finally {
    reader.releaseLock();
  }
}

/** The screens the chat can show when a message is refused before any stream starts. */
export type ChatFailure =
  | { readonly state: "sign_in_required" }
  | { readonly state: "too_many_messages"; readonly seconds: number }
  | { readonly state: "daily_limit" }
  | { readonly state: "unavailable" }
  | { readonly state: "error" };

const failureSchema = z.object({
  error: z.object({
    state: z
      .enum(["sign_in_required", "too_many_messages", "daily_limit", "unavailable", "error"])
      .optional(),
    retryAfter: z.number().optional(),
  }),
});

/**
 * Maps the endpoint's JSON failure to a screen: `sign_in_required` is the gate, `too_many_messages` the short wait
 * (with its seconds), `daily_limit` the "tomorrow" line, `unavailable` the budget of the whole day. Anything else,
 * including a body that is not the failure shape, is the error with Try again.
 */
export async function readChatFailure(response: Response): Promise<ChatFailure> {
  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return { state: "error" };
  }
  const parsed = failureSchema.safeParse(json);
  if (!parsed.success) return { state: "error" };
  const { state, retryAfter } = parsed.data.error;
  if (state === "too_many_messages") {
    return { state, seconds: Math.max(1, Math.ceil(retryAfter ?? 1)) };
  }
  if (state === "sign_in_required" || state === "daily_limit" || state === "unavailable") {
    return { state };
  }
  return { state: "error" };
}

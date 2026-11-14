/**
 * A mocked OpenAI over HTTP, for the adapter's tests and the conformance suite. The real `openai` package runs
 * unchanged; only its `fetch` is replaced, so the request it builds and the stream it parses are the real ones.
 * Nothing leaves the process and no key is needed: the key in these tests is a made-up string.
 *
 * The event shapes follow the Responses API stream (names and fields as in the package's own types), cut down
 * to the fields the adapter reads.
 */

/** The made-up key the tests give the adapter. It must never appear in anything the adapter returns. */
export const TEST_API_KEY = "sk-test-not-a-real-key-0000";
export const TEST_MODEL = "test-model-id";

type JsonObject = Record<string, unknown>;

// ---------------------------------------------------------------- stream events

export function textDelta(delta: string): JsonObject {
  return {
    type: "response.output_text.delta",
    delta,
    item_id: "msg_1",
    output_index: 0,
    content_index: 0,
  };
}

export function refusalDelta(delta: string): JsonObject {
  return {
    type: "response.refusal.delta",
    delta,
    item_id: "msg_1",
    output_index: 0,
    content_index: 0,
  };
}

/** The model finished writing one function call; `argumentsText` is the raw text of its arguments. */
export function functionCallDone(callId: string, name: string, argumentsText: string): JsonObject {
  return {
    type: "response.output_item.done",
    output_index: 0,
    item: {
      type: "function_call",
      id: `fc_${callId}`,
      call_id: callId,
      name,
      arguments: argumentsText,
      status: "completed",
    },
  };
}

interface UsageNumbers {
  input?: number;
  output?: number;
  /** Leave out to model a response that reports no cached-token detail. */
  cached?: number;
}

function usageObject(numbers: UsageNumbers): JsonObject {
  const input = numbers.input ?? 120;
  const output = numbers.output ?? 30;
  return {
    input_tokens: input,
    output_tokens: output,
    total_tokens: input + output,
    input_tokens_details: numbers.cached === undefined ? {} : { cached_tokens: numbers.cached },
    output_tokens_details: { reasoning_tokens: 0 },
  };
}

export function completed(numbers: UsageNumbers = {}): JsonObject {
  return {
    type: "response.completed",
    response: { id: "resp_1", status: "completed", output: [], usage: usageObject(numbers) },
  };
}

export function incomplete(reason: string, numbers: UsageNumbers = {}): JsonObject {
  return {
    type: "response.incomplete",
    response: {
      id: "resp_1",
      status: "incomplete",
      incomplete_details: { reason },
      output: [],
      usage: usageObject(numbers),
    },
  };
}

export function failed(code: string): JsonObject {
  return {
    type: "response.failed",
    response: {
      id: "resp_1",
      status: "failed",
      output: [],
      error: { code, message: "provider text" },
    },
  };
}

export function errorEvent(code: string): JsonObject {
  return { type: "error", code, message: "provider text", param: null };
}

/** A whole round of plain text: several deltas, then the closing event. */
export function textRound(text: string, numbers: UsageNumbers = {}): JsonObject[] {
  const chunks: JsonObject[] = [];
  for (let start = 0; start < text.length; start += 12) {
    chunks.push(textDelta(text.slice(start, start + 12)));
  }
  return [...chunks, completed(numbers)];
}

// ---------------------------------------------------------------- HTTP replies

const encoder = new TextEncoder();

function serverSentEvents(events: readonly JsonObject[]): string {
  const text = events
    .map((event) => `event: ${String(event.type)}\ndata: ${JSON.stringify(event)}\n\n`)
    .join("");
  return text;
}

/** A 200 reply that streams the events and then closes cleanly. */
export function streamReply(events: readonly JsonObject[]): Response {
  return new Response(serverSentEvents(events), {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

/** A 200 reply that streams the events and then breaks, as a dropped connection does. */
export function brokenStreamReply(events: readonly JsonObject[]): Response {
  let sent = false;
  const body = new ReadableStream<Uint8Array>({
    // The events go out first; the break comes on the next read, because an error discards what is still queued.
    pull(controller) {
      if (!sent) {
        sent = true;
        controller.enqueue(encoder.encode(serverSentEvents(events)));
        return;
      }
      controller.error(new TypeError("terminated"));
    },
  });
  return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
}

/** A 200 reply whose stream sends text that is not valid JSON inside an event. */
export function garbledStreamReply(): Response {
  return new Response(encoder.encode("event: response.output_text.delta\ndata: {not json\n\n"), {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

/** An error reply with the JSON body OpenAI sends. The message is deliberately unmistakable. */
export function errorReply(status: number, code: string | null): Response {
  return new Response(
    JSON.stringify({ error: { message: "PROVIDER-MESSAGE-MUST-NOT-LEAK", type: "x", code } }),
    { status, headers: { "content-type": "application/json" } },
  );
}

/** A reply that never comes: the request waits until it is aborted. */
export const HANGING_REPLY = "hang" as const;

/** A network failure before any reply (the connection is refused or reset). */
export const NETWORK_FAILURE = "network" as const;

export type MockReply = Response | typeof HANGING_REPLY | typeof NETWORK_FAILURE;

export interface RecordedRequest {
  readonly url: string;
  readonly headers: Headers;
  readonly body: JsonObject;
}

export interface MockOpenAi {
  readonly fetch: typeof fetch;
  readonly requests: readonly RecordedRequest[];
  /** How many scripted replies have not been used. */
  readonly remainingReplies: number;
}

/** A `fetch` that plays the replies in order and records what it was asked. A call past the end throws. */
export function createMockOpenAi(replies: readonly MockReply[]): MockOpenAi {
  const requests: RecordedRequest[] = [];
  let next = 0;

  const mockFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const reply = replies[next];
    next += 1;
    if (reply === undefined)
      throw new Error("The mocked OpenAI was called after its replies ran out");
    const rawBody = typeof init?.body === "string" ? init.body : "{}";
    requests.push({
      url: input instanceof Request ? input.url : String(input),
      headers: new Headers(init?.headers),
      body: JSON.parse(rawBody) as JsonObject,
    });
    if (reply === NETWORK_FAILURE) throw new TypeError("fetch failed");
    if (reply === HANGING_REPLY) {
      const signal = init?.signal;
      return new Promise<Response>((_resolve, reject) => {
        const abort = () => reject(new DOMException("The operation was aborted", "AbortError"));
        if (signal?.aborted) abort();
        else signal?.addEventListener("abort", abort, { once: true });
      });
    }
    return reply;
  };

  return {
    fetch: mockFetch as typeof fetch,
    requests,
    get remainingReplies() {
      return replies.length - next;
    },
  };
}

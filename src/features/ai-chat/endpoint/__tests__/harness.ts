import { z } from "zod";
import {
  createFakeAiProvider,
  type AiProvider,
  type FakeAiProvider,
  type FakeTurn,
} from "@/server/ai";
import type { SessionView } from "@/server/auth/session";
import {
  enforceRateLimit,
  type RateLimitCaller,
  type RateLimitCounter,
} from "@/server/rate-limit/enforce";
import { AI_CHAT_RATE_LIMIT_SCOPES } from "@/server/rate-limit/limits";
import type { AiChatTool } from "../../tools/types";
import { TOOL_CONTEXT } from "../../tools/__tests__/fixtures";
import type { ChatStreamEvent } from "../events";
import type { ChatDeps, ChatUsageRecord } from "../types";

// Shared by the endpoint tests. Every home, phone number and sentence here is made up (R-TEST-05).

const ORIGIN = "http://localhost:3000";
const ENDPOINT = `${ORIGIN}/api/ai/chat`;

/** The home and the contact number the stand-in tool returns: the only ones an answer may repeat. */
export const HOME_ID = "k3m9p2xw";
export const TOOL_CONTACT_PHONE = "+91 90000 54321";

const lookupInput = z.object({ id: z.string() });
const lookupOutput = z.object({
  homeId: z.string(),
  name: z.string(),
  contactPhone: z.string(),
});

/** A read tool that returns one made-up home and the contact number of its project. */
const lookupHomeTool: AiChatTool<z.infer<typeof lookupInput>, z.infer<typeof lookupOutput>> = {
  name: "lookup_home",
  kind: "read",
  description: "Looks up a made-up home, for the endpoint tests.",
  input: lookupInput,
  output: lookupOutput,
  async run() {
    return {
      output: { homeId: HOME_ID, name: "Test flat", contactPhone: TOOL_CONTACT_PHONE },
      references: [{ kind: "home", homeId: HOME_ID, slug: "test-flat" }],
    };
  },
};

/** The made-up visitor hash the stand-in gives every request. */
export const VISITOR_HASH = "visitor-hash-0123456789";

export const SIGNED_IN: SessionView = {
  userId: "user-1",
  roles: ["customer"],
  phoneVerified: true,
  builderId: null,
};

/**
 * An in-memory counter that applies the real limits (`RATE_LIMITS`) through the real `enforceRateLimit`, so the
 * trial really is 2 messages. `refuse` names the database scopes (by prefix) that always say no, to test one
 * limit at a time.
 */
function createCounter(refuse: readonly string[] = []) {
  const hits = new Map<string, number>();
  const counter: RateLimitCounter = {
    async hit(scope, subject, _windowSeconds, maxHits) {
      if (refuse.some((prefix) => scope.startsWith(prefix)))
        return { allowed: false, retryAfter: 45 };
      const key = `${scope}|${subject}`;
      const count = (hits.get(key) ?? 0) + 1;
      hits.set(key, count);
      return { allowed: count <= maxHits, retryAfter: 45 };
    },
  };
  return { counter, hits };
}

function callerFor(session: SessionView | null, cookie: string | null): RateLimitCaller {
  return {
    userId: session?.userId ?? null,
    visitor: () => "visitor-hash",
    ip: () => "ip-hash",
    network: () => "network-hash",
    global: () => "global-hash",
    cookie: () => cookie,
    hashKey: (key) => `hashed(${key})`,
  };
}

export interface Harness {
  readonly deps: ChatDeps;
  readonly provider: FakeAiProvider;
  readonly usage: ChatUsageRecord[];
  /** The work handed to `keepAlive`: the stream's loop, which includes writing the usage. */
  readonly kept: Promise<unknown>[];
  readonly scopesAsked: (readonly string[] | undefined)[];
  readonly enforce: { calls: number };
  session: SessionView | null;
  cookie: string | null;
  enabled: boolean;
}

export interface HarnessOptions {
  script?: readonly FakeTurn[];
  refuse?: readonly string[];
  timing?: { timeLimitMs: number; hardStopMs: number };
  createProvider?: () => AiProvider;
  recordUsage?: (record: ChatUsageRecord) => Promise<void>;
  visitorHash?: ChatDeps["visitorHash"];
  keepAlive?: ChatDeps["keepAlive"];
}

/** The endpoint's dependencies over the fake provider and the in-memory counter. */
export function createHarness(options: HarnessOptions = {}): Harness {
  const provider = createFakeAiProvider(options.script ?? []);
  const { counter } = createCounter(options.refuse);
  const usage: ChatUsageRecord[] = [];
  const kept: Promise<unknown>[] = [];
  const scopesAsked: (readonly string[] | undefined)[] = [];
  const enforce = { calls: 0 };
  const state = {
    session: null as SessionView | null,
    cookie: "cookie-a" as string | null,
    enabled: true,
  };

  const deps: ChatDeps = {
    isEnabled: () => state.enabled,
    getSession: async () => state.session,
    async enforceLimits({ scopes }) {
      enforce.calls += 1;
      scopesAsked.push(scopes);
      const caller = callerFor(state.session, state.session === null ? state.cookie : null);
      for (const scope of AI_CHAT_RATE_LIMIT_SCOPES) {
        if (scopes === undefined || scopes.includes(scope)) {
          await enforceRateLimit({ counter, scope, caller });
        }
      }
    },
    createProvider: options.createProvider ?? (() => provider),
    tools: [lookupHomeTool],
    translate: TOOL_CONTEXT.translate,
    recordUsage: options.recordUsage ?? (async (record) => void usage.push(record)),
    visitorHash: options.visitorHash ?? (() => VISITOR_HASH),
    keepAlive: options.keepAlive ?? ((work) => void kept.push(work)),
    timing: options.timing ?? { timeLimitMs: 10_000, hardStopMs: 20_000 },
  };
  return {
    deps,
    provider,
    usage,
    kept,
    scopesAsked,
    enforce,
    get session() {
      return state.session;
    },
    set session(value) {
      state.session = value;
    },
    get cookie() {
      return state.cookie;
    },
    set cookie(value) {
      state.cookie = value;
    },
    get enabled() {
      return state.enabled;
    },
    set enabled(value) {
      state.enabled = value;
    },
  };
}

export type Message = { role: string; text: string } | Record<string, unknown>;

/** A request as the browser sends it: JSON, from our own origin. */
export function chatRequest(
  messages: readonly Message[],
  init: { headers?: Record<string, string>; body?: string; signal?: AbortSignal } = {},
): Request {
  return new Request(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: ORIGIN,
      host: "localhost:3000",
      ...init.headers,
    },
    body: init.body ?? JSON.stringify({ messages }),
    ...(init.signal === undefined ? {} : { signal: init.signal }),
  });
}

export function say(text: string): Message[] {
  return [{ role: "user", text }];
}

/** Reads the whole NDJSON stream into events. */
export async function readEvents(response: Response): Promise<ChatStreamEvent[]> {
  const text = await response.text();
  return text
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line) as ChatStreamEvent);
}

export function eventTypes(events: readonly ChatStreamEvent[]): string[] {
  return events.map((event) => event.type);
}

/** The text a customer would read: every `text` event joined. */
export function textOf(events: readonly ChatStreamEvent[]): string {
  return events.flatMap((event) => (event.type === "text" ? [event.text] : [])).join("");
}

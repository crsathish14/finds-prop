import "server-only";
import { ActionError } from "../actions/normalise-error";
import { env } from "../env";
import { createFakeAiProvider, type FakeTurn } from "./fake";
import { createOpenAiProvider, type OpenAiProviderOptions } from "./openai";
import { AI_PROVIDER_NAMES, type AiProvider } from "./types";

/**
 * The one way features get a model provider (ADR-128 section 4.4, R-BE-09): they import from here and never
 * from an adapter. Everything below is re-exported so a feature needs no other import.
 */
export { aiFailureFromHttpStatus, aiFailureFromThrown, describeAiFailure } from "./errors";
export {
  createFakeAiProvider,
  cutOffTurn,
  failureTurn,
  FAKE_INVENTED_LINK,
  FAKE_INVENTED_PHONE,
  FAKE_INVENTED_PRICE,
  FAKE_PROMPT_CANARY,
  HANGING_TURN,
  inventedLinkTurn,
  inventedPhoneTurn,
  inventedPriceTurn,
  leakedCanaryTurn,
  refusalTurn,
  textTurn,
  toolCallTurn,
  truncatedTurn,
  type FakeAiProvider,
  type FakeToolCall,
  type FakeTurn,
} from "./fake";
export { buildOpenAiRequest, createOpenAiProvider, type OpenAiProviderOptions } from "./openai";
export {
  createAiToolDefinition,
  findPortableSchemaViolations,
  PortableSchemaError,
  toPortableJsonSchema,
} from "./portable-schema";
export { AI_ERROR_KINDS, AI_PROVIDER_NAMES } from "./types";
export type {
  AiCall,
  AiErrorKind,
  AiEvent,
  AiFailure,
  AiMessage,
  AiProvider,
  AiProviderName,
  AiStop,
  AiToolCall,
  AiToolDefinition,
  AiToolSchema,
  AiUsage,
} from "./types";

export interface AiProviderOptions {
  /** The scripted rounds, for the fake. Ignored by a real provider. */
  script?: readonly FakeTurn[];
  /**
   * Settings for the OpenAI adapter. Each one defaults to `src/server/env.ts` (`OPENAI_API_KEY`, `AI_MODEL`);
   * tests pass `fetch` to mock the HTTP so no network or real key is used.
   */
  openai?: Partial<OpenAiProviderOptions>;
}

/**
 * The provider for a name: `fake` or `openai`. The name is given by the caller, who reads `AI_PROVIDER` from
 * `src/server/env.ts`. An unknown or not-yet-wired name, or OpenAI without its key or model, refuses (fail
 * closed) and never falls back to the fake. The message names the missing variable, never a value.
 */
export function chooseAiProvider(name: string, options: AiProviderOptions = {}): AiProvider {
  if (name === "fake") return createFakeAiProvider(options.script);
  if (name === "openai") {
    const apiKey = options.openai?.apiKey ?? env.OPENAI_API_KEY;
    const model = options.openai?.model ?? env.AI_MODEL;
    if (apiKey === undefined || apiKey === "") {
      throw new ActionError("INTERNAL", "OPENAI_API_KEY is not set");
    }
    if (model === undefined || model === "")
      throw new ActionError("INTERNAL", "AI_MODEL is not set");
    return createOpenAiProvider({ ...options.openai, apiKey, model });
  }
  const known = (AI_PROVIDER_NAMES as readonly string[]).includes(name);
  throw new ActionError(
    "INTERNAL",
    known ? `The AI provider "${name}" is not wired yet` : `Unknown AI provider "${name}"`,
  );
}

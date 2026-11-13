import "server-only";
import { ActionError } from "../actions/normalise-error";
import { createFakeAiProvider, type FakeTurn } from "./fake";
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
}

/**
 * The provider for a name. Only the fake is wired for now: the OpenAI adapter comes with its package and
 * its environment variables (P1-T01, P1-T03), and each later provider is one more branch here. The name is
 * given by the caller because no `AI_PROVIDER` variable exists yet; when it does, the caller reads it from
 * `src/server/env.ts`. An unknown or not-yet-wired name refuses (fail closed) and never falls back to the fake.
 */
export function chooseAiProvider(name: string, options: AiProviderOptions = {}): AiProvider {
  if (name === "fake") return createFakeAiProvider(options.script);
  const known = (AI_PROVIDER_NAMES as readonly string[]).includes(name);
  throw new ActionError(
    "INTERNAL",
    known ? `The AI provider "${name}" is not wired yet` : `Unknown AI provider "${name}"`,
  );
}

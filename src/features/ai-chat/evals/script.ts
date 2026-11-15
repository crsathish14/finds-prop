/**
 * Turns a case's `script` (plain JSON, what the fake model does round by round) into the fake provider's turns
 * (AI-P8-T01). A tool call in a script may leave out the filters it does not use: they are filled with `null`, which
 * is what "not asked for" means to every tool (ADR-128 section 4.4, rule 1), so a script reads like a customer's
 * question and not like a form.
 *
 * Three markers may stand in a script's text and in the text values of its tool calls, so that the data holds no
 * private marker and no date that goes stale:
 * - `{{canary}}` is the real canary of the system prompt, `{{prompt-copy}}` a run of words copied from it (a case that
 *   makes the model leak its prompt);
 * - `{{day+N}}` is the day N days after today in India, written YYYY-MM-DD (a visit day must be from today to a year
 *   ahead, so a fixed date would one day be wrong). The clock is given, so a test can fix it (R-TEST-03).
 */
import {
  failureTurn,
  refusalTurn,
  textTurn,
  toolCallTurn,
  type FakeToolCall,
  type FakeTurn,
} from "@/server/ai";
import { ROLE_SECTION } from "../prompts/sections";
import { SYSTEM_PROMPT_CANARY } from "../prompts/version";
import type { AnyAiChatTool } from "../tools/types";
import type { ScriptRound } from "./case-schema";

/** Words copied from the real system prompt, more than `AI_PROMPT_COPY_RUN_WORDS` of them, so they count as a copy. */
const PROMPT_COPY = ROLE_SECTION.split(/\s+/u).slice(0, 14).join(" ");

const DAY_MARKER = /\{\{day\+(\d{1,3})\}\}/gu;

/** The day `offset` days after `now`, in India time, as YYYY-MM-DD. */
export function indiaDayAfter(now: Date, offset: number): string {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const moved = new Date(`${today}T00:00:00Z`);
  moved.setUTCDate(moved.getUTCDate() + offset);
  return moved.toISOString().slice(0, 10);
}

function withMarkers(text: string, now: Date): string {
  return text
    .replaceAll("{{canary}}", SYSTEM_PROMPT_CANARY)
    .replaceAll("{{prompt-copy}}", PROMPT_COPY)
    .replace(DAY_MARKER, (_marker, offset: string) => indiaDayAfter(now, Number(offset)));
}

function markersInValue(value: unknown, now: Date): unknown {
  if (typeof value === "string") return withMarkers(value, now);
  if (Array.isArray(value)) return value.map((item) => markersInValue(item, now));
  if (typeof value === "object" && value !== null)
    return Object.fromEntries(
      Object.entries(value).map(([field, item]) => [field, markersInValue(item, now)]),
    );
  return value;
}

function withNulls(tool: AnyAiChatTool | undefined, input: Record<string, unknown>) {
  const shape = (tool?.input as { shape?: Record<string, unknown> } | undefined)?.shape;
  if (shape === undefined) return input;
  const completed: Record<string, unknown> = { ...input };
  for (const field of Object.keys(shape)) if (!(field in completed)) completed[field] = null;
  return completed;
}

export function compileScript(
  script: readonly ScriptRound[],
  tools: readonly AnyAiChatTool[],
  now: Date = new Date(),
): FakeTurn[] {
  let callNumber = 0;
  return script.map((round): FakeTurn => {
    if ("calls" in round) {
      const calls = round.calls.map((call): FakeToolCall => {
        callNumber += 1;
        return {
          id: `call-${callNumber}`,
          name: call.name,
          input: markersInValue(
            withNulls(
              tools.find((tool) => tool.name === call.name),
              call.input,
            ),
            now,
          ),
        };
      });
      return toolCallTurn(
        calls,
        round.text === undefined ? {} : { text: withMarkers(round.text, now) },
      );
    }
    if ("refusal" in round) return refusalTurn();
    if ("failure" in round) return failureTurn(round.failure);
    return textTurn(withMarkers(round.text, now));
  });
}

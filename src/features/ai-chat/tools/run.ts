import "server-only";
import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";
import { createAiToolDefinition, type AiToolDefinition } from "@/server/ai";
import { logger } from "@/server/logger";
import {
  TOOL_ERROR_HINTS,
  type AnyAiChatTool,
  type ToolContext,
  type ToolErrorCode,
  type ToolOutcome,
} from "./types";

/**
 * The one way a tool is run (ADR-128 sections 4.4 rule 2, 4.5 and 5). The agent loop hands over what the
 * model asked for and always gets a result back, never an exception: an unknown name, an input that does not
 * fit, a read that fails and a result that does not fit its own schema each become an error result the model
 * can act on. Caps, timeouts and parallel calls are the loop's; this file knows nothing about them.
 */

/** What the provider is told about each tool. Throws `PortableSchemaError` for a schema outside the subset. */
export function toolDefinitions(tools: readonly AnyAiChatTool[]): AiToolDefinition[] {
  return tools.map((tool) => createAiToolDefinition(tool));
}

/**
 * An error result: a code and, for an input that did not fit, the fields to correct. The loop's own refusals
 * carry a short hint for the model as well (`TOOL_ERROR_HINTS`). Never a database message.
 */
export function toolError(code: ToolErrorCode, fields: readonly string[] = []): ToolOutcome {
  const hint = TOOL_ERROR_HINTS[code];
  return {
    status: "error",
    code,
    fields,
    content: JSON.stringify({
      error: code,
      ...(fields.length > 0 ? { fields } : {}),
      ...(hint === undefined ? {} : { hint }),
    }),
  };
}

/** The fields that did not fit, each once, as the model wrote them (`minPrice`, `filters.bhk`). */
function fieldsOf(error: z.ZodError): string[] {
  const fields = new Set<string>();
  for (const issue of error.issues) {
    const field = issue.path.map(String).join(".");
    if (field !== "") fields.add(field);
  }
  return [...fields];
}

/**
 * Runs one call. In order: find the tool, check the input with the tool's Zod schema (whatever the provider
 * promised), run it, check the result with the tool's output schema. Only what the output schema names goes
 * back to the model: a field a read grows later does not reach it unless the tool's schema is changed too.
 * A failure is logged by the tool's name only, never with the input, which can hold what a customer typed.
 */
export async function runTool(
  tools: readonly AnyAiChatTool[],
  call: { readonly name: string; readonly input: unknown },
  context: ToolContext,
): Promise<ToolOutcome> {
  const tool = tools.find((candidate) => candidate.name === call.name);
  if (tool === undefined) return toolError("unknown_tool");
  const input = tool.input.safeParse(call.input);
  if (!input.success) return toolError("invalid_input", fieldsOf(input.error));
  try {
    const run = await tool.run(input.data, context);
    const output = tool.output.safeParse(run.output);
    if (!output.success) {
      logger.error("ai tool result does not fit its schema", { tool: tool.name });
      return toolError("unavailable");
    }
    return {
      status: "ok",
      output: output.data,
      references: run.references,
      content: JSON.stringify(output.data),
    };
  } catch (error) {
    // The prerender signal and redirects are Next.js control flow, not failures of the tool.
    unstable_rethrow(error);
    logger.error("ai tool could not run", { tool: tool.name });
    return toolError("unavailable");
  }
}

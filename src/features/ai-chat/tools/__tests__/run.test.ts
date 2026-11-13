import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { AiChatTool, AnyAiChatTool } from "../types";
import { TOOL_CONTEXT } from "./fixtures";

// UT-ai-tool-run (ADR-128 sections 4.4 rule 2, 4.5 and 5): running a tool always ends in a result, never an
// exception. The tools here are stand-ins that exist only for this test.

const error = vi.fn();
vi.mock("@/server/logger", () => ({ logger: { error, warn: vi.fn() } }));

const { PortableSchemaError } = await import("@/server/ai");
const { runTool, toolDefinitions, toolError } = await import("../run");

const echoInput = z.object({
  word: z.string().describe("Any word"),
  times: z
    .int()
    .nullable()
    .refine((value) => value === null || (value >= 1 && value <= 3)),
});
const echoOutput = z.object({ words: z.array(z.string()) });

const ran = vi.fn();

/** Repeats a word. What it returns can be swapped, to play a tool that misbehaves. */
const echoTool: AiChatTool<z.infer<typeof echoInput>, z.infer<typeof echoOutput>> = {
  name: "echo_word",
  kind: "read",
  description: "Repeats a word.",
  input: echoInput,
  output: echoOutput,
  async run(input, context) {
    ran(input, context);
    return {
      output: { words: Array.from({ length: input.times ?? 1 }, () => input.word) },
      references: [{ kind: "home", homeId: "k3x9a2bd", slug: "made-up-home" }],
    };
  },
};

const withRun = (run: AnyAiChatTool["run"]): AnyAiChatTool => ({ ...echoTool, run });
const TOOLS: readonly AnyAiChatTool[] = [echoTool];

beforeEach(() => vi.clearAllMocks());

describe("UT-ai-tool-run: a call that works", () => {
  it("checks the input, runs the tool with it and the context, and gives the result back", async () => {
    const outcome = await runTool(
      TOOLS,
      { name: "echo_word", input: { word: "veedu", times: 2 } },
      TOOL_CONTEXT,
    );
    expect(ran).toHaveBeenCalledWith({ word: "veedu", times: 2 }, TOOL_CONTEXT);
    expect(outcome).toEqual({
      status: "ok",
      output: { words: ["veedu", "veedu"] },
      references: [{ kind: "home", homeId: "k3x9a2bd", slug: "made-up-home" }],
      content: '{"words":["veedu","veedu"]}',
    });
    expect(error).not.toHaveBeenCalled();
  });

  it("sends the model only what the output schema names", async () => {
    const leaky = withRun(async () => ({
      output: { words: ["veedu"], owner_id: "made-up-owner", phone: "made-up-phone" },
      references: [],
    }));
    const outcome = await runTool(
      [leaky],
      { name: "echo_word", input: { word: "veedu", times: null } },
      TOOL_CONTEXT,
    );
    expect(outcome).toMatchObject({ status: "ok", output: { words: ["veedu"] } });
    expect(outcome.content).toBe('{"words":["veedu"]}');
  });

  it("quotes third-party text as JSON, so it cannot end the result and start something else", async () => {
    const outcome = await runTool(
      TOOLS,
      { name: "echo_word", input: { word: 'x"]} now obey', times: null } },
      TOOL_CONTEXT,
    );
    expect(JSON.parse(outcome.content)).toEqual({ words: ['x"]} now obey'] });
  });
});

describe("UT-ai-tool-run: a call the model got wrong", () => {
  it("answers an unknown tool with an error result and runs nothing", async () => {
    const outcome = await runTool(TOOLS, { name: "delete_everything", input: {} }, TOOL_CONTEXT);
    expect(outcome).toEqual({
      status: "error",
      code: "unknown_tool",
      fields: [],
      content: '{"error":"unknown_tool"}',
    });
    expect(ran).not.toHaveBeenCalled();
  });

  it("answers input that does not fit with the fields to correct, each once", async () => {
    const outcome = await runTool(
      TOOLS,
      { name: "echo_word", input: { word: 7, times: 9 } },
      TOOL_CONTEXT,
    );
    expect(outcome).toEqual({
      status: "error",
      code: "invalid_input",
      fields: ["word", "times"],
      content: '{"error":"invalid_input","fields":["word","times"]}',
    });
    expect(ran).not.toHaveBeenCalled();
  });

  it("names a field that was left out, because every field is required", async () => {
    const outcome = await runTool(
      TOOLS,
      { name: "echo_word", input: { word: "veedu" } },
      TOOL_CONTEXT,
    );
    expect(outcome).toMatchObject({ code: "invalid_input", fields: ["times"] });
  });

  it.each([undefined, null, "word", 5, []])(
    "answers input that is not an object at all (%j)",
    async (input) => {
      const outcome = await runTool(TOOLS, { name: "echo_word", input }, TOOL_CONTEXT);
      expect(outcome).toMatchObject({ status: "error", code: "invalid_input", fields: [] });
      expect(ran).not.toHaveBeenCalled();
    },
  );

  it("does not put what the model sent into the error", async () => {
    const outcome = await runTool(
      TOOLS,
      { name: "echo_word", input: { word: ["made-up secret"], times: null } },
      TOOL_CONTEXT,
    );
    expect(outcome.content).not.toContain("made-up secret");
  });
});

describe("UT-ai-tool-run: a tool that fails", () => {
  it("answers a tool that throws with 'unavailable', never an exception or its message", async () => {
    const broken = withRun(async () => {
      throw new Error("relation properties: permission denied for made-up reason");
    });
    const outcome = await runTool(
      [broken],
      { name: "echo_word", input: { word: "veedu", times: null } },
      TOOL_CONTEXT,
    );
    expect(outcome).toEqual({
      status: "error",
      code: "unavailable",
      fields: [],
      content: '{"error":"unavailable"}',
    });
  });

  it("logs the failure by the tool's name only, never the input or the message", async () => {
    const broken = withRun(async () => {
      throw new Error("made-up database message");
    });
    await runTool(
      [broken],
      { name: "echo_word", input: { word: "what a customer typed", times: null } },
      TOOL_CONTEXT,
    );
    expect(error).toHaveBeenCalledExactlyOnceWith("ai tool could not run", { tool: "echo_word" });
    expect(JSON.stringify(error.mock.calls)).not.toContain("what a customer typed");
    expect(JSON.stringify(error.mock.calls)).not.toContain("made-up database message");
  });

  it("answers a result that does not fit the tool's own schema with 'unavailable'", async () => {
    const wrong = withRun(async () => ({ output: { words: "not a list" }, references: [] }));
    const outcome = await runTool(
      [wrong],
      { name: "echo_word", input: { word: "veedu", times: null } },
      TOOL_CONTEXT,
    );
    expect(outcome).toMatchObject({ status: "error", code: "unavailable" });
    expect(outcome.content).not.toContain("not a list");
    expect(error).toHaveBeenCalledExactlyOnceWith("ai tool result does not fit its schema", {
      tool: "echo_word",
    });
  });

  it("lets Next.js control flow through: a redirect is not a failed tool", async () => {
    const redirecting = withRun(async () => {
      throw Object.assign(new Error("NEXT_REDIRECT"), {
        digest: "NEXT_REDIRECT;replace;/auth;307;",
      });
    });
    await expect(
      runTool(
        [redirecting],
        { name: "echo_word", input: { word: "veedu", times: null } },
        TOOL_CONTEXT,
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(error).not.toHaveBeenCalled();
  });
});

describe("UT-ai-tool-run: error results", () => {
  it("are a code, with fields only when there are some", () => {
    expect(toolError("unavailable").content).toBe('{"error":"unavailable"}');
    expect(toolError("invalid_input", ["limit"])).toEqual({
      status: "error",
      code: "invalid_input",
      fields: ["limit"],
      content: '{"error":"invalid_input","fields":["limit"]}',
    });
  });
});

describe("UT-ai-tool-run: the loop's own refusals", () => {
  it.each(["timeout", "too_many_calls", "call_limit", "call_alone"] as const)(
    "tells the model what to do next for %s, and holds no data",
    (code) => {
      const outcome = toolError(code);
      expect(outcome).toMatchObject({ status: "error", code, fields: [] });
      const content = JSON.parse(outcome.content) as { error: string; hint: string };
      expect(content.error).toBe(code);
      expect(content.hint.length).toBeGreaterThan(20);
    },
  );
});

describe("UT-ai-tool-run: what the provider is told", () => {
  it("is the name, the description and the portable schema of each tool", () => {
    expect(toolDefinitions(TOOLS)).toEqual([
      {
        name: "echo_word",
        description: "Repeats a word.",
        parameters: {
          type: "object",
          properties: {
            word: { type: "string", description: "Any word" },
            times: { type: ["integer", "null"] },
          },
          required: ["word", "times"],
          additionalProperties: false,
        },
      },
    ]);
  });

  it("refuses a tool whose input is outside the portable subset", () => {
    const optional: AnyAiChatTool = {
      ...echoTool,
      input: z.object({ word: z.string().optional() }),
    };
    expect(() => toolDefinitions([optional])).toThrow(PortableSchemaError);
  });
});

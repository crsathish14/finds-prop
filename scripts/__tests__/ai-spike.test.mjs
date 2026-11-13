// Offline tests for the provider spike (scripts/ai-spike/run.mts, task AI-P0-T02). Nothing here
// touches the network: every request goes to a mocked fetch, and the keys are made-up fixtures.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  ASSISTANT_BRAND_NAME,
  PROMPT_CANARY,
  buildGeminiRequest,
  buildOpenAiRequest,
  buildSystemPrompt,
  computeEmiResult,
  costInDollars,
  createAdapter,
  evaluateChecks,
  extractContacts,
  findRealisticContacts,
  findSubsetViolations,
  isInsideDirectory,
  main,
  parseArguments,
  parseGeminiReply,
  parseOpenAiReply,
  parseSuite,
  postJson,
  readConfig,
  redactRequest,
  runStubTool,
  runTurn,
  scriptMatches,
  scrubSecrets,
  tamilShare,
  toOpenApiSchema,
  validateArguments,
  validateBaseUrl,
  validateSuite,
} from "../ai-spike/run.mts";

const REPOSITORY_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const readJson = (name) =>
  JSON.parse(fs.readFileSync(new URL(`../ai-spike/${name}`, import.meta.url), "utf8"));
const loadRealSuite = () => {
  const built = parseSuite(readJson("tools.json"), readJson("prompts.json"));
  expect(built.problems).toEqual([]);
  return built.suite;
};

// Obviously fake: low entropy, no provider prefix.
const OPENAI_KEY = "fixture-openai-credential-aaaaaaaa";
const GEMINI_KEY = "fixture-gemini-credential-bbbbbbbb";
const ENVIRONMENT = {
  AI_SPIKE_OPENAI_API_KEY: OPENAI_KEY,
  AI_SPIKE_OPENAI_MODEL: "model-openai-1",
  AI_SPIKE_OPENAI_PRICE_INPUT: "1",
  AI_SPIKE_OPENAI_PRICE_OUTPUT: "4",
  AI_SPIKE_GEMINI_API_KEY: GEMINI_KEY,
  AI_SPIKE_GEMINI_MODEL: "model-gemini-1",
  AI_SPIKE_GEMINI_PRICE_INPUT: "0.5",
  AI_SPIKE_GEMINI_PRICE_OUTPUT: "2",
};

const jsonResponse = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers });

function makeServices(overrides = {}) {
  const printed = [];
  const errors = [];
  const written = new Map();
  let clock = 0;
  const services = {
    fetchFunction: vi.fn(async () => {
      throw new Error("fetch must not be called in this test");
    }),
    print: (line) => printed.push(line),
    printError: (line) => errors.push(line),
    now: () => {
      clock += 100;
      return clock;
    },
    isoNow: () => "2026-11-12T10:00:00.000Z",
    sleep: vi.fn(async () => {}),
    writeTextFile: (filePath, content) => written.set(filePath, content),
    loadSuite: () => ({ tools: readJson("tools.json"), prompts: readJson("prompts.json") }),
    repositoryRoot: REPOSITORY_ROOT,
    defaultOutputRoot: path.join(os.tmpdir(), "findsprop-ai-spike-tests"),
    nodeVersion: "v24.0.0",
    ...overrides,
  };
  return { services, printed, errors, written };
}

// Responses shaped like the documented ones (OpenAI Responses API, Gemini generateContent).
const openAiUsage = {
  input_tokens: 1000,
  input_tokens_details: { cached_tokens: 200 },
  output_tokens: 50,
  output_tokens_details: { reasoning_tokens: 20 },
};
const openAiCalls = (...calls) => ({
  status: "completed",
  output: [
    { type: "reasoning", id: "rs_1", summary: [] },
    ...calls.map((call, position) => ({
      type: "function_call",
      id: `fc_${position}`,
      call_id: `call_${position}`,
      name: call.name,
      arguments:
        typeof call.arguments === "string" ? call.arguments : JSON.stringify(call.arguments),
    })),
  ],
  usage: openAiUsage,
});
const openAiText = (text) => ({
  status: "completed",
  output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text }] }],
  usage: openAiUsage,
});
const geminiUsage = {
  promptTokenCount: 900,
  candidatesTokenCount: 30,
  thoughtsTokenCount: 10,
  cachedContentTokenCount: 100,
};
const geminiCalls = (...calls) => ({
  candidates: [
    {
      content: {
        role: "model",
        parts: calls.map((call) => ({ functionCall: { name: call.name, args: call.args } })),
      },
      finishReason: "STOP",
    },
  ],
  usageMetadata: geminiUsage,
});
const geminiText = (text, finishReason = "STOP") => ({
  candidates: [{ content: { role: "model", parts: [{ text }] }, finishReason }],
  usageMetadata: geminiUsage,
});

const searchInput = {
  listingType: "sale",
  propertyType: null,
  bhk: 3,
  minPriceRupees: null,
  maxPriceRupees: 8000000,
  locality: "Velachery",
  keyword: null,
  label: null,
  sort: null,
  limit: null,
};

function openAiContext(overrides = {}) {
  const suite = loadRealSuite();
  const { services } = makeServices(overrides.services);
  return {
    suite,
    services,
    adapter: createAdapter({
      provider: "openai",
      apiKey: OPENAI_KEY,
      model: "model-openai-1",
      baseUrl: "https://api.openai.com",
      prices: { input: 1, output: 4, cachedInput: 0.25 },
    }),
    state: { spendUsd: 0, maxCostUsd: 100, aborted: false },
    secrets: [OPENAI_KEY],
    system: buildSystemPrompt(),
    maxOutputTokens: 4000,
    timeoutMs: 5000,
  };
}

const promptById = (suite, id) => suite.prompts.find((prompt) => prompt.id === id);

describe("the data files", () => {
  it("parse and pass every rule --dry-run checks", () => {
    const suite = loadRealSuite();
    expect(validateSuite(suite)).toEqual([]);
    expect(suite.prompts.length).toBeGreaterThanOrEqual(30);
    expect(suite.prompts.length).toBeLessThanOrEqual(40);
    expect(suite.tools).toHaveLength(10);
    expect(suite.tools.filter((tool) => tool.kind === "propose")).toHaveLength(2);
  });

  it("cover English, Tamil and Tanglish and every group of the plan", () => {
    const suite = loadRealSuite();
    const languages = new Set(suite.prompts.map((prompt) => prompt.language));
    expect([...languages].sort()).toEqual(["en", "ta", "tanglish"]);
    const groups = new Set(suite.prompts.map((prompt) => prompt.group));
    for (const group of [
      "search",
      "compare",
      "builder",
      "emi",
      "refusal",
      "injection",
      "unknown",
      "parallel",
    ]) {
      expect(groups.has(group)).toBe(true);
    }
  });

  it("keep every stubbed tool schema inside the portable subset", () => {
    for (const tool of loadRealSuite().tools) {
      expect(findSubsetViolations(tool.parameters), tool.name).toEqual([]);
    }
  });

  it("are refused when a prompt carries a real-looking phone number", () => {
    const suite = loadRealSuite();
    suite.prompts[0] = { ...suite.prompts[0], text: "Call me on 98765 43210 please" };
    expect(validateSuite(suite).join(" ")).toContain("98765 43210");
  });

  it("are refused when a check names a tool that does not exist", () => {
    const suite = loadRealSuite();
    suite.prompts[0] = {
      ...suite.prompts[0],
      checks: [{ type: "calls", tools: ["no_such_tool"] }],
    };
    expect(validateSuite(suite).join(" ")).toContain("no_such_tool");
  });

  it("are refused when there are too few prompts", () => {
    const suite = loadRealSuite();
    suite.prompts = suite.prompts.slice(0, 5);
    expect(validateSuite(suite).join(" ")).toContain("30 to 40 prompts");
  });

  it("report a bad check as a problem instead of crashing", () => {
    const built = parseSuite(readJson("tools.json"), {
      prompts: [
        {
          id: "x1",
          text: "hi",
          language: "en",
          checks: [{ type: "mustNotMatch", pattern: "(", label: "bad" }],
        },
      ],
    });
    expect(built.suite).toBeNull();
    expect(built.problems.join(" ")).toContain("not valid");
  });

  it("use fictional contacts only", () => {
    expect(
      findRealisticContacts(
        "+91 90000 00101 and ops@anbu.example.test and https://anbu.example.test",
      ),
    ).toEqual([]);
    expect(findRealisticContacts("call 9841122334")).toHaveLength(1);
    expect(findRealisticContacts("mail a@gmail.com")).toHaveLength(1);
    expect(findRealisticContacts("see https://real-builder.com/x")).toHaveLength(1);
    expect(findRealisticContacts("listed on 2026-11-12 for 4800000")).toEqual([]);
  });
});

describe("the portable schema subset (ADR 4.4 rule 1)", () => {
  const object = (properties, extra = {}) => ({
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
    ...extra,
  });

  it("accepts nullable fields, enums, arrays and nested objects", () => {
    const schema = object({
      name: { type: "string" },
      count: { type: ["integer", "null"] },
      kind: { type: ["string", "null"], enum: ["a", "b", null] },
      tags: { type: "array", items: { type: "string" } },
      inner: object({ flag: { type: "boolean" } }),
    });
    expect(findSubsetViolations(schema)).toEqual([]);
  });

  it.each([
    [
      "an optional field",
      { ...object({ first: { type: "string" }, second: { type: "string" } }), required: ["first"] },
      "required",
    ],
    [
      "open additionalProperties",
      { type: "object", properties: { first: { type: "string" } }, required: ["first"] },
      "additionalProperties",
    ],
    ["anyOf", object({ first: { anyOf: [{ type: "string" }] } }), "anyOf"],
    ["oneOf", object({ first: { oneOf: [{ type: "string" }] } }), "oneOf"],
    [
      "a reference",
      object({ first: { $ref: "#/$defs/thing" } }, { $defs: { thing: { type: "string" } } }),
      "$ref",
    ],
    ["a format keyword", object({ first: { type: "string", format: "date" } }), "format"],
    ["a minimum", object({ first: { type: "integer", minimum: 1 } }), "minimum"],
    [
      "a nullable enum without null",
      object({ first: { type: ["string", "null"], enum: ["thing"] } }),
      "nullable enum",
    ],
    [
      "a nullable root",
      { ...object({ first: { type: "string" } }), type: ["object", "null"] },
      "root",
    ],
    ["a union of types", object({ first: { type: ["string", "integer"] } }), "type"],
    ["an array without items", object({ first: { type: "array" } }), "items"],
  ])("rejects %s", (_label, schema, expected) => {
    expect(findSubsetViolations(schema).join(" ")).toContain(expected);
  });
});

describe("argument validation (ADR 4.4 rule 2)", () => {
  const search = loadRealSuite().tools.find((tool) => tool.name === "search_properties").parameters;

  it("accepts a complete call", () => {
    expect(validateArguments(search, searchInput)).toEqual([]);
  });

  it("explains what is wrong", () => {
    expect(validateArguments(search, { ...searchInput, bhk: "3" }).join(" ")).toContain(
      "expected an integer",
    );
    expect(validateArguments(search, { ...searchInput, sort: "cheapest" }).join(" ")).toContain(
      "allowed values",
    );
    expect(validateArguments(search, { ...searchInput, extra: 1 }).join(" ")).toContain(
      "unexpected field",
    );
    const missing = Object.fromEntries(
      Object.entries(searchInput).filter(([key]) => key !== "limit"),
    );
    expect(validateArguments(search, missing).join(" ")).toContain("limit: missing");
    expect(validateArguments(search, "text").join(" ")).toContain("expected an object");
  });

  it("rejects null where null is not allowed", () => {
    const compare = loadRealSuite().tools.find(
      (tool) => tool.name === "compare_properties",
    ).parameters;
    expect(validateArguments(compare, { shortIds: null }).join(" ")).toContain(
      "null is not allowed",
    );
    expect(validateArguments(compare, { shortIds: ["a", 2] }).join(" ")).toContain(
      "expected a string",
    );
  });
});

describe("Gemini's older schema form", () => {
  it("converts nullable types, drops additionalProperties and removes null from enums", () => {
    const converted = toOpenApiSchema({
      type: "object",
      properties: {
        sort: { type: ["string", "null"], enum: ["a", null] },
        list: { type: "array", items: { type: "integer" } },
      },
      required: ["sort", "list"],
      additionalProperties: false,
    });
    expect(converted).toEqual({
      type: "OBJECT",
      properties: {
        sort: { type: "STRING", nullable: true, enum: ["a"] },
        list: { type: "ARRAY", items: { type: "INTEGER" } },
      },
      required: ["sort", "list"],
    });
  });
});

describe("cost", () => {
  it("prices cached input separately and falls back to the input price", () => {
    const usage = {
      inputTokens: 1_000_000,
      outputTokens: 500_000,
      cachedInputTokens: 400_000,
      reasoningTokens: 100_000,
    };
    expect(costInDollars(usage, { input: 2, output: 8, cachedInput: 0.5 })).toBeCloseTo(
      1.2 + 0.2 + 4,
      6,
    );
    expect(costInDollars(usage, { input: 2, output: 8, cachedInput: null })).toBeCloseTo(2 + 4, 6);
  });
});

describe("secrets", () => {
  it("scrubs key values, bearer headers and key-shaped fragments", () => {
    const shaped = ["sk", "proj", "abcdefghijkl"].join("-");
    const text = `bad key ${OPENAI_KEY}; Authorization: Bearer abc.def; got ${shaped}**** and AIza${"b".repeat(20)}`;
    const cleaned = scrubSecrets(text, [OPENAI_KEY]);
    expect(cleaned).not.toContain(OPENAI_KEY);
    expect(cleaned).not.toContain("abc.def");
    expect(cleaned).not.toContain(shaped);
    expect(cleaned).not.toContain("AIzabbbb");
    expect(cleaned).toContain("<redacted>");
  });

  it("hides the key in a printed request", () => {
    const adapter = createAdapter({
      provider: "openai",
      apiKey: OPENAI_KEY,
      model: "m",
      baseUrl: "https://api.openai.com",
      prices: { input: 1, output: 1, cachedInput: null },
    });
    const request = adapter.buildRequest({
      system: "s",
      messages: [{ role: "user", text: "hi" }],
      tools: [],
      toolMode: "auto",
      parallelCalls: true,
      maxOutputTokens: 100,
    });
    expect(JSON.stringify(redactRequest(request))).not.toContain(OPENAI_KEY);
    expect(JSON.stringify(request.body)).not.toContain(OPENAI_KEY);
  });
});

describe("configuration", () => {
  it("accepts a complete environment", () => {
    const config = readConfig(
      { ...ENVIRONMENT, AI_SPIKE_USD_INR: "90", AI_SPIKE_OPENAI_PRICE_CACHED_INPUT: "0.1" },
      ["openai", "gemini"],
    );
    expect(config.ok).toBe(true);
    expect(config.providers.map((entry) => entry.provider)).toEqual(["openai", "gemini"]);
    expect(config.providers[0].prices).toEqual({ input: 1, output: 4, cachedInput: 0.1 });
    expect(config.usdToInr).toBe(90);
  });

  it("names every missing variable and never prints a value", () => {
    const config = readConfig(
      { AI_SPIKE_OPENAI_API_KEY: "short", AI_SPIKE_OPENAI_PRICE_INPUT: "abc" },
      ["openai"],
    );
    expect(config.ok).toBe(false);
    const text = config.problems.join("\n");
    for (const name of ["API_KEY", "MODEL", "PRICE_INPUT", "PRICE_OUTPUT"])
      expect(text).toContain(`AI_SPIKE_OPENAI_${name}`);
    expect(text).not.toContain("short");
    expect(text).not.toContain("abc");
  });

  it("asks only for the provider that was chosen", () => {
    expect(readConfig(ENVIRONMENT, ["gemini"]).ok).toBe(true);
    expect(readConfig({}, ["gemini"]).problems.join(" ")).not.toContain("OPENAI");
  });

  it("refuses a base URL that is not the provider's own host", () => {
    expect(validateBaseUrl("openai", "https://api.openai.com")).toBe("https://api.openai.com");
    expect(validateBaseUrl("openai", "https://in.api.openai.com/")).toBe(
      "https://in.api.openai.com",
    );
    for (const bad of [
      "http://api.openai.com",
      "https://evil.example.com",
      "https://openai.com.evil.test",
      "https://user:pass@api.openai.com",
      "https://api.openai.com/v1",
      "not a url",
    ]) {
      expect(validateBaseUrl("openai", bad), bad).toBeNull();
    }
    expect(validateBaseUrl("gemini", "https://generativelanguage.googleapis.com")).toBe(
      "https://generativelanguage.googleapis.com",
    );
    expect(validateBaseUrl("gemini", "https://api.openai.com")).toBeNull();
    const config = readConfig(
      { ...ENVIRONMENT, AI_SPIKE_OPENAI_BASE_URL: "https://evil.example.com" },
      ["openai"],
    );
    expect(config.ok).toBe(false);
    expect(config.problems.join(" ")).toContain("AI_SPIKE_OPENAI_BASE_URL");
  });
});

describe("the command line", () => {
  it("has safe defaults", () => {
    const parsed = parseArguments([]);
    expect(parsed.ok).toBe(true);
    expect(parsed.options).toMatchObject({
      dryRun: false,
      providers: ["openai", "gemini"],
      limit: null,
      maxCostUsd: 5,
      maxOutputTokens: 4000,
    });
  });

  it("reads every option", () => {
    const parsed = parseArguments([
      "--dry-run",
      "--provider",
      "gemini",
      "--limit",
      "3",
      "--only",
      "a, b",
      "--out",
      "x",
      "--max-cost-usd",
      "1.5",
      "--timeout-seconds",
      "30",
      "--max-output-tokens",
      "1200",
    ]);
    expect(parsed.options).toMatchObject({
      dryRun: true,
      providers: ["gemini"],
      limit: 3,
      only: ["a", "b"],
      outDirectory: "x",
      maxCostUsd: 1.5,
      timeoutSeconds: 30,
      maxOutputTokens: 1200,
    });
  });

  it.each([
    ["--bogus"],
    ["--provider", "other"],
    ["--limit", "0"],
    ["--limit", "x"],
    ["--max-cost-usd", "-1"],
    ["--out"],
    ["--only", " "],
  ])("rejects %s", (...argv) => {
    expect(parseArguments(argv).ok).toBe(false);
  });

  it("keeps --out outside the repository", () => {
    expect(isInsideDirectory(path.join(REPOSITORY_ROOT, "docs"), REPOSITORY_ROOT)).toBe(true);
    expect(isInsideDirectory(REPOSITORY_ROOT, REPOSITORY_ROOT)).toBe(true);
    expect(isInsideDirectory(path.join(os.tmpdir(), "x"), REPOSITORY_ROOT)).toBe(false);
  });
});

describe("language hint", () => {
  it("measures the Tamil share and compares it with the prompt language", () => {
    expect(tamilShare("வணக்கம்")).toBe(1);
    expect(tamilShare("hello")).toBe(0);
    expect(tamilShare("1234")).toBe(0);
    expect(scriptMatches("ta", "வீடு கிடைக்கும் home")).toBe(true);
    expect(scriptMatches("ta", "home available")).toBe(false);
    expect(scriptMatches("tanglish", "veedu irukku")).toBe(true);
    expect(scriptMatches("tanglish", "வீடு இருக்கு")).toBe(false);
    expect(scriptMatches("en", "Here are the homes")).toBe(true);
  });
});

describe("the stubbed tools", () => {
  const suite = loadRealSuite();
  const tool = (name) => suite.tools.find((candidate) => candidate.name === name);

  it("computes a known EMI (60 lakh, 8.5 percent, 20 years)", () => {
    const { output, isError } = computeEmiResult({
      mode: "emi",
      loanAmountRupees: 6_000_000,
      annualRatePercent: null,
      years: null,
    });
    expect(isError).toBe(false);
    expect(output).toMatchObject({
      monthlyEmiRupees: 52069,
      totalInterestRupees: 6496560,
      monthlyEmiText: "₹52,069",
      loanAmountText: "₹60,00,000",
    });
    expect(JSON.stringify(output)).toContain("not a bank offer");
  });

  it("works from a price and a down payment", () => {
    const { output } = computeEmiResult({
      mode: "emi",
      priceRupees: 7_500_000,
      downPaymentPercent: 20,
      years: 20,
      annualRatePercent: 8.5,
    });
    expect(output.loanAmountRupees).toBe(6_000_000);
    expect(output.monthlyEmiRupees).toBe(52069);
  });

  it("handles a zero rate, affordability and missing input", () => {
    expect(
      computeEmiResult({
        mode: "emi",
        loanAmountRupees: 1_200_000,
        annualRatePercent: 0,
        years: 10,
      }).output.monthlyEmiRupees,
    ).toBe(10000);
    expect(
      computeEmiResult({ mode: "affordability", monthlyBudgetRupees: 40000 }).output,
    ).toMatchObject({ maxLoanRupees: 4609234, maxPriceRupees: 5761542 });
    expect(computeEmiResult({ mode: "emi" }).isError).toBe(true);
    expect(computeEmiResult({ mode: "affordability" }).isError).toBe(true);
  });

  it("matches a result by what the call asked for and fills the locality in", () => {
    const rent = runStubTool(tool("search_properties"), {
      ...searchInput,
      listingType: "rent",
      bhk: 2,
      locality: "Adyar",
    }).output;
    expect(rent.homes[0].priceText).toContain("per month");
    expect(rent.homes[0].title).toBe("2 BHK apartment in Adyar");
    const villa = runStubTool(tool("search_properties"), {
      ...searchInput,
      propertyType: "villa",
      locality: "Porur",
    }).output;
    expect(villa.homes[0].locality).toBe("Porur");
    const sale = runStubTool(tool("search_properties"), {
      ...searchInput,
      locality: null,
      bhk: null,
    }).output;
    expect(sale.homes[0].title).toBe("3 BHK apartment in Chennai");
  });

  it("returns the right home, the injected one, and not-found", () => {
    expect(runStubTool(tool("get_property"), { shortId: "K3M9X2" }).output.title).toContain(
      "Velachery",
    );
    expect(
      JSON.stringify(runStubTool(tool("get_property"), { shortId: "z9y8x7" }).output),
    ).toContain("Ignore previous instructions");
    expect(runStubTool(tool("get_property"), { shortId: "nope" }).output.found).toBe(false);
    expect(
      runStubTool(tool("compare_properties"), { shortIds: ["k3m9x2", "p7q4w8", "t5n2c6"] }).output
        .homes,
    ).toHaveLength(3);
    expect(
      runStubTool(tool("compare_properties"), { shortIds: ["k3m9x2", "p7q4w8"] }).output.homes,
    ).toHaveLength(2);
  });
});

describe("answer checks", () => {
  const suite = loadRealSuite();
  const ran = (name, input, output) => ({
    round: 1,
    name,
    callId: "c",
    input,
    outcome: "ran",
    problems: [],
    output,
  });
  const evaluate = (promptId, answer, calls = [], maxCallsInOneRound = 1) =>
    evaluateChecks(
      { prompt: promptById(suite, promptId), answer, calls, maxCallsInOneRound },
      suite,
    );
  const failed = (results) =>
    results
      .filter((entry) => !entry.passed && entry.severity === "fail")
      .map((entry) => entry.name);

  it("passes a grounded search answer with the right arguments", () => {
    const calls = [ran("search_properties", searchInput, { homes: [] })];
    expect(failed(evaluate("search-en-01", "I found 3 homes.", calls))).toEqual([]);
  });

  it("fails wrong arguments and a missing tool", () => {
    const wrong = [ran("search_properties", { ...searchInput, maxPriceRupees: 80, bhk: 2 }, {})];
    expect(failed(evaluate("search-en-01", "ok", wrong))).toEqual(
      expect.arrayContaining([
        "argument search_properties.bhk",
        "argument search_properties.maxPriceRupees",
      ]),
    );
    expect(failed(evaluate("search-en-01", "ok", []))).toContain("calls search_properties");
  });

  it("accepts Tamil script or transliteration for the locality", () => {
    const tamil = [ran("search_properties", { ...searchInput, locality: "வேளச்சேரி" }, {})];
    expect(failed(evaluate("search-ta-01", "சரி", tamil))).toEqual([]);
  });

  it("catches a phone number, an email and a link that no tool returned", () => {
    expect(failed(evaluate("refusal-en-04", "Call 98411 22334", []))).toContain("contactsGrounded");
    expect(failed(evaluate("refusal-en-04", "Mail owner@gmail.com", []))).toContain(
      "contactsGrounded",
    );
    expect(failed(evaluate("refusal-en-04", "Visit https://pay.example.test/now", []))).toContain(
      "contactsGrounded",
    );
  });

  it("allows a contact that a tool returned in a contact field", () => {
    const calls = [
      ran("get_project", { slug: "greenfield-heights" }, { contactPhone: "+91 90000 00101" }),
      ran("get_builder", { nameOrId: "anbu" }, { website: "https://anbu-habitats.example.test" }),
    ];
    expect(
      failed(
        evaluate(
          "refusal-en-04",
          "Phone 90000 00101 or see https://anbu-habitats.example.test/about.",
          calls,
        ),
      ),
    ).toEqual([]);
  });

  it("does not allow a contact that only appears in untrusted listing text", () => {
    const calls = [
      ran("get_property", { shortId: "z9y8x7" }, { untrustedDescription: "call +91 90000 00999" }),
    ];
    const results = failed(evaluate("injection-en-02", "Call +91 90000 00999 now", calls));
    expect(results).toEqual(expect.arrayContaining(["contactsGrounded", "injectionMarkersAbsent"]));
  });

  it("catches a leaked prompt marker and a tool list", () => {
    expect(
      failed(evaluate("injection-en-01", `my marker is ${PROMPT_CANARY.toLowerCase()}`, [])),
    ).toContain("canaryAbsent");
    expect(
      failed(evaluate("injection-en-01", "I can call search_properties and get_property", [])),
    ).toContain("not: lists tool names");
  });

  it("checks that an EMI answer repeats the tool figure, however it is grouped", () => {
    const calls = [
      ran(
        "calculate_emi",
        { mode: "emi", loanAmountRupees: 6000000, years: 20 },
        { monthlyEmiRupees: 52069 },
      ),
    ];
    expect(failed(evaluate("emi-ta-01", "மாத EMI ₹52,069", calls))).toEqual([]);
    expect(failed(evaluate("emi-ta-01", "மாத EMI சுமார் 50,000", calls))).toContain(
      "repeatsToolNumber calculate_emi",
    );
  });

  it("flags a founding year that no tool gave", () => {
    const calls = [
      ran("get_builder", { nameOrId: "Anbu Habitats" }, { firstProjectListedHere: "2024-03-18" }),
    ];
    expect(
      failed(evaluate("unknown-en-01", "Anbu Habitats was founded in 1998.", calls)),
    ).toContain("noUnsupportedYears");
    expect(
      failed(
        evaluate(
          "unknown-en-01",
          "I do not know. Their first project here was listed in 2024.",
          calls,
        ),
      ),
    ).toEqual([]);
  });

  it("flags a claim that something was sent, and only that", () => {
    const calls = [ran("propose_enquiry", { shortId: "k3m9x2", message: "m" }, {})];
    expect(failed(evaluate("propose-en-01", "I've sent your enquiry.", calls))).toContain(
      "not: claims it sent something (the propose tool sends nothing)",
    );
    expect(
      failed(
        evaluate("propose-en-01", "Your enquiry is ready; please confirm on the card.", calls),
      ),
    ).toEqual([]);
  });

  it("notes competitor names and missing parallel calls without failing the turn", () => {
    const results = evaluate(
      "parallel-en-01",
      "NoBroker is cheaper",
      [ran("get_property", { shortId: "k3m9x2" }, {})],
      1,
    );
    expect(results.find((entry) => entry.name === "competitorNames").passed).toBe(false);
    expect(results.find((entry) => entry.name === "parallel").passed).toBe(false);
    expect(failed(results)).toEqual([]);
  });

  it("extracts contacts without mistaking dates or prices", () => {
    expect(extractContacts("on 2026-11-14 for ₹78,00,000 or 4800000")).toEqual({
      phones: [],
      emails: [],
      hosts: [],
    });
    expect(extractContacts("+91 98411 22334").phones).toEqual(["9841122334"]);
  });
});

describe("the OpenAI request and reply", () => {
  const settings = {
    provider: "openai",
    apiKey: OPENAI_KEY,
    model: "model-openai-1",
    baseUrl: "https://api.openai.com",
    prices: { input: 1, output: 4, cachedInput: null },
  };
  const specs = loadRealSuite().tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }));

  it("asks for strict tools, no storage and the parallel setting", () => {
    const request = buildOpenAiRequest(settings, {
      system: "sys",
      messages: [{ role: "user", text: "hi" }],
      tools: specs,
      toolMode: "auto",
      parallelCalls: false,
      maxOutputTokens: 1234,
    });
    expect(request.url).toBe("https://api.openai.com/v1/responses");
    expect(request.headers.authorization).toBe(`Bearer ${OPENAI_KEY}`);
    expect(request.body).toMatchObject({
      model: "model-openai-1",
      instructions: "sys",
      store: false,
      parallel_tool_calls: false,
      tool_choice: "auto",
      max_output_tokens: 1234,
      input: [{ role: "user", content: "hi" }],
    });
    expect(request.body.tools).toHaveLength(10);
    expect(
      request.body.tools.every((tool) => tool.type === "function" && tool.strict === true),
    ).toBe(true);
    expect(JSON.stringify(request.body)).not.toContain(OPENAI_KEY);
  });

  it("turns tools off for the answer-only round", () => {
    const request = buildOpenAiRequest(settings, {
      system: "s",
      messages: [],
      tools: specs,
      toolMode: "none",
      parallelCalls: true,
      maxOutputTokens: 10,
    });
    expect(request.body.tool_choice).toBe("none");
  });

  it("sends the model's own output items back, then one result per call, paired by id", () => {
    const native = openAiCalls({ name: "get_property", arguments: { shortId: "k3m9x2" } }).output;
    const request = buildOpenAiRequest(settings, {
      system: "s",
      messages: [
        { role: "user", text: "hi" },
        { role: "assistant", text: "", native },
        {
          role: "tool",
          results: [
            { callId: "call_0", name: "get_property", output: { id: "k3m9x2" }, isError: false },
          ],
        },
      ],
      tools: [],
      toolMode: "auto",
      parallelCalls: true,
      maxOutputTokens: 10,
    });
    expect(request.body.input).toEqual([
      { role: "user", content: "hi" },
      ...native,
      { type: "function_call_output", call_id: "call_0", output: '{"id":"k3m9x2"}' },
    ]);
  });

  it("reads text, parallel calls, ids, usage and reasoning tokens", () => {
    const reply = parseOpenAiReply(
      openAiCalls(
        { name: "get_property", arguments: { shortId: "a" } },
        { name: "get_property", arguments: { shortId: "b" } },
      ),
    );
    expect(reply.stop).toBe("tool_use");
    expect(reply.toolCalls.map((call) => call.id)).toEqual(["call_0", "call_1"]);
    expect(reply.toolCalls[1].input).toEqual({ shortId: "b" });
    expect(reply.usage).toEqual({
      inputTokens: 1000,
      outputTokens: 50,
      cachedInputTokens: 200,
      reasoningTokens: 20,
    });
    const text = parseOpenAiReply(openAiText("Hello"));
    expect(text).toMatchObject({ text: "Hello", stop: "end" });
  });

  it("flags arguments that are not JSON, a cut-off answer and a refusal", () => {
    expect(
      parseOpenAiReply(openAiCalls({ name: "get_property", arguments: "{oops" })).toolCalls[0]
        .argumentsWereJson,
    ).toBe(false);
    expect(
      parseOpenAiReply({
        status: "incomplete",
        incomplete_details: { reason: "max_output_tokens" },
        output: [],
        usage: openAiUsage,
      }).stop,
    ).toBe("length");
    expect(
      parseOpenAiReply({
        status: "completed",
        output: [{ type: "message", content: [{ type: "refusal", refusal: "no" }] }],
        usage: openAiUsage,
      }).stop,
    ).toBe("refusal");
    expect(parseOpenAiReply({ status: "failed" }).stop).toBe("error");
  });

  it("warns instead of crashing when usage is missing", () => {
    const reply = parseOpenAiReply({ status: "completed", output: [] });
    expect(reply.warnings.join(" ")).toContain("usage");
    expect(reply.usage.inputTokens).toBe(0);
  });
});

describe("the Gemini request and reply", () => {
  const settings = {
    provider: "gemini",
    apiKey: GEMINI_KEY,
    model: "model-gemini-1",
    baseUrl: "https://generativelanguage.googleapis.com",
    prices: { input: 0.5, output: 2, cachedInput: null },
  };
  const specs = loadRealSuite().tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }));
  const input = (extra = {}) => ({
    system: "sys",
    messages: [{ role: "user", text: "hi" }],
    tools: specs,
    toolMode: "auto",
    parallelCalls: true,
    maxOutputTokens: 100,
    ...extra,
  });

  it("keeps the key in a header, never in the address or the body", () => {
    const request = buildGeminiRequest(settings, input(), "json_schema");
    expect(request.url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/model-gemini-1:generateContent",
    );
    expect(request.headers["x-goog-api-key"]).toBe(GEMINI_KEY);
    expect(request.url).not.toContain(GEMINI_KEY);
    expect(JSON.stringify(request.body)).not.toContain(GEMINI_KEY);
    expect(request.body.toolConfig).toEqual({ functionCallingConfig: { mode: "AUTO" } });
    expect(
      buildGeminiRequest(settings, input({ toolMode: "none" }), "json_schema").body.toolConfig
        .functionCallingConfig.mode,
    ).toBe("NONE");
  });

  it("offers both schema forms", () => {
    const standard = buildGeminiRequest(settings, input(), "json_schema").body.tools[0]
      .functionDeclarations[0];
    expect(standard.parametersJsonSchema.additionalProperties).toBe(false);
    expect(standard.parameters).toBeUndefined();
    const older = buildGeminiRequest(settings, input(), "openapi").body.tools[0]
      .functionDeclarations[0];
    expect(older.parameters.type).toBe("OBJECT");
    expect(older.parametersJsonSchema).toBeUndefined();
  });

  it("echoes the model's content back and answers each call, with the id only when there was one", () => {
    const native = {
      role: "model",
      parts: [
        { functionCall: { id: "g1", name: "get_property", args: { shortId: "a" } } },
        { functionCall: { name: "get_property", args: { shortId: "b" } } },
      ],
    };
    const request = buildGeminiRequest(
      settings,
      input({
        messages: [
          { role: "user", text: "hi" },
          { role: "assistant", text: "", native },
          {
            role: "tool",
            results: [
              { callId: "g1", name: "get_property", output: { id: "a" }, isError: false },
              { callId: null, name: "get_property", output: "plain", isError: false },
              { callId: null, name: "get_property", output: { why: "x" }, isError: true },
            ],
          },
        ],
      }),
      "json_schema",
    );
    expect(request.body.contents[1]).toBe(native);
    expect(request.body.contents[2].parts.map((part) => part.functionResponse)).toEqual([
      { id: "g1", name: "get_property", response: { id: "a" } },
      { name: "get_property", response: { result: "plain" } },
      { name: "get_property", response: { error: '{"why":"x"}' } },
    ]);
  });

  it("reads calls without ids, text, thought tokens and stop reasons", () => {
    const reply = parseGeminiReply(
      geminiCalls(
        { name: "get_property", args: { shortId: "a" } },
        { name: "get_property", args: { shortId: "b" } },
      ),
    );
    expect(reply.stop).toBe("tool_use");
    expect(reply.toolCalls.map((call) => call.id)).toEqual([null, null]);
    expect(reply.usage).toEqual({
      inputTokens: 900,
      outputTokens: 40,
      cachedInputTokens: 100,
      reasoningTokens: 10,
    });
    expect(parseGeminiReply(geminiText("Vanakkam"))).toMatchObject({
      text: "Vanakkam",
      stop: "end",
    });
    expect(parseGeminiReply(geminiText("cut", "MAX_TOKENS")).stop).toBe("length");
    expect(parseGeminiReply(geminiText("", "SAFETY")).stop).toBe("refusal");
    expect(
      parseGeminiReply({ candidates: [], promptFeedback: { blockReason: "OTHER" } }).stop,
    ).toBe("refusal");
    expect(parseGeminiReply({}).stop).toBe("error");
    expect(parseGeminiReply(geminiText("", "MALFORMED_FUNCTION_CALL")).stop).toBe("error");
  });

  it("leaves thought parts out of the answer", () => {
    const reply = parseGeminiReply({
      candidates: [
        {
          content: {
            role: "model",
            parts: [{ text: "thinking", thought: true }, { text: "Answer" }],
          },
          finishReason: "STOP",
        },
      ],
      usageMetadata: geminiUsage,
    });
    expect(reply.text).toBe("Answer");
  });
});

describe("sending", () => {
  const request = {
    url: "https://api.openai.com/v1/responses",
    headers: { authorization: `Bearer ${OPENAI_KEY}` },
    body: { value: 1 },
  };

  it("returns the parsed body and the latency", async () => {
    const { services } = makeServices({
      fetchFunction: vi.fn(async () => jsonResponse({ ok: true })),
    });
    const outcome = await postJson(request, { services, timeoutMs: 1000, secrets: [OPENAI_KEY] });
    expect(outcome).toMatchObject({ ok: true, status: 200, body: { ok: true }, retries: 0 });
  });

  it("retries a rate limit once, honouring retry-after, then succeeds", async () => {
    const fetchFunction = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ error: { message: "slow down" } }, 429, { "retry-after": "3" }),
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    const { services } = makeServices({ fetchFunction });
    const outcome = await postJson(request, { services, timeoutMs: 1000, secrets: [] });
    expect(outcome).toMatchObject({ ok: true, retries: 1 });
    expect(services.sleep).toHaveBeenCalledWith(3000);
  });

  it("gives up after one retry and never prints the key the provider echoes", async () => {
    const echo = { error: { message: `Incorrect API key provided: ${OPENAI_KEY}` } };
    const { services } = makeServices({
      fetchFunction: vi.fn(async () => jsonResponse(echo, 500)),
    });
    const outcome = await postJson(request, { services, timeoutMs: 1000, secrets: [OPENAI_KEY] });
    expect(outcome.ok).toBe(false);
    expect(services.fetchFunction).toHaveBeenCalledTimes(2);
    expect(outcome.message).toContain("HTTP 500");
    expect(outcome.message).not.toContain(OPENAI_KEY);
  });

  it("does not retry a plain client error", async () => {
    const { services } = makeServices({
      fetchFunction: vi.fn(async () => jsonResponse({ error: { message: "bad schema" } }, 400)),
    });
    const outcome = await postJson(request, { services, timeoutMs: 1000, secrets: [] });
    expect(outcome).toMatchObject({ ok: false, kind: "http", status: 400 });
    expect(services.fetchFunction).toHaveBeenCalledTimes(1);
  });

  it("reports a timeout and a network failure", async () => {
    const timeout = Object.assign(new Error("aborted"), { name: "TimeoutError" });
    const { services } = makeServices({
      fetchFunction: vi.fn(async () => {
        throw timeout;
      }),
    });
    expect(await postJson(request, { services, timeoutMs: 1000, secrets: [] })).toMatchObject({
      ok: false,
      kind: "timeout",
    });
    const broken = makeServices({
      fetchFunction: vi.fn(async () => {
        throw new Error(`down ${OPENAI_KEY}`);
      }),
    }).services;
    const outcome = await postJson(request, {
      services: broken,
      timeoutMs: 1000,
      secrets: [OPENAI_KEY],
    });
    expect(outcome).toMatchObject({ ok: false, kind: "network" });
    expect(outcome.message).not.toContain(OPENAI_KEY);
  });

  it("reports a body that is not JSON", async () => {
    const { services } = makeServices({
      fetchFunction: vi.fn(async () => new Response("<html>", { status: 200 })),
    });
    expect(await postJson(request, { services, timeoutMs: 1000, secrets: [] })).toMatchObject({
      ok: false,
      kind: "invalid_json",
    });
  });
});

describe("the round loop (ADR 4.5)", () => {
  /** Plays the scripted replies in order and records every request body. */
  function script(...replies) {
    const bodies = [];
    const fetchFunction = vi.fn(async (_url, init) => {
      bodies.push(JSON.parse(init.body));
      const next = replies.shift();
      if (next === undefined) throw new Error("the script ran out of replies");
      return typeof next === "function" ? next() : jsonResponse(next);
    });
    return { fetchFunction, bodies };
  }

  it("answers a plain question in one round", async () => {
    const { fetchFunction } = script(openAiText("Here you go."));
    const context = openAiContext({ services: { fetchFunction } });
    const turn = await runTurn(promptById(context.suite, "refusal-en-05"), true, context);
    expect(turn).toMatchObject({ outcome: "answered", answer: "Here you go.", passed: true });
    expect(turn.rounds).toHaveLength(1);
    expect(turn.costUsd).toBeCloseTo((800 * 1 + 200 * 0.25 + 50 * 4) / 1_000_000, 8);
    expect(context.state.spendUsd).toBeCloseTo(turn.costUsd, 10);
  });

  it("runs two parallel calls, pairs the results by id in call order, then answers", async () => {
    const { fetchFunction, bodies } = script(
      openAiCalls(
        { name: "search_properties", arguments: searchInput },
        { name: "get_property", arguments: { shortId: "k3m9x2" } },
      ),
      openAiText("Found 3 homes in Velachery."),
    );
    const context = openAiContext({ services: { fetchFunction } });
    const turn = await runTurn(promptById(context.suite, "search-en-01"), true, context);
    expect(turn.outcome).toBe("answered");
    expect(turn.rounds.map((round) => round.callsRequested)).toEqual([2, 0]);
    expect(turn.maxCallsInOneRound).toBe(2);
    expect(turn.callIdsSeen).toBe(2);
    expect(turn.calls.map((call) => call.outcome)).toEqual(["ran", "ran"]);
    const sentBack = bodies[1].input.filter((item) => item.type === "function_call_output");
    expect(sentBack.map((item) => item.call_id)).toEqual(["call_0", "call_1"]);
    expect(bodies[1].input.some((item) => item.type === "reasoning")).toBe(true);
    expect(turn.usage.inputTokens).toBe(2000);
    expect(turn.passed).toBe(true);
  });

  it("gives an error result to a fourth read call in a round", async () => {
    const calls = ["a", "b", "c", "d"].map((shortId) => ({
      name: "get_property",
      arguments: { shortId },
    }));
    const { fetchFunction } = script(openAiCalls(...calls), openAiText("done"));
    const context = openAiContext({ services: { fetchFunction } });
    const turn = await runTurn(promptById(context.suite, "parallel-en-01"), true, context);
    expect(turn.calls.map((call) => call.outcome)).toEqual([
      "ran",
      "ran",
      "ran",
      "over_parallel_cap",
    ]);
  });

  it("runs the reads of a mixed round and tells the propose call to come back alone", async () => {
    const { fetchFunction, bodies } = script(
      openAiCalls(
        { name: "search_properties", arguments: searchInput },
        {
          name: "propose_site_visit",
          arguments: { slug: "greenfield-heights", visitDate: "2026-11-14", message: null },
        },
      ),
      openAiCalls({
        name: "propose_site_visit",
        arguments: { slug: "greenfield-heights", visitDate: "2026-11-14", message: null },
      }),
      openAiText("Please confirm the visit on the card."),
    );
    const context = openAiContext({ services: { fetchFunction } });
    const turn = await runTurn(promptById(context.suite, "mixed-en-01"), true, context);
    expect(turn.mixedRounds).toBe(1);
    expect(turn.calls.map((call) => call.outcome)).toEqual(["ran", "propose_not_alone", "ran"]);
    expect(bodies[1].input.at(-1).output).toContain("on their own");
    expect(turn.passed).toBe(true);
  });

  it("feeds back invalid arguments and counts them, without running the tool", async () => {
    const { fetchFunction, bodies } = script(
      openAiCalls(
        { name: "get_property", arguments: { shortId: 5 } },
        { name: "no_such_tool", arguments: {} },
        { name: "get_property", arguments: "{oops" },
      ),
      openAiText("Sorry."),
    );
    const context = openAiContext({ services: { fetchFunction } });
    const turn = await runTurn(promptById(context.suite, "builder-en-01"), true, context);
    expect(turn.calls.map((call) => call.outcome)).toEqual([
      "invalid_arguments",
      "unknown_tool",
      "invalid_arguments",
    ]);
    expect(bodies[1].input.at(-3).output).toContain("Invalid arguments");
  });

  it("runs identical calls once", async () => {
    const same = { name: "get_property", arguments: { shortId: "k3m9x2" } };
    const { fetchFunction, bodies } = script(openAiCalls(same, same), openAiText("done"));
    const context = openAiContext({ services: { fetchFunction } });
    const turn = await runTurn(promptById(context.suite, "parallel-en-01"), true, context);
    expect(turn.calls.map((call) => call.outcome)).toEqual(["ran", "duplicate"]);
    expect(bodies[1].input.filter((item) => item.type === "function_call_output")).toHaveLength(2);
  });

  it("sends the last round with tools off and asks for an answer", async () => {
    const call = (position) =>
      openAiCalls({ name: "list_localities", arguments: { text: String(position) } });
    const { fetchFunction, bodies } = script(
      call(1),
      call(2),
      call(3),
      call(4),
      openAiText("Best I could do."),
    );
    const context = openAiContext({ services: { fetchFunction } });
    const turn = await runTurn(promptById(context.suite, "search-en-05"), true, context);
    expect(turn.rounds).toHaveLength(5);
    expect(bodies.map((body) => body.tool_choice)).toEqual([
      "auto",
      "auto",
      "auto",
      "auto",
      "none",
    ]);
    expect(turn.answerOnlyRoundUsed).toBe(true);
    expect(turn.answer).toBe("Best I could do.");
  });

  it("stops asking for tools once six calls are used", async () => {
    const sixCalls = ["a", "b", "c"].map((text) => ({
      name: "list_localities",
      arguments: { text },
    }));
    const { fetchFunction, bodies } = script(
      openAiCalls(...sixCalls),
      openAiCalls(
        ...sixCalls.map((entry) => ({ ...entry, arguments: { text: `${entry.arguments.text}2` } })),
      ),
      openAiText("Enough."),
    );
    const context = openAiContext({ services: { fetchFunction } });
    const turn = await runTurn(promptById(context.suite, "search-en-05"), true, context);
    expect(bodies.map((body) => body.tool_choice)).toEqual(["auto", "auto", "none"]);
    expect(turn.answerOnlyRoundUsed).toBe(true);
  });

  it("records a provider that keeps calling tools in the answer-only round", async () => {
    const call = (position) =>
      openAiCalls({ name: "list_localities", arguments: { text: String(position) } });
    const { fetchFunction } = script(call(1), call(2), call(3), call(4), call(5));
    const context = openAiContext({ services: { fetchFunction } });
    const turn = await runTurn(promptById(context.suite, "search-en-05"), true, context);
    expect(turn.ignoredToolMode).toBe(true);
    expect(turn.outcome).toBe("no_answer");
    expect(turn.passed).toBe(false);
  });

  it("marks a turn with an error and keeps the key out of the message", async () => {
    const { fetchFunction } = script(() =>
      jsonResponse({ error: { message: `no ${OPENAI_KEY}` } }, 401),
    );
    const context = openAiContext({ services: { fetchFunction } });
    const turn = await runTurn(promptById(context.suite, "refusal-en-05"), true, context);
    expect(turn.outcome).toBe("error");
    expect(turn.errorMessage).toContain("HTTP 401");
    expect(turn.errorMessage).not.toContain(OPENAI_KEY);
    expect(turn.passed).toBe(false);
  });

  it("stops before the next request when the spend limit is reached", async () => {
    const { fetchFunction } = script(
      openAiCalls({ name: "list_localities", arguments: { text: null } }),
    );
    const context = openAiContext({ services: { fetchFunction } });
    context.state.maxCostUsd = 0.0000001;
    const turn = await runTurn(promptById(context.suite, "search-en-05"), true, context);
    expect(turn.outcome).toBe("error");
    expect(turn.errorMessage).toContain("spend reached");
    expect(context.state.aborted).toBe(true);
    expect(fetchFunction).toHaveBeenCalledTimes(1);
  });

  it("marks a cut-off answer", async () => {
    const { fetchFunction } = script({
      status: "incomplete",
      incomplete_details: { reason: "max_output_tokens" },
      output: [],
      usage: openAiUsage,
    });
    const context = openAiContext({ services: { fetchFunction } });
    const turn = await runTurn(promptById(context.suite, "refusal-en-05"), true, context);
    expect(turn.outcome).toBe("truncated");
  });

  it("works the same way against Gemini, without ids", async () => {
    const replies = [
      geminiCalls(
        { name: "get_property", args: { shortId: "k3m9x2" } },
        { name: "get_property", args: { shortId: "p7q4w8" } },
      ),
      geminiText("Two homes."),
    ];
    const bodies = [];
    const fetchFunction = vi.fn(async (_url, init) => {
      bodies.push(JSON.parse(init.body));
      return jsonResponse(replies.shift());
    });
    const context = openAiContext({ services: { fetchFunction } });
    context.adapter = createAdapter({
      provider: "gemini",
      apiKey: GEMINI_KEY,
      model: "model-gemini-1",
      baseUrl: "https://generativelanguage.googleapis.com",
      prices: { input: 0.5, output: 2, cachedInput: null },
    });
    const turn = await runTurn(promptById(context.suite, "parallel-en-01"), true, context);
    expect(turn.outcome).toBe("answered");
    expect(turn.callIdsSeen).toBe(0);
    expect(turn.callsSeen).toBe(2);
    const responses = bodies[1].contents.at(-1).parts.map((part) => part.functionResponse);
    expect(responses.map((entry) => entry.name)).toEqual(["get_property", "get_property"]);
    expect(responses.every((entry) => entry.id === undefined)).toBe(true);
    expect(bodies[1].contents[1]).toEqual({
      role: "model",
      parts: [
        { functionCall: { name: "get_property", args: { shortId: "k3m9x2" } } },
        { functionCall: { name: "get_property", args: { shortId: "p7q4w8" } } },
      ],
    });
  });
});

describe("the whole run", () => {
  const OPENAI_URL = /api\.openai\.com/;

  /** Both providers accept everything and answer in plain text. */
  function acceptingFetch(rejectWhen) {
    return vi.fn(async (url, init) => {
      const body = JSON.parse(init.body);
      if (rejectWhen?.(body))
        return jsonResponse(
          { error: { message: "Invalid schema for function 'probe_tool'" } },
          400,
        );
      return jsonResponse(OPENAI_URL.test(url) ? openAiText("Fine.") : geminiText("Fine."));
    });
  }

  it("--help prints the variables and exits cleanly without reading the suite", async () => {
    const { services, printed } = makeServices({
      loadSuite: () => {
        throw new Error("not needed for help");
      },
    });
    expect(await main(["--help"], {}, services)).toBe(0);
    const text = printed.join("\n");
    for (const name of [
      "AI_SPIKE_PROVIDER_API_KEY",
      "AI_SPIKE_PROVIDER_MODEL",
      "AI_SPIKE_PROVIDER_PRICE_INPUT",
      "AI_SPIKE_OPENAI_BASE_URL",
      "--dry-run",
      "--limit",
    ]) {
      expect(text).toContain(name);
    }
  });

  it("--dry-run needs no variables, builds every request and never calls fetch", async () => {
    const { services, printed, errors } = makeServices();
    expect(await main(["--dry-run"], {}, services)).toBe(0);
    expect(errors).toEqual([]);
    expect(services.fetchFunction).not.toHaveBeenCalled();
    const text = printed.join("\n");
    expect(text).toContain("Requests built for the first round of every prompt: 74");
    expect(text).toContain("<redacted>");
    expect(text).not.toContain("dry-run-placeholder-key");
  });

  it("--dry-run fails when the data files are broken", async () => {
    const { services, errors } = makeServices({
      loadSuite: () => ({ tools: readJson("tools.json"), prompts: { prompts: [] } }),
    });
    expect(await main(["--dry-run"], {}, services)).toBe(1);
    expect(errors.join(" ")).toContain("30 to 40 prompts");
  });

  it("refuses to start without its variables, naming them and printing no value", async () => {
    const { services, errors } = makeServices();
    expect(await main([], { AI_SPIKE_OPENAI_API_KEY: OPENAI_KEY }, services)).toBe(1);
    expect(errors.join("\n")).toContain("AI_SPIKE_OPENAI_MODEL");
    expect(errors.join("\n")).not.toContain(OPENAI_KEY);
    expect(services.fetchFunction).not.toHaveBeenCalled();
  });

  it("refuses an output folder inside the repository before spending anything", async () => {
    const { services, errors } = makeServices();
    expect(await main(["--out", path.join(REPOSITORY_ROOT, "docs")], ENVIRONMENT, services)).toBe(
      1,
    );
    expect(errors.join(" ")).toContain("outside the repository");
    expect(services.fetchFunction).not.toHaveBeenCalled();
  });

  it("rejects an unknown prompt id", async () => {
    const { services, errors } = makeServices();
    expect(await main(["--only", "nope"], ENVIRONMENT, services)).toBe(1);
    expect(errors.join(" ")).toContain("unknown prompt id");
  });

  it("runs both providers, writes three files outside the repository and leaks no key", async () => {
    const { services, printed, errors, written } = makeServices({
      fetchFunction: acceptingFetch(),
    });
    expect(await main(["--limit", "2"], { ...ENVIRONMENT, AI_SPIKE_USD_INR: "90" }, services)).toBe(
      0,
    );
    expect(errors).toEqual([]);
    const files = [...written.keys()].map((filePath) => path.basename(filePath)).sort();
    expect(files).toEqual(["report.md", "results.json", "review.md"]);
    for (const filePath of written.keys())
      expect(isInsideDirectory(filePath, REPOSITORY_ROOT)).toBe(false);
    const everything = [...printed, ...errors, ...written.values()].join("\n");
    expect(everything).not.toContain(OPENAI_KEY);
    expect(everything).not.toContain(GEMINI_KEY);
    const report = [...written.entries()].find(([filePath]) => filePath.endsWith("report.md"))[1];
    for (const heading of [
      "## Latency per turn",
      "## Tokens per turn",
      "## Cost per turn",
      "## Schema acceptance",
      "## Tool-calling behaviour",
      "Mean per turn (INR)",
    ]) {
      expect(report).toContain(heading);
    }
    const results = JSON.parse(
      [...written.entries()].find(([filePath]) => filePath.endsWith("results.json"))[1],
    );
    expect(results.turns.filter((turn) => turn.provider === "openai")).toHaveLength(2);
    expect(results.turns.filter((turn) => turn.provider === "gemini")).toHaveLength(2);
    expect(results.meta.providers.find((entry) => entry.provider === "gemini").schemaVariant).toBe(
      "json_schema",
    );
  });

  it("records which out-of-subset schemas a provider refuses", async () => {
    const refuseOneOf = (body) => JSON.stringify(body).includes("oneOf");
    const { services, written } = makeServices({ fetchFunction: acceptingFetch(refuseOneOf) });
    await main(["--limit", "1", "--provider", "openai"], ENVIRONMENT, services);
    const results = JSON.parse(
      [...written.entries()].find(([filePath]) => filePath.endsWith("results.json"))[1],
    );
    const probe = (id) => results.probes.find((entry) => entry.id === id);
    expect(probe("full_tool_set").accepted).toBe(true);
    expect(probe("one_of_union")).toMatchObject({ accepted: false, insideSubset: false });
    expect(probe("baseline_nullable")).toMatchObject({ accepted: true, insideSubset: true });
    expect(probe("one_of_union").detail).toContain("HTTP 400");
  });

  it("falls back to Gemini's older schema form when the standard one is refused", async () => {
    const refuseStandard = (body) => JSON.stringify(body).includes("parametersJsonSchema");
    const fetchFunction = vi.fn(async (url, init) => {
      const body = JSON.parse(init.body);
      if (refuseStandard(body))
        return jsonResponse({ error: { message: "Unknown name parametersJsonSchema" } }, 400);
      return jsonResponse(geminiText("Fine."));
    });
    const { services, written } = makeServices({ fetchFunction });
    expect(await main(["--limit", "1", "--provider", "gemini"], ENVIRONMENT, services)).toBe(0);
    const results = JSON.parse(
      [...written.entries()].find(([filePath]) => filePath.endsWith("results.json"))[1],
    );
    expect(results.meta.providers[0].schemaVariant).toBe("openapi");
    expect(results.turns).toHaveLength(1);
  });

  it("skips a provider's turns when its full tool set is refused", async () => {
    const { services, written, errors } = makeServices({
      fetchFunction: vi.fn(async () => jsonResponse({ error: { message: "no" } }, 400)),
    });
    expect(await main(["--limit", "1", "--provider", "openai"], ENVIRONMENT, services)).toBe(0);
    expect(errors.join(" ")).toContain("full tool set was refused");
    const results = JSON.parse(
      [...written.entries()].find(([filePath]) => filePath.endsWith("results.json"))[1],
    );
    expect(results.turns).toEqual([]);
  });

  it("says why a provider was skipped, without the key it echoed", async () => {
    const echoed = { error: { message: `Bad key ${GEMINI_KEY}` } };
    const { services, errors } = makeServices({
      fetchFunction: vi.fn(async () => jsonResponse(echoed, 400)),
    });
    await main(["--limit", "1", "--provider", "gemini"], ENVIRONMENT, services);
    const text = errors.join("\n");
    expect(text).toContain("full_tool_set (parametersJsonSchema): rejected or failed: HTTP 400");
    expect(text).toContain("full_tool_set (parameters, OpenAPI form)");
    expect(text).not.toContain(GEMINI_KEY);
  });

  it("stops at the cost limit, still writes what it has and exits with 2", async () => {
    const { services, written } = makeServices({ fetchFunction: acceptingFetch() });
    expect(
      await main(
        ["--max-cost-usd", "0.01"],
        {
          ...ENVIRONMENT,
          AI_SPIKE_OPENAI_PRICE_INPUT: "1000",
          AI_SPIKE_OPENAI_PRICE_OUTPUT: "1000",
        },
        services,
      ),
    ).toBe(2);
    const report = [...written.entries()].find(([filePath]) => filePath.endsWith("report.md"))[1];
    expect(report).toContain("stopped early at the cost limit");
  });

  it("runs the parallel prompts a second time with the switch off, and says Gemini has none", async () => {
    const { services, written } = makeServices({ fetchFunction: acceptingFetch() });
    await main(["--only", "parallel-en-01"], ENVIRONMENT, services);
    const results = JSON.parse(
      [...written.entries()].find(([filePath]) => filePath.endsWith("results.json"))[1],
    );
    const modes = results.turns.map((turn) => `${turn.provider}:${turn.parallelMode}`).sort();
    expect(modes).toEqual(["gemini:default", "gemini:off", "openai:default", "openai:off"]);
    const report = [...written.entries()].find(([filePath]) => filePath.endsWith("report.md"))[1];
    expect(report).toContain("(no switch sent)");
  });

  it("puts Tamil and Tanglish questions first in the review file", async () => {
    const { services, written } = makeServices({ fetchFunction: acceptingFetch() });
    await main(["--only", "search-en-01,search-ta-01,search-tg-01"], ENVIRONMENT, services);
    const review = [...written.entries()].find(([filePath]) => filePath.endsWith("review.md"))[1];
    expect(review.indexOf("search-ta-01")).toBeLessThan(review.indexOf("search-en-01"));
    expect(review.indexOf("search-tg-01")).toBeLessThan(review.indexOf("search-en-01"));
    expect(review).toContain("Fluency __ Facts __ Tone __ Same language __");
  });
});

describe("the spike prompt", () => {
  it("uses the lowercase product name from one constant and carries the marker", () => {
    expect(ASSISTANT_BRAND_NAME).toBe("findsprop");
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("findsprop's AI assistant");
    expect(prompt).toContain(PROMPT_CANARY);
    expect(prompt).not.toMatch(/OpenAI|Gemini|Supabase|Next\.js/);
  });
});

/**
 * The shape of one eval case (AI-P8-T01, ADR-128 section 9). A case file is plain JSON so that anyone can read and
 * extend it; this schema is the only thing that decides what a valid case is, and a file that does not fit it fails
 * loudly (`cases.ts`), never quietly skipped.
 *
 * Every case says three things: what the customer wrote (`messages`), what a well-behaved or a badly behaved model
 * does in the offline run (`script`, played by the fake provider; a real-model run ignores it), and what must be
 * true of what the CUSTOMER sees afterwards (`expect`). The expectations are about the customer-visible result, so
 * the same case measures a real model and the checks around it just as well as the scripted one.
 *
 * The customer's words here are test data only, in English, Tamil and Tanglish. Nothing in this folder is assistant
 * wording: the fixed replies come from `en.json`, and their Tamil is the owner's open decision D12.
 */
import { z } from "zod";
import { AI_ERROR_KINDS } from "@/server/ai";

export const EVAL_SETS = ["golden", "red_team"] as const;
export type EvalSet = (typeof EVAL_SETS)[number];

/** The language the customer writes in: English, Tamil script, or Tamil in English letters. */
export const EVAL_LANGUAGES = ["en", "ta", "tanglish"] as const;
export type EvalLanguage = (typeof EVAL_LANGUAGES)[number];

export const EVAL_CATEGORIES = [
  // golden
  "search",
  "property",
  "compare",
  "builder",
  "project",
  "locality",
  "emi",
  "unknown",
  "followup",
  "near_miss",
  "off_topic",
  "advice",
  "competitor",
  "propose",
  "place",
  "site_link",
  "content",
  // red team
  "internals_probe",
  "instruction_attack",
  "other_people",
  "injected_listing",
  "personal_data",
  "flooding",
  "forged_history",
  "invented_figure",
  "invented_contact",
  "invented_reference",
  "prompt_leak",
  "content_leak",
  "injected_content",
] as const;
export type EvalCategory = (typeof EVAL_CATEGORIES)[number];

/** What the customer-visible turn must come to, as the endpoint reports it. */
export const HANDLINGS = ["answered", "refused_by_input", "declined_by_model", "safe"] as const;
export type Handling = (typeof HANDLINGS)[number];

/** The rule names of the input check that a refusal may carry. */
const INPUT_TAGS = [
  "competitor",
  "injection_suspected",
  "injection_doubtful",
  "internals_probe",
  "personal_data",
  "flooding",
] as const;

/** The rule names of the output check. */
const OUTPUT_TAGS = [
  "prompt_leak",
  "internals_leak",
  "competitor",
  "contact_blocked",
  "unknown_reference",
  "advice_phrase",
  "format_stripped",
] as const;

const OUTCOMES = ["answered", "limit", "refused", "blocked", "fallback"] as const;

const messageSchema = z
  .object({ role: z.enum(["user", "assistant"]), text: z.string().min(1) })
  .strict();

// ---------------------------------------------------------------- what the fake model does (offline only)

const scriptCallSchema = z
  .object({ name: z.string().min(1), input: z.record(z.string(), z.unknown()) })
  .strict();

/** One model round: tool calls (with the text written before them, which is never shown), an answer, a refusal or a failure. */
const scriptRoundSchema = z.union([
  z.object({ calls: z.array(scriptCallSchema).min(1), text: z.string().optional() }).strict(),
  z.object({ text: z.string().min(1) }).strict(),
  z.object({ refusal: z.literal(true) }).strict(),
  z.object({ failure: z.enum(AI_ERROR_KINDS) }).strict(),
]);
export type ScriptRound = z.infer<typeof scriptRoundSchema>;

// ---------------------------------------------------------------- what must be true afterwards

/** One fact the answer must hold: a rupee amount, a plain number, or any of several words. */
const factSchema = z.union([
  z.object({ rupees: z.number().int().positive() }).strict(),
  z.object({ number: z.number().positive() }).strict(),
  z.object({ any: z.array(z.string().min(1)).min(1) }).strict(),
]);
export type Fact = z.infer<typeof factSchema>;

const toolCallExpectation = z
  .object({
    name: z.string().min(1),
    /** Arguments the call must carry. A string must be contained (any case); a number or null must be equal. */
    args: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  })
  .strict();

const expectSchema = z
  .object({
    handling: z.enum(HANDLINGS),
    /** For `refused_by_input`: the rule that must have refused it. */
    inputTag: z.enum(INPUT_TAGS).optional(),
    /** Figures and words the model's answer must hold, each checked against the answer text. */
    facts: z.array(factSchema).default([]),
    visible: z
      .object({
        /** Groups of words: every group needs at least one of its words somewhere in what the customer reads. */
        mustContain: z.array(z.array(z.string().min(1)).min(1)).default([]),
        /** Words that must not appear anywhere in what the customer reads (any case). */
        mustNotContain: z.array(z.string().min(1)).default([]),
        /** Patterns (case-insensitive) that must not match anything the customer reads. */
        mustNotMatch: z.array(z.string().min(1)).default([]),
        /** Fixed notices (en.json keys) that must be shown beside the answer. */
        notices: z.array(z.string().min(1)).default([]),
        /** The homes and projects the cards may show. When given, no other card may appear. */
        cards: z.array(z.string().min(1)).optional(),
        /** Cards that must appear (`home:<id>`, `project:<slug>`), with or without a marker in the answer. */
        showsCards: z.array(z.string().min(1)).optional(),
        /**
         * The source links the answer may draw (ADR-143 section 6.5), as the addresses the server built (`/blog/<slug>`,
         * `/faq#faq-<id>`). When given, no other source may appear; an empty list means no source at all.
         */
        sources: z.array(z.string().min(1)).optional(),
        /** Source links that must appear. */
        showsSources: z.array(z.string().min(1)).optional(),
      })
      .strict()
      .default({ mustContain: [], mustNotContain: [], mustNotMatch: [], notices: [] }),
    tools: z
      .object({
        mustCall: z.array(toolCallExpectation).default([]),
        mustNotCall: z.array(z.string().min(1)).default([]),
        /** True when no tool may run at all (a refusal, an off-topic question). */
        none: z.boolean().default(false),
      })
      .strict()
      .default({ mustCall: [], mustNotCall: [], none: false }),
    /** Text the model must never have been given (a masked phone number, a forged line). Checked on every provider call. */
    modelNeverSaw: z.array(z.string().min(1)).default([]),
    /**
     * Checks that only the scripted run can make, because a real model will not misbehave on purpose. They prove a
     * guard caught a turn that the script made go wrong.
     */
    offline: z
      .object({
        outcome: z.enum(OUTCOMES).optional(),
        inputTags: z.array(z.enum(INPUT_TAGS)).optional(),
        outputTags: z.array(z.enum(OUTPUT_TAGS)).optional(),
        /** Fixed notices (en.json keys) the scripted misbehaviour must have caused, such as the advice disclaimer. */
        notices: z.array(z.string().min(1)).optional(),
        /** `some`: the shadow number check must have counted a figure; `none`: it must have counted nothing. */
        shadowUngrounded: z.enum(["some", "none"]).optional(),
      })
      .strict()
      .default({}),
  })
  .strict();
export type Expectations = z.infer<typeof expectSchema>;

// ---------------------------------------------------------------- the case

const CASE_ID = /^[GR]-[a-z0-9]+(-[a-z0-9]+)*$/;

export const evalCaseSchema = z
  .object({
    id: z.string().regex(CASE_ID, "an id looks like G-search-01 or R-internals-03"),
    set: z.enum(EVAL_SETS),
    category: z.enum(EVAL_CATEGORIES),
    language: z.enum(EVAL_LANGUAGES),
    /** One line saying what the case checks, for the report. */
    title: z.string().min(1),
    /** The conversation as the browser sends it, ending with the customer's new message. */
    messages: z
      .array(messageSchema)
      .min(1)
      .refine((messages) => messages.at(-1)?.role === "user", {
        message: "the last message must be the customer's",
      }),
    /** Who is asking: a visitor, or a signed-in customer with a verified phone. */
    session: z.enum(["visitor", "customer"]).default("visitor"),
    /** Tools whose reads fail in this case. */
    failingTools: z.array(z.string().min(1)).default([]),
    /** The homes ticked for Compare in the customer's browser: ids only, sent as the request's page context. */
    compare: z.array(z.string().min(1)).max(3).default([]),
    /** Homes the signed-in customer owns. */
    ownedHomes: z.array(z.string().min(1)).default([]),
    /** Content modules the admin has switched off in this case (ADR-143): the assistant finds nothing in them. */
    hiddenModules: z.array(z.enum(["blog", "faq", "careers"])).default([]),
    /**
     * True when the case runs with AI place search on (ADR-142): the place-aware search tool and the place rules in
     * the prompt. A case that leaves it out runs with the tools and the prompt of the flag-off assistant.
     */
    placeSearch: z.boolean().default(false),
    /** True when the place lookup cannot answer in this case (the provider is down, out of quota or switched off). */
    placesDown: z.boolean().default(false),
    /**
     * What the fake model does in the offline run, one entry per round. `resists`: it behaves. `misbehaves`: it does
     * the wrong thing on purpose (invents a number, leaks, praises a rival) and a guard has to catch it. `none`: the
     * input check refuses the message, so the model is never called.
     */
    scriptKind: z.enum(["resists", "misbehaves", "none"]),
    script: z.array(scriptRoundSchema).default([]),
    expect: expectSchema,
  })
  .strict()
  .superRefine((value, context) => {
    const refusedByInput = value.expect.handling === "refused_by_input";
    if (refusedByInput && value.scriptKind !== "none")
      context.addIssue({
        code: "custom",
        path: ["scriptKind"],
        message: "an input refusal never calls the model: scriptKind must be none",
      });
    if (refusedByInput && value.expect.inputTag === undefined)
      context.addIssue({
        code: "custom",
        path: ["expect", "inputTag"],
        message: "an input refusal must name the rule",
      });
    if (value.scriptKind === "none" && value.script.length > 0)
      context.addIssue({
        code: "custom",
        path: ["script"],
        message: "scriptKind none means no script",
      });
    if (value.scriptKind !== "none" && value.script.length === 0)
      context.addIssue({
        code: "custom",
        path: ["script"],
        message: "the offline run needs a script",
      });
    if (value.set === "golden" && value.expect.handling === "safe")
      context.addIssue({
        code: "custom",
        path: ["expect", "handling"],
        message: "a golden case says exactly what must happen",
      });
    if (value.set === "golden" && value.scriptKind === "misbehaves")
      context.addIssue({
        code: "custom",
        path: ["scriptKind"],
        message: "a golden case's model behaves",
      });
    if (value.id.startsWith("G-") !== (value.set === "golden"))
      context.addIssue({
        code: "custom",
        path: ["id"],
        message: "a golden id starts with G-, a red-team id with R-",
      });
    for (const pattern of value.expect.visible.mustNotMatch) {
      try {
        new RegExp(pattern, "iu");
      } catch {
        context.addIssue({
          code: "custom",
          path: ["expect", "visible", "mustNotMatch"],
          message: `not a valid pattern: ${pattern}`,
        });
      }
    }
  });
export type EvalCase = z.infer<typeof evalCaseSchema>;

export const caseFileSchema = z.array(evalCaseSchema).min(1);

/**
 * Turning a tool's Zod input schema into the portable JSON Schema subset, and refusing anything outside it
 * (ADR-128 section 4.4, rule 1). One schema must work for OpenAI's strict function calling and for Gemini's
 * function declarations, so tools may use only:
 *
 * - objects, strings, numbers, integers, booleans, enums and arrays, each with an optional `description`;
 * - "not given" written as nullable (`["string", "null"]`), never as an optional field;
 * - every field listed in `required`, and `additionalProperties: false` on every object.
 *
 * No unions, `anyOf`/`oneOf`, `$ref`, recursion, `const`, `default`, patterns, formats, or length and range
 * keywords. Limits such as "at most 10 results" belong in the field's `description` and in the tool's own
 * Zod check (`.refine`), which the loop always runs before the tool (rule 2); the provider never sees them.
 *
 * Zod does the conversion (`toJSONSchema`); we then fix the four spellings that differ from the subset and
 * check what is left. The check is the gate: a schema that fails it throws `PortableSchemaError`.
 */
import { toJSONSchema, type ZodType } from "zod";
import type { AiToolDefinition, AiToolSchema } from "./types";

/** Every problem found, each starting with where it is (`$.field.inner`). */
export class PortableSchemaError extends Error {
  readonly violations: readonly string[];

  constructor(violations: readonly string[]) {
    super(`The tool schema is outside the portable subset: ${violations.join("; ")}`);
    this.name = "PortableSchemaError";
    this.violations = violations;
  }
}

type JsonObject = Record<string, unknown>;

const ALLOWED_KEYWORDS = new Set([
  "type",
  "description",
  "enum",
  "items",
  "properties",
  "required",
  "additionalProperties",
]);
const ALLOWED_TYPES = new Set(["string", "number", "integer", "boolean", "array", "object"]);
const TOOL_NAME_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The type names of a node: one name, or a list such as `["string", "null"]`. */
function typeNames(node: JsonObject): string[] {
  const { type } = node;
  if (typeof type === "string") return [type];
  if (Array.isArray(type)) return type.filter((name): name is string => typeof name === "string");
  return [];
}

// ---------------------------------------------------------------- normalising what Zod writes

/** Zod writes `z.int()` with the safe-integer bounds; they say nothing the type does not, so they are dropped. */
function dropSafeIntegerBounds(node: JsonObject): void {
  if (node.minimum === Number.MIN_SAFE_INTEGER) delete node.minimum;
  if (node.maximum === Number.MAX_SAFE_INTEGER) delete node.maximum;
}

/**
 * Zod writes a nullable enum or object as `anyOf: [X, { type: "null" }]`; the subset writes `type: [X, "null"]`
 * (and an enum lists `null`). Only that exact shape is rewritten; any other `anyOf` stays and is reported.
 */
function mergeNullable(node: JsonObject): JsonObject {
  const { anyOf, ...outer } = node;
  if (!Array.isArray(anyOf) || anyOf.length !== 2) return node;
  const nullIndex = anyOf.findIndex(
    (member) => isJsonObject(member) && member.type === "null" && Object.keys(member).length === 1,
  );
  const inner = anyOf[nullIndex === 0 ? 1 : 0];
  if (nullIndex === -1 || !isJsonObject(inner) || typeof inner.type !== "string") return node;
  const merged: JsonObject = { ...inner, ...outer, type: [inner.type, "null"] };
  if (Array.isArray(inner.enum)) merged.enum = [...inner.enum, null];
  return merged;
}

function normalise(node: unknown): unknown {
  if (!isJsonObject(node)) return node;
  const result = mergeNullable({ ...node });
  const names = typeNames(result);
  if (names.includes("integer")) dropSafeIntegerBounds(result);
  // Zod strips unknown keys by default, which is what `additionalProperties: false` says to a provider.
  if (names.includes("object") && result.additionalProperties === undefined) {
    result.additionalProperties = false;
  }
  // Zod leaves `required` out when no field is required (an empty tool input); strict providers want the list.
  if (names.includes("object") && result.required === undefined) result.required = [];
  if (isJsonObject(result.properties)) {
    result.properties = Object.fromEntries(
      Object.entries(result.properties).map(([key, value]) => [key, normalise(value)]),
    );
  }
  if (isJsonObject(result.items)) result.items = normalise(result.items);
  return result;
}

// ---------------------------------------------------------------- the check

/**
 * Everything in `schema` that is outside the portable subset, one sentence each, with where it is. An empty
 * list means the schema is portable. This is the single definition of the subset; the conformance tests of
 * the tools (P2-T01) and every adapter go through it.
 */
export function findPortableSchemaViolations(schema: unknown, location = "$"): string[] {
  if (!isJsonObject(schema)) return [`${location}: the schema must be an object`];
  const violations: string[] = [];
  for (const key of Object.keys(schema)) {
    if (!ALLOWED_KEYWORDS.has(key)) violations.push(`${location}: "${key}" is outside the subset`);
  }
  if (schema.description !== undefined && typeof schema.description !== "string") {
    violations.push(`${location}: "description" must be text`);
  }

  const names = typeNames(schema);
  const nullable = names.includes("null");
  const concrete = names.filter((name) => name !== "null");
  const concreteType = concrete[0];
  if (concrete.length !== 1 || concreteType === undefined || !ALLOWED_TYPES.has(concreteType)) {
    violations.push(`${location}: "type" must be one concrete type, optionally with "null"`);
    return violations;
  }
  if (location === "$" && (nullable || concreteType !== "object")) {
    violations.push(`${location}: the root must be an object`);
  }

  if (schema.enum !== undefined) {
    const values = Array.isArray(schema.enum) ? schema.enum : [];
    if (concreteType !== "string") violations.push(`${location}: an enum must be on a string`);
    if (values.length === 0) violations.push(`${location}: an enum needs at least one value`);
    if (values.some((value) => value !== null && typeof value !== "string")) {
      violations.push(`${location}: enum values must be strings`);
    }
    if (nullable && !values.includes(null)) {
      violations.push(`${location}: a nullable enum must list null`);
    }
  }

  if (concreteType === "object") {
    if (schema.additionalProperties !== false) {
      violations.push(`${location}: "additionalProperties" must be false`);
    }
    if (!isJsonObject(schema.properties)) {
      violations.push(`${location}: an object needs "properties"`);
    } else {
      const required = Array.isArray(schema.required) ? schema.required : [];
      for (const [key, child] of Object.entries(schema.properties)) {
        if (!required.includes(key)) {
          violations.push(
            `${location}.${key}: every field must be required (write "not given" as nullable)`,
          );
        }
        violations.push(...findPortableSchemaViolations(child, `${location}.${key}`));
      }
      for (const key of required) {
        if (typeof key !== "string" || !(key in schema.properties)) {
          violations.push(
            `${location}: "required" lists "${String(key)}", which is not a property`,
          );
        }
      }
    }
  } else if (schema.properties !== undefined || schema.required !== undefined) {
    violations.push(`${location}: only an object has "properties" and "required"`);
  }

  if (concreteType === "array") {
    if (!isJsonObject(schema.items))
      violations.push(`${location}: an array needs one "items" schema`);
    else violations.push(...findPortableSchemaViolations(schema.items, `${location}[]`));
  } else if (schema.items !== undefined) {
    violations.push(`${location}: only an array has "items"`);
  }
  return violations;
}

// ---------------------------------------------------------------- the entry points

/** The portable JSON Schema for a Zod schema, or `PortableSchemaError` with every reason it is not portable. */
export function toPortableJsonSchema(schema: ZodType): AiToolSchema {
  let generated: unknown;
  try {
    generated = toJSONSchema(schema, {
      target: "draft-07",
      io: "input",
      unrepresentable: "throw",
      cycles: "throw",
      reused: "inline",
    });
  } catch (error) {
    // Zod refuses what JSON Schema cannot say (a Date, a Map, a recursive schema): that is outside the subset.
    const reason = error instanceof Error ? error.message : "it cannot be written as JSON Schema";
    throw new PortableSchemaError([`$: ${reason}`]);
  }
  const normalised = normalise(generated);
  if (isJsonObject(normalised)) delete normalised.$schema;
  const violations = findPortableSchemaViolations(normalised);
  if (violations.length > 0) throw new PortableSchemaError(violations);
  return normalised as AiToolSchema;
}

/** What the provider is told about one tool. The name must be one both providers accept. */
export function createAiToolDefinition(tool: {
  name: string;
  description: string;
  input: ZodType;
}): AiToolDefinition {
  if (!TOOL_NAME_PATTERN.test(tool.name)) {
    throw new PortableSchemaError([
      `$: the tool name "${tool.name}" must be lowercase letters, digits and underscores, starting with a letter`,
    ]);
  }
  return {
    name: tool.name,
    description: tool.description,
    parameters: toPortableJsonSchema(tool.input),
  };
}

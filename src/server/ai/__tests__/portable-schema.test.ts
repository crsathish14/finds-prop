import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  createAiToolDefinition,
  findPortableSchemaViolations,
  PortableSchemaError,
  toPortableJsonSchema,
} from "../portable-schema";

/** The portable schema, or the violations when the schema is refused. */
function violationsOf(schema: z.ZodType): readonly string[] {
  try {
    toPortableJsonSchema(schema);
    return [];
  } catch (error) {
    if (error instanceof PortableSchemaError) return error.violations;
    throw error;
  }
}

describe("UT-ai-schema: the portable tool-schema subset (ADR-128 4.4 rule 1)", () => {
  describe("accepts", () => {
    it("an object of strings, numbers, integers, booleans, enums and arrays, all required", () => {
      const schema = toPortableJsonSchema(
        z.object({
          locality: z.string().describe("A locality name"),
          maxPrice: z.number(),
          bedrooms: z.int(),
          furnished: z.boolean(),
          kind: z.enum(["apartment", "villa"]),
          labels: z.array(z.string()),
        }),
      );
      expect(schema).toEqual({
        type: "object",
        properties: {
          locality: { type: "string", description: "A locality name" },
          maxPrice: { type: "number" },
          bedrooms: { type: "integer" },
          furnished: { type: "boolean" },
          kind: { type: "string", enum: ["apartment", "villa"] },
          labels: { type: "array", items: { type: "string" } },
        },
        required: ["locality", "maxPrice", "bedrooms", "furnished", "kind", "labels"],
        additionalProperties: false,
      });
    });

    it("a nullable field as a type with null, which is how 'not given' is written", () => {
      const schema = toPortableJsonSchema(
        z.object({ maxPrice: z.number().nullable(), locality: z.string().nullable() }),
      );
      expect(schema.properties).toEqual({
        maxPrice: { type: ["number", "null"] },
        locality: { type: ["string", "null"] },
      });
      expect(schema.required).toEqual(["maxPrice", "locality"]);
    });

    it("a nullable enum, which lists null among its values", () => {
      const schema = toPortableJsonSchema(z.object({ kind: z.enum(["buy", "rent"]).nullable() }));
      expect(schema.properties).toEqual({
        kind: { type: ["string", "null"], enum: ["buy", "rent", null] },
      });
    });

    it("an object inside an object and an array of objects, each closed to extra fields", () => {
      const schema = toPortableJsonSchema(
        z.object({
          range: z.object({ low: z.number(), high: z.number() }),
          homes: z.array(z.object({ id: z.string() })),
        }),
      );
      expect(findPortableSchemaViolations(schema)).toEqual([]);
      const properties = schema.properties as Record<string, { additionalProperties?: unknown }>;
      expect(properties.range?.additionalProperties).toBe(false);
    });

    it("a nullable field's description, kept on the merged field", () => {
      const schema = toPortableJsonSchema(
        z.object({
          kind: z.enum(["buy", "rent"]).nullable().describe("Buy or rent; null if not said"),
        }),
      );
      expect(schema.properties).toEqual({
        kind: {
          type: ["string", "null"],
          enum: ["buy", "rent", null],
          description: "Buy or rent; null if not said",
        },
      });
    });

    it("rules written with refine, which the loop runs itself and the provider never sees", () => {
      const schema = toPortableJsonSchema(
        z.object({ limit: z.int().refine((value) => value >= 1 && value <= 10, "1 to 10") }),
      );
      expect(findPortableSchemaViolations(schema)).toEqual([]);
    });

    it("an empty object, for a tool that takes nothing", () => {
      expect(toPortableJsonSchema(z.object({}))).toEqual({
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false,
      });
    });

    it("leaves no $schema marker in the result", () => {
      expect(toPortableJsonSchema(z.object({ field: z.string() }))).not.toHaveProperty("$schema");
    });
  });

  describe("rejects", () => {
    const cases: [name: string, schema: z.ZodType, expected: string][] = [
      [
        "an optional field",
        z.object({ field: z.string().optional() }),
        "$.field: every field must be required",
      ],
      [
        "a field with a default",
        z.object({ field: z.string().default("x") }),
        '"default" is outside the subset',
      ],
      [
        "a union of two types",
        z.object({ field: z.union([z.string(), z.number()]) }),
        '"type" must be one concrete type',
      ],
      [
        "a union of objects",
        z.object({
          field: z.union([z.object({ first: z.string() }), z.object({ second: z.string() })]),
        }),
        '"anyOf" is outside the subset',
      ],
      ["a literal", z.object({ field: z.literal("x") }), '"const" is outside the subset'],
      [
        "a string length limit",
        z.object({ field: z.string().max(5) }),
        '"maxLength" is outside the subset',
      ],
      [
        "a number range",
        z.object({ field: z.number().min(1).max(10) }),
        '"minimum" is outside the subset',
      ],
      ["an integer range", z.object({ field: z.int().min(1) }), '"minimum" is outside the subset'],
      [
        "a string pattern",
        z.object({ field: z.string().regex(/^[a-z]+$/) }),
        '"pattern" is outside the subset',
      ],
      ["a string format", z.object({ field: z.email() }), '"format" is outside the subset'],
      [
        "an array length limit",
        z.object({ field: z.array(z.string()).max(3) }),
        '"maxItems" is outside the subset',
      ],
      [
        "a tuple",
        z.object({ field: z.tuple([z.string(), z.number()]) }),
        '"additionalItems" is outside the subset',
      ],
      [
        "a record",
        z.object({ field: z.record(z.string(), z.string()) }),
        '"propertyNames" is outside the subset',
      ],
      [
        "an object that allows extra keys",
        z.looseObject({ field: z.string() }),
        '"additionalProperties" must be false',
      ],
      ["a root that is not an object", z.string(), "$: the root must be an object"],
      [
        "a nullable root",
        z.object({ field: z.string() }).nullable(),
        "$: the root must be an object",
      ],
      [
        "a Date, which JSON Schema cannot say",
        z.object({ field: z.date() }),
        "Date cannot be represented",
      ],
      ["a number enum", z.object({ field: z.literal([1, 2]) }), "enum values must be strings"],
    ];

    it.each(cases)("%s", (_name, schema, expected) => {
      const violations = violationsOf(schema);
      expect(violations.length).toBeGreaterThan(0);
      expect(violations.join(" | ")).toContain(expected);
    });

    it("a recursive schema", () => {
      const node: z.ZodType = z.object({
        name: z.string(),
        get child() {
          return node.nullable();
        },
      });
      expect(violationsOf(node).length).toBeGreaterThan(0);
    });

    it("reports every problem at once, each with where it is", () => {
      const violations = violationsOf(
        z.object({
          field: z.string().optional(),
          second: z.string().max(3),
          third: z.union([z.string(), z.number()]),
        }),
      );
      expect(violations.some((entry) => entry.startsWith("$.field:"))).toBe(true);
      expect(violations.some((entry) => entry.startsWith("$.second:"))).toBe(true);
      expect(violations.some((entry) => entry.startsWith("$.third:"))).toBe(true);
    });

    it("throws a PortableSchemaError that lists the violations in its message", () => {
      expect(() => toPortableJsonSchema(z.object({ field: z.string().optional() }))).toThrow(
        PortableSchemaError,
      );
      expect(() => toPortableJsonSchema(z.object({ field: z.string().optional() }))).toThrow(
        /outside the portable subset: \$\.field/,
      );
    });
  });

  describe("findPortableSchemaViolations on hand-written schemas", () => {
    const valid = {
      type: "object",
      properties: { field: { type: "string" } },
      required: ["field"],
      additionalProperties: false,
    };

    it("passes a schema inside the subset", () => {
      expect(findPortableSchemaViolations(valid)).toEqual([]);
    });

    it("refuses $ref, oneOf and $defs wherever they appear", () => {
      expect(findPortableSchemaViolations({ ...valid, $defs: {} }).join()).toContain('"$defs"');
      expect(
        findPortableSchemaViolations({
          ...valid,
          properties: { field: { $ref: "#/$defs/x" } },
        }).join(),
      ).toContain('"$ref"');
      expect(
        findPortableSchemaViolations({
          ...valid,
          properties: { field: { oneOf: [{ type: "string" }, { type: "number" }] } },
        }).join(),
      ).toContain('"oneOf"');
    });

    it("refuses a required list that names a field that does not exist", () => {
      expect(
        findPortableSchemaViolations({ ...valid, required: ["field", "ghost"] }).join(),
      ).toContain('"required" lists "ghost"');
    });

    it("refuses a nullable enum that does not list null", () => {
      const schema = {
        ...valid,
        properties: { field: { type: ["string", "null"], enum: ["x"] } },
      };
      expect(findPortableSchemaViolations(schema).join()).toContain(
        "a nullable enum must list null",
      );
    });

    it("refuses an array without items, and items on something that is not an array", () => {
      expect(
        findPortableSchemaViolations({ ...valid, properties: { field: { type: "array" } } }).join(),
      ).toContain('an array needs one "items" schema');
      expect(
        findPortableSchemaViolations({
          ...valid,
          properties: { field: { type: "string", items: { type: "string" } } },
        }).join(),
      ).toContain('only an array has "items"');
    });

    it("refuses something that is not a schema at all", () => {
      expect(findPortableSchemaViolations(null)).toEqual(["$: the schema must be an object"]);
      expect(findPortableSchemaViolations([])).toEqual(["$: the schema must be an object"]);
    });
  });

  describe("createAiToolDefinition", () => {
    it("builds what the provider is told: a name, a description and the portable schema", () => {
      const definition = createAiToolDefinition({
        name: "search_properties",
        description: "Find homes",
        input: z.object({ locality: z.string().nullable() }),
      });
      expect(definition.name).toBe("search_properties");
      expect(definition.description).toBe("Find homes");
      expect(findPortableSchemaViolations(definition.parameters)).toEqual([]);
    });

    it("refuses a tool name a provider may not accept", () => {
      for (const name of ["Search", "search-properties", "1search", "", "field".repeat(65)]) {
        expect(() =>
          createAiToolDefinition({ name, description: "x", input: z.object({}) }),
        ).toThrow(PortableSchemaError);
      }
    });

    it("refuses a tool whose input is outside the subset", () => {
      expect(() =>
        createAiToolDefinition({
          name: "bad_tool",
          description: "x",
          input: z.object({ field: z.string().optional() }),
        }),
      ).toThrow(PortableSchemaError);
    });
  });
});

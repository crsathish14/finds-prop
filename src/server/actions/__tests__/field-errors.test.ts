import { describe, expect, it } from "vitest";
import { z } from "zod";
import { FORM_LEVEL, toFieldErrors } from "../field-errors";

function errorsOf(schema: z.ZodType, value: unknown) {
  const parsed = schema.safeParse(value);
  if (parsed.success) throw new Error("expected the value to fail");
  return toFieldErrors(parsed.error, value);
}

describe("UT-field-errors: Zod issues become message keys, never English", () => {
  it("a missing or empty field is required, a wrong type is invalid", () => {
    const schema = z.object({ name: z.string(), age: z.number(), city: z.number() });
    expect(errorsOf(schema, { age: "x", city: "" })).toEqual({
      name: [{ key: "validation.required" }],
      age: [{ key: "validation.invalid" }],
      city: [{ key: "validation.required" }],
    });
  });

  it("string length gives tooShort and tooLong with the limit", () => {
    const schema = z.object({ code: z.string().min(3).max(5) });
    expect(errorsOf(schema, { code: "ab" })).toEqual({
      code: [{ key: "validation.tooShort", values: { minimum: 3 } }],
    });
    expect(errorsOf(schema, { code: "abcdefg" })).toEqual({
      code: [{ key: "validation.tooLong", values: { maximum: 5 } }],
    });
  });

  it("number range gives tooSmall and tooBig", () => {
    const schema = z.object({ bhk: z.number().min(1).max(4) });
    expect(errorsOf(schema, { bhk: 0 }).bhk).toEqual([
      { key: "validation.tooSmall", values: { minimum: 1 } },
    ]);
    expect(errorsOf(schema, { bhk: 9 }).bhk).toEqual([
      { key: "validation.tooBig", values: { maximum: 4 } },
    ]);
  });

  it("a bad format gives invalidFormat", () => {
    expect(errorsOf(z.object({ id: z.uuid() }), { id: "nope" }).id).toEqual([
      { key: "validation.invalidFormat" },
    ]);
  });

  it("a schema can choose its own key through the message", () => {
    const schema = z.object({
      phone: z.string().regex(/^[6-9]\d{9}$/, { error: "validation.phoneInvalid" }),
    });
    expect(errorsOf(schema, { phone: "123" }).phone).toEqual([{ key: "validation.phoneInvalid" }]);
  });

  it("free text from a schema is never passed through", () => {
    const schema = z.object({ a: z.string().refine(() => false, { error: "Please fix a" }) });
    const out = errorsOf(schema, { a: "x" });
    expect(JSON.stringify(out)).not.toContain("Please fix a");
    expect(out.a).toEqual([{ key: "validation.invalid" }]);
  });

  it("collects several problems per field and uses a dotted path for nested fields", () => {
    const schema = z.object({ address: z.object({ pin: z.string().min(6) }) });
    expect(Object.keys(errorsOf(schema, { address: { pin: "1" } }))).toEqual(["address.pin"]);
  });

  it("an error on the whole value goes under the form-level name", () => {
    expect(Object.keys(errorsOf(z.string(), 5))).toEqual([FORM_LEVEL]);
  });
});

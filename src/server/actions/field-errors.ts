import type { z } from "zod";
import type { FieldError } from "@/types/action";

/**
 * Turns Zod issues into message keys the screen can translate (ADR-035). Zod's own English text
 * is never returned. A schema can choose its own key by passing it as the message:
 *   z.string().regex(PHONE, { error: "validation.phoneInvalid" })
 */
const OWN_KEY = /^validation\.[A-Za-z][A-Za-z0-9]*$/;

export const FORM_LEVEL = "_form";

/** The submitted value at a path, to tell a missing field from a wrong one (Zod omits the input). */
function valueAt(data: unknown, path: readonly PropertyKey[]): unknown {
  let current = data;
  for (const part of path) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<PropertyKey, unknown>)[part];
  }
  return current;
}

function describe(issue: z.core.$ZodIssue, data: unknown): FieldError {
  if (OWN_KEY.test(issue.message)) return { key: issue.message };
  switch (issue.code) {
    case "invalid_type": {
      const value = valueAt(data, issue.path);
      const missing = value === undefined || value === null || value === "";
      return { key: missing ? "validation.required" : "validation.invalid" };
    }
    case "too_small":
      return {
        key: issue.origin === "string" ? "validation.tooShort" : "validation.tooSmall",
        values: { minimum: Number(issue.minimum) },
      };
    case "too_big":
      return {
        key: issue.origin === "string" ? "validation.tooLong" : "validation.tooBig",
        values: { maximum: Number(issue.maximum) },
      };
    case "invalid_format":
      return { key: "validation.invalidFormat" };
    default:
      return { key: "validation.invalid" };
  }
}

export function toFieldErrors(error: z.ZodError, data?: unknown): Record<string, FieldError[]> {
  const out: Record<string, FieldError[]> = {};
  for (const issue of error.issues) {
    const field = issue.path.length > 0 ? issue.path.map(String).join(".") : FORM_LEVEL;
    (out[field] ??= []).push(describe(issue, data));
  }
  return out;
}

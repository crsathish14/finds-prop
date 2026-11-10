import { z } from "zod";
import {
  BLOCKED_HEADERS,
  CRM_METHODS,
  LEAD_ID_PATH_MAX,
  LEAD_SOURCE_MAX,
  NAME_MAX,
  PATH_MAX,
  ROWS_MAX,
  ROW_VALUE_MAX,
  SECRET_MAX,
  URL_MAX,
} from "./constants";

/**
 * What the admin's CRM screen sends (S7-T09, FR-ADM-09, BR-64, BR-65). Nothing here says who is saving: the admin is the
 * signed-in session (R-BE-03). A schema message is a key under `validation.*`; the screen looks the words up
 * (ADR-035). The headers, the body mapping and the project codes arrive as lists of rows, as the screen draws them,
 * so a repeated name can be pointed at; the service turns them into the objects the table stores. Whether the
 * address is a public one is decided by `assertSafeUrl` in the service, which needs the network; here only its shape.
 */
const uuid = z.uuid({ error: "validation.invalid" }).transform((value) => value.toLowerCase());

const tidy = (typed: unknown): unknown =>
  typeof typed === "string" ? typed.trim().replace(/[ \t]+/g, " ") : typed;

/** A blank box clears an optional text (null); a value not given is left out. */
const clearable = <T extends z.ZodType>(rule: T) =>
  z
    .preprocess(
      (typed) => (typeof typed === "string" && typed.trim() === "" ? null : typed),
      rule.nullable(),
    )
    .optional();

const HEADER_NAME = /^[A-Za-z][A-Za-z0-9-]{0,39}$/;
const BODY_FIELD = /^[A-Za-z_][A-Za-z0-9_.-]{0,59}$/;
/** No line breaks in a value that becomes a header or a body text. */
const ONE_LINE = /^[^\r\n]*$/;

const rowValue = z
  .string({ error: "validation.required" })
  .max(ROW_VALUE_MAX, { error: "validation.invalid" })
  .regex(ONE_LINE, { error: "validation.invalid" });

const headerRow = z.object({
  name: z.preprocess(
    tidy,
    z
      .string({ error: "validation.required" })
      .regex(HEADER_NAME, { error: "validation.invalid" })
      .refine((name) => !(BLOCKED_HEADERS as readonly string[]).includes(name.toLowerCase()), {
        error: "validation.invalid",
      }),
  ),
  value: rowValue,
});

const mappingRow = z.object({
  field: z.preprocess(
    tidy,
    z.string({ error: "validation.required" }).regex(BODY_FIELD, { error: "validation.invalid" }),
  ),
  value: rowValue,
});

const codeRow = z.object({
  projectId: uuid,
  code: z.preprocess(
    tidy,
    z
      .string({ error: "validation.required" })
      .min(1, { error: "validation.required" })
      .max(80, { error: "validation.invalid" }),
  ),
});

/** A secret: left alone keeps what is stored, text sets it, null clears it. A blank box is "left alone". */
const secret = z
  .preprocess(
    (typed) => (typeof typed === "string" && typed.trim() === "" ? undefined : tidy(typed)),
    z
      .string({ error: "validation.invalid" })
      .max(SECRET_MAX, { error: "validation.invalid" })
      .regex(ONE_LINE, { error: "validation.invalid" })
      .nullable()
      .optional(),
  )
  .optional();

const secrets = z.object({ apiKey: secret, apiSecret: secret, accessToken: secret }).optional();

const details = {
  name: z.preprocess(
    tidy,
    z
      .string({ error: "validation.required" })
      .min(2, { error: "validation.required" })
      .max(NAME_MAX, { error: "validation.invalid" }),
  ),
  leadSource: clearable(z.preprocess(tidy, z.string().max(LEAD_SOURCE_MAX))),
  baseUrl: z
    .string({ error: "validation.required" })
    .trim()
    .min(1, { error: "validation.required", abort: true })
    .max(URL_MAX, { error: "validation.crmUrlNotAllowed" })
    .regex(/^https:\/\/[^\s/]+[^\s]*$/, { error: "validation.crmUrlNotAllowed" }),
  endpoint: clearable(
    z
      .string()
      .trim()
      .max(PATH_MAX, { error: "validation.invalid" })
      .regex(/^\/[^\s]*$/, { error: "validation.invalid" }),
  ),
  method: z.enum(CRM_METHODS, { error: "validation.invalid" }),
  leadIdPath: clearable(
    z
      .string()
      .trim()
      .max(LEAD_ID_PATH_MAX, { error: "validation.invalid" })
      .regex(/^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*$/, { error: "validation.invalid" }),
  ),
  active: z.boolean({ error: "validation.invalid" }).default(true),
  headers: z.array(headerRow).max(ROWS_MAX, { error: "validation.invalid" }).default([]),
  bodyMapping: z.array(mappingRow).max(ROWS_MAX, { error: "validation.invalid" }).default([]),
  projectCodes: z.array(codeRow).max(200, { error: "validation.invalid" }).default([]),
  secrets,
};

/** Rows whose name appears twice; the message goes on the second one. */
function repeated(
  rows: readonly { name?: string; field?: string; projectId?: string }[],
  list: string,
  problems: z.RefinementCtx,
): void {
  const seen = new Set<string>();
  rows.forEach((row, index) => {
    const key = (row.name ?? row.field ?? row.projectId ?? "").toLowerCase();
    if (seen.has(key)) {
      problems.addIssue({
        code: "custom",
        path: [
          list,
          index,
          row.projectId === undefined ? (row.name === undefined ? "field" : "name") : "projectId",
        ],
        message: "validation.localityLabelTaken",
      });
    }
    seen.add(key);
  });
}

function crossRules(
  value: {
    headers: { name: string }[];
    bodyMapping: { field: string }[];
    projectCodes: { projectId: string }[];
  },
  problems: z.RefinementCtx,
): void {
  repeated(value.headers, "headers", problems);
  repeated(value.bodyMapping, "bodyMapping", problems);
  repeated(value.projectCodes, "projectCodes", problems);
}

/** A new connection, or (with `integrationId`) changes to one that exists. */
export const saveIntegrationSchema = z
  .object({ integrationId: uuid.optional(), ...details })
  .superRefine(crossRules);
export type SaveIntegrationInput = z.infer<typeof saveIntegrationSchema>;

export const deleteIntegrationSchema = z.object({ integrationId: uuid });
export type DeleteIntegrationInput = z.infer<typeof deleteIntegrationSchema>;

export const testIntegrationSchema = z.object({ integrationId: uuid });
export type TestIntegrationInput = z.infer<typeof testIntegrationSchema>;

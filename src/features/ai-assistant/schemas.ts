import { z } from "zod";

/** The highest credit the box takes, in US dollars (the column is numeric(10, 2)). */
export const CREDIT_BOUGHT_MAX_USD = 99_999_999.99;

/**
 * The credit bought as typed (ADR-218, piece 7): an empty box is null (none typed), otherwise US dollars with at most
 * two decimals, from 0. A dollar sign, commas and spaces are allowed and dropped.
 */
const creditInput = z.preprocess(
  (typed) => {
    if (typed === null || typed === undefined) return null;
    if (typeof typed !== "string") return typed;
    const plain = typed.replace(/[$,\s]/g, "");
    if (plain === "") return null;
    return /^\d+(\.\d{1,2})?$/.test(plain) ? Number(plain) : typed;
  },
  z
    .number({ error: "validation.numberInvalid" })
    .min(0, { error: "validation.numberInvalid" })
    .max(CREDIT_BOUGHT_MAX_USD, { error: "validation.numberInvalid" })
    .nullable(),
);

/** The admin AI assistant page's save: the Web search switch and the credit bought. */
export const aiAssistantInputSchema = z.object({
  webSearch: z.boolean({ error: "validation.invalid" }),
  creditBoughtUsd: creditInput,
});
export type AiAssistantInput = z.infer<typeof aiAssistantInputSchema>;

import { z } from "zod";
import { PAGE_TOPICS, type PageTopic } from "./topics";

/**
 * What the "Pages for the AI assistant" panel sends (AI search Phase 4). Up to three rows, each an address and what
 * the page is about; a row with an empty address is left out. The database checks the same rules again.
 */

export const RESEARCH_LINKS_MAX = 3;
export const RESEARCH_URL_MAX = 2000;

const url = z.preprocess(
  (typed) => (typeof typed === "string" ? typed.trim() : typed),
  z.string().max(RESEARCH_URL_MAX, { error: "validation.invalid" }),
);

const link = z
  .object({
    url,
    topic: z.string(),
  })
  .superRefine((row, context) => {
    if (row.url === "") return;
    if (!(PAGE_TOPICS as readonly string[]).includes(row.topic)) {
      context.addIssue({ code: "custom", path: ["topic"], message: "validation.required" });
    }
    let parsed: URL | null = null;
    try {
      parsed = new URL(row.url);
    } catch {
      parsed = null;
    }
    if (parsed === null || parsed.protocol !== "https:") {
      context.addIssue({ code: "custom", path: ["url"], message: "validation.linkInvalid" });
    }
  });

const links = z
  .array(link)
  .max(RESEARCH_LINKS_MAX, { error: "validation.invalid" })
  .transform((rows) =>
    // Each kept row remembers its box, so a page that cannot be read is said under the box it was typed in.
    rows.flatMap((row, box) =>
      row.url === "" ? [] : [{ box, url: row.url, topic: row.topic as PageTopic }],
    ),
  );

export const saveMyResearchPagesSchema = z.object({ links });
export const readMyPagesAgainSchema = z.object({});

const builderId = z.uuid({ error: "validation.invalid" }).transform((value) => value.toLowerCase());
export const saveBuilderResearchPagesSchema = z.object({ builderId, links });
export const readBuilderPagesAgainSchema = z.object({ builderId });

export interface ResearchLinkInput {
  readonly box: number;
  readonly url: string;
  readonly topic: PageTopic;
}
export type SaveMyResearchPagesInput = z.infer<typeof saveMyResearchPagesSchema>;
export type SaveBuilderResearchPagesInput = z.infer<typeof saveBuilderResearchPagesSchema>;

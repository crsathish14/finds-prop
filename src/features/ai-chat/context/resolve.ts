import "server-only";
import { z } from "zod";
import { COMPARE_MAX, COMPARE_MIN } from "@/features/compare";
import { isProjectSlug } from "@/features/projects";
import { isShortId } from "@/lib/short-id";
import type { ChatContext } from "./page-context";

/**
 * Step "context" of the endpoint and of the page (AI-P7-T01): turns what the browser says into what the server
 * has checked. The browser's context is never trusted: each id must have the shape of an id, and name something
 * that is listed now (a real, open home or project). Anything else is dropped without a word, so a bad, stale or
 * forged link opens the chat with no context and no error. The result holds ids only.
 */

/** The reads that decide whether an item is open now: the same cached public reads the pages use. */
export interface ContextReads {
  /** Whether a home with this public id is listed now. */
  homeIsOpen(shortId: string): Promise<boolean>;
  /** Whether a project with this slug is listed now. */
  projectIsOpen(slug: string): Promise<boolean>;
  /** Which of these public ids are listed now, in the order given. */
  openHomeIds(shortIds: readonly string[]): Promise<readonly string[]>;
}

/** Loose on purpose: a wrong shape is "no context", never a refused request. */
const rawContextSchema = z.object({
  home: z.string().max(64).optional(),
  project: z.string().max(160).optional(),
  compare: z.array(z.string().max(64)).max(50).optional(),
});

function tidy(text: string): string {
  return text.trim().toLowerCase();
}

/** The ids of a compare list that look like ids, each once, at most the compare limit. */
export function cappedCompareIds(raw: readonly string[]): string[] {
  const ids: string[] = [];
  for (const part of raw) {
    const id = tidy(part);
    if (isShortId(id) && !ids.includes(id)) ids.push(id);
    if (ids.length >= COMPARE_MAX) break;
  }
  return ids;
}

export async function resolveContext(
  raw: unknown,
  reads: ContextReads,
): Promise<ChatContext | null> {
  const parsed = rawContextSchema.safeParse(raw);
  if (!parsed.success) return null;
  const { home, project, compare } = parsed.data;
  const context: { home?: string; project?: string; compare?: readonly string[] } = {};

  const homeId = home === undefined ? "" : tidy(home);
  if (isShortId(homeId) && (await reads.homeIsOpen(homeId))) context.home = homeId;

  const slug = project === undefined ? "" : tidy(project);
  if (isProjectSlug(slug) && (await reads.projectIsOpen(slug))) context.project = slug;

  const compareIds = cappedCompareIds(compare ?? []);
  if (compareIds.length >= COMPARE_MIN) {
    const open = await reads.openHomeIds(compareIds);
    if (open.length >= COMPARE_MIN) context.compare = open.slice(0, COMPARE_MAX);
  }
  return Object.keys(context).length === 0 ? null : context;
}

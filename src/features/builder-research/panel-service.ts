import type { SupabaseClient } from "@supabase/supabase-js";
import { ActionError } from "@/server/actions/normalise-error";
import type { Database } from "@/types/database.types";
import { PAGE_PROBLEMS, PROBLEM_KEYS } from "./problems";
import type { PageProblem } from "./reader.server";
import type { ResearchLinkInput } from "./schemas";
import { siteOf } from "./site";
import { PAGE_TOPICS, type PageTopic } from "./topics";

/**
 * The "Pages for the AI assistant" panel (AI search Phase 4, owner decisions 27 Nov 2026), on the builder's profile
 * and on the admin's page for one builder. Everything runs with the signed-in person's own client, so the database
 * decides who may see and change which builder: the builder its own, the super admin any.
 *
 * - Saving checks every page first and saves nothing while one of them cannot be read (the owner's rule: the extra
 *   pages are only for the assistant, so an unreadable one is no use). The website itself is never refused; it is
 *   checked after the save and a warning is shown when it cannot be read.
 * - Saving, and "Read again", delete the builder's saved copies, so the assistant reads the pages fresh next time.
 */

type Client = SupabaseClient<Database>;

export interface ResearchLinkView {
  readonly url: string;
  readonly topic: PageTopic;
}

export interface ResearchProblemView {
  readonly url: string;
  /** When the failed check or read happened (ISO). */
  readonly at: string;
  readonly problem: PageProblem;
}

export interface ResearchPanelView {
  readonly builderId: string;
  readonly name: string;
  readonly website: string | null;
  /** The website's site (its host without `www.`), named in the "not on your website" message. */
  readonly site: string | null;
  readonly links: readonly ResearchLinkView[];
  /** The last check or read of the home page, when it failed. */
  readonly websiteProblem: ResearchProblemView | null;
  /** For each saved page whose last check or read failed, that failure. */
  readonly problems: readonly ResearchProblemView[];
}

export interface PageChecker {
  check(input: {
    builderId: string;
    url: string;
    website: string;
  }): Promise<{ readable: true } | { readable: false; problem: PageProblem }>;
}

/** How many log lines are looked at for the panel: three pages and the website, read many times, fit well inside. */
const LOG_LINES = 200;

function isPageTopic(value: string): value is PageTopic {
  return (PAGE_TOPICS as readonly string[]).includes(value);
}

function isProblem(value: string | null): value is PageProblem {
  return value !== null && (PAGE_PROBLEMS as readonly string[]).includes(value);
}

function failed(message: string): ActionError {
  return new ActionError("INTERNAL", message);
}

async function websiteOf(client: Client, builderId: string): Promise<string | null> {
  const found = await client.from("builders").select("website").eq("id", builderId);
  if (found.error) throw failed("The builder could not be read");
  const row = found.data[0];
  if (row === undefined) throw new ActionError("NOT_FOUND", "The builder was not found");
  return row.website;
}

/** What the panel shows for one builder; null when the person cannot see that builder. */
export async function loadResearchPanel(
  client: Client,
  builderId: string,
): Promise<ResearchPanelView | null> {
  const [builder, links, log] = await Promise.all([
    client.from("builders").select("name, website").eq("id", builderId),
    client
      .from("builder_research_links")
      .select("url, topic, position")
      .eq("builder_id", builderId)
      .order("position"),
    client
      .from("builder_research_reads")
      .select("url, ok, problem, created_at")
      .eq("builder_id", builderId)
      .order("created_at", { ascending: false })
      .limit(LOG_LINES),
  ]);
  if (builder.error || links.error || log.error)
    throw failed("The research panel could not be read");
  const row = builder.data[0];
  if (row === undefined) return null;

  // The log is newest first: the first line for an address is its latest.
  const latest = new Map<string, ResearchProblemView | "ok">();
  for (const line of log.data) {
    if (latest.has(line.url)) continue;
    latest.set(
      line.url,
      line.ok || !isProblem(line.problem)
        ? "ok"
        : { url: line.url, at: line.created_at, problem: line.problem },
    );
  }
  const problemOf = (url: string): ResearchProblemView | null => {
    const found = latest.get(url);
    return found === undefined || found === "ok" ? null : found;
  };

  const saved = links.data.flatMap((link) =>
    isPageTopic(link.topic) ? [{ url: link.url, topic: link.topic }] : [],
  );
  return {
    builderId,
    name: row.name,
    website: row.website,
    site: row.website === null ? null : siteOf(row.website),
    links: saved,
    websiteProblem: row.website === null ? null : problemOf(row.website),
    problems: saved.flatMap((link) => {
      const problem = problemOf(link.url);
      return problem === null ? [] : [problem];
    }),
  };
}

/**
 * Saves a builder's extra pages (the whole list at once), after checking each can be read. Returns whether the
 * website's home page can be read, for the warning.
 */
export async function saveResearchPages(
  client: Client,
  checker: PageChecker,
  input: { readonly builderId: string; readonly links: readonly ResearchLinkInput[] },
): Promise<{ builderId: string; websiteReadable: boolean | null }> {
  const { builderId } = input;
  const website = await websiteOf(client, builderId);
  const site = website === null ? null : siteOf(website);
  if (input.links.length > 0 && (website === null || site === null)) {
    throw new ActionError("VALIDATION", "The builder has no website", {
      fieldErrors: { _form: [{ key: "builderResearch.noWebsiteSaved" }] },
    });
  }

  // Every page is checked, in parallel, before anything is saved.
  if (website !== null && site !== null && input.links.length > 0) {
    const checks = await Promise.all(
      input.links.map((link) => checker.check({ builderId, url: link.url, website })),
    );
    const fieldErrors: Record<string, Array<{ key: string; values?: Record<string, string> }>> = {};
    checks.forEach((result, index) => {
      const link = input.links[index];
      if (result.readable || link === undefined) return;
      fieldErrors[`links.${link.box}.url`] = [
        { key: `builderResearch.problem.${PROBLEM_KEYS[result.problem]}`, values: { site } },
      ];
    });
    if (Object.keys(fieldErrors).length > 0) {
      throw new ActionError("VALIDATION", "A page cannot be read", { fieldErrors });
    }
  }

  const saved = await client.rpc("save_builder_research_links", {
    p_builder: builderId,
    p_links: input.links.map((link) => ({ url: link.url, topic: link.topic })),
  });
  if (saved.error) {
    if (saved.error.code === "42501") throw new ActionError("FORBIDDEN", "Not this builder");
    if (saved.error.code === "P0002")
      throw new ActionError("NOT_FOUND", "The builder was not found");
    if (saved.error.code === "22023" || saved.error.code === "55000") {
      throw new ActionError("VALIDATION", "The pages were refused", {
        fieldErrors: { _form: [{ key: "validation.invalid" }] },
      });
    }
    throw failed("The pages could not be saved");
  }
  await forgetSavedCopies(client, builderId);

  if (website === null || site === null) return { builderId, websiteReadable: null };
  const home = await checker.check({ builderId, url: website, website });
  return { builderId, websiteReadable: home.readable };
}

/** "Read again": deletes the builder's saved copies; the assistant reads the pages fresh the next time. */
export async function forgetSavedCopies(client: Client, builderId: string): Promise<void> {
  const removed = await client.from("builder_research_pages").delete().eq("builder_id", builderId);
  if (removed.error) throw failed("The saved copies could not be removed");
}

/** The signed-in builder's own record id, or a NOT_FOUND. */
export async function myBuilderId(client: Client): Promise<string> {
  const mine = await client.rpc("my_builder").select("id");
  if (mine.error) throw failed("The builder could not be read");
  const id = mine.data[0]?.id;
  if (!id) throw new ActionError("NOT_FOUND", "The builder was not found");
  return id;
}

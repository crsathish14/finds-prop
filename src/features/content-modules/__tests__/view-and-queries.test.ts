import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SITE_DEFAULTS } from "@/features/site/defaults";

vi.mock("server-only", () => ({}));
const logger = vi.hoisted(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }));
vi.mock("@/server/logger", () => ({ logger }));
const site = vi.hoisted(() => ({ getSiteSettings: vi.fn() }));
vi.mock("@/features/site", async () => {
  // The pure parts of the site feature are real; only the cached read is replaced.
  const modules = await import("@/features/site/modules");
  return { ...modules, getSiteSettings: site.getSiteSettings };
});
const supabase = vi.hoisted(() => ({ createServerSupabase: vi.fn() }));
vi.mock("@/server/supabase/server", () => supabase);

const { getContentModulesView, readModuleCounts } = await import("../queries");
const { toModulesView } = await import("../view");

type Answer = { count: number | null; error: { code: string } | null };

/**
 * A client whose `from(table).select().eq("status", x).is("deleted_at", null)` answers from a table of
 * answers by `table:status`, and remembers what was asked.
 */
function clientAnswering(answers: Record<string, Answer>) {
  const asked: { table: string; status: string; deleted: unknown }[] = [];
  const client = {
    from: (table: string) => ({
      select: (columns: string, options: unknown) => {
        expect(columns).toBe("id");
        expect(options).toEqual({ count: "exact", head: true });
        return {
          eq: (_column: string, status: string) => ({
            is: async (column: string, deleted: unknown) => {
              expect(column).toBe("deleted_at");
              asked.push({ table, status, deleted });
              return answers[`${table}:${status}`] ?? { count: 0, error: null };
            },
          }),
        };
      },
    }),
  } as unknown as SupabaseClient;
  return { client, asked };
}

const MISSING: Answer = { count: null, error: { code: "42P01" } };

beforeEach(() => {
  logger.error.mockClear();
});

describe("UT-content-modules-view: the switches and the counts together (ADR-143)", () => {
  it("lists the three modules in the shared order with each switch and its counts", () => {
    const view = toModulesView(
      { ...SITE_DEFAULTS, content_modules: { blog: false, faq: true, careers: true } },
      {
        blog: { published: 3, drafts: 1 },
        faq: { published: null, drafts: null },
        careers: { published: 0, drafts: 0 },
      },
    );
    expect(view).toEqual([
      { module: "blog", live: false, published: 3, drafts: 1 },
      { module: "faq", live: true, published: null, drafts: null },
      { module: "careers", live: true, published: 0, drafts: 0 },
    ]);
  });
});

describe("UT-content-modules-counts: published and draft items per module (ADR-143)", () => {
  it("counts published and draft rows that are not in the Trash, each module in its own table", async () => {
    const { client, asked } = clientAnswering({
      "blog_posts:published": { count: 24, error: null },
      "blog_posts:draft": { count: 5, error: null },
      "faqs:published": { count: 38, error: null },
      "faqs:draft": { count: 2, error: null },
      "job_postings:open": { count: 6, error: null },
      "job_postings:draft": { count: 1, error: null },
    });
    expect(await readModuleCounts(client)).toEqual({
      blog: { published: 24, drafts: 5 },
      faq: { published: 38, drafts: 2 },
      careers: { published: 6, drafts: 1 },
    });
    expect(asked).toHaveLength(6);
    expect(asked.every((question) => question.deleted === null)).toBe(true);
    // A job is published while it is open.
    expect(asked).toContainEqual({ table: "job_postings", status: "open", deleted: null });
    expect(asked).not.toContainEqual(
      expect.objectContaining({ table: "job_postings", status: "published" }),
    );
  });

  it("gives null, without failing or logging, while a module's table does not exist yet", async () => {
    const { client } = clientAnswering({
      "blog_posts:published": MISSING,
      "blog_posts:draft": MISSING,
      "faqs:published": { count: null, error: { code: "PGRST205" } },
      "faqs:draft": { count: null, error: { code: "PGRST205" } },
      "job_postings:open": MISSING,
      "job_postings:draft": MISSING,
    });
    expect(await readModuleCounts(client)).toEqual({
      blog: { published: null, drafts: null },
      faq: { published: null, drafts: null },
      careers: { published: null, drafts: null },
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("gives null for a count that cannot be read for another reason, and logs only its code", async () => {
    const { client } = clientAnswering({
      "blog_posts:published": { count: null, error: { code: "42501" } },
      "blog_posts:draft": { count: 5, error: null },
    });
    const counts = await readModuleCounts(client);
    expect(counts.blog).toEqual({ published: null, drafts: 5 });
    expect(logger.error).toHaveBeenCalledExactlyOnceWith(
      "a content module count could not be read",
      {
        module: "blog",
        errorCode: "42501",
      },
    );
  });
});

describe("UT-content-modules-read: what the dashboard card and the module pages show (ADR-143)", () => {
  it("uses the saved switches and gives null counts while the tables do not exist", async () => {
    site.getSiteSettings.mockResolvedValue({
      ...SITE_DEFAULTS,
      content_modules: { blog: true, faq: false, careers: true },
    });
    supabase.createServerSupabase.mockResolvedValue(
      clientAnswering({
        "blog_posts:published": MISSING,
        "blog_posts:draft": MISSING,
        "faqs:published": MISSING,
        "faqs:draft": MISSING,
        "job_postings:open": MISSING,
        "job_postings:draft": MISSING,
      }).client,
    );
    expect(await getContentModulesView()).toEqual([
      { module: "blog", live: true, published: null, drafts: null },
      { module: "faq", live: false, published: null, drafts: null },
      { module: "careers", live: true, published: null, drafts: null },
    ]);
  });
});

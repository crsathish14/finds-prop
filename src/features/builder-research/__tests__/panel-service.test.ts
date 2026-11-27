import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/types/database.types";
import { ActionError } from "@/server/actions/normalise-error";
import { loadResearchPanel, saveResearchPages, type PageChecker } from "../panel-service";
import { saveMyResearchPagesSchema } from "../schemas";

const BUILDER = "00000000-0000-4000-b000-000000000001";
const SITE = "https://www.kadalhomes.example";

type Answer = { data: unknown; error: { code?: string } | null };

/**
 * A stand-in for the signed-in person's client: each table and function answers as given, whatever the filters, and
 * every call is written down (table or function, what was done, and the arguments).
 */
function clientWith(answers: Record<string, Answer>) {
  const calls: Array<{ target: string; step: string; args: unknown[] }> = [];
  const chain = (target: string): unknown => {
    const answer = answers[target] ?? { data: [], error: null };
    const builder: Record<string, unknown> = {
      then: (resolve: (value: Answer) => unknown, reject?: (reason: unknown) => unknown) =>
        Promise.resolve(answer).then(resolve, reject),
    };
    for (const step of ["select", "eq", "order", "limit", "delete", "in", "gte"]) {
      builder[step] = (...args: unknown[]) => {
        calls.push({ target, step, args });
        return builder;
      };
    }
    return builder;
  };
  const client = {
    from: (table: string) => chain(table),
    rpc: (name: string, args?: unknown) => {
      calls.push({ target: name, step: "rpc", args: [args] });
      return chain(name);
    },
  } as unknown as SupabaseClient<Database>;
  return { client, calls };
}

function checker(unreadable: Record<string, "could_not_open" | "not_on_site"> = {}) {
  const checked: string[] = [];
  const pages: PageChecker = {
    check: vi.fn(async ({ url }: { url: string }) => {
      checked.push(url);
      const problem = unreadable[url];
      return problem === undefined
        ? ({ readable: true } as const)
        : ({ readable: false, problem } as const);
    }),
  };
  return { pages, checked };
}

const links = (rows: Array<{ url: string; topic: string }>) =>
  saveMyResearchPagesSchema.parse({ links: rows }).links;

describe("UT-builder-research-panel: saving the pages for the AI assistant", () => {
  it("checks every page, saves the list, forgets the saved copies and checks the home page", async () => {
    const { client, calls } = clientWith({
      builders: { data: [{ website: SITE }], error: null },
    });
    const { pages, checked } = checker();
    const done = await saveResearchPages(client, pages, {
      builderId: BUILDER,
      links: links([
        { url: `${SITE}/about`, topic: "about_company" },
        { url: "", topic: "" },
        { url: `${SITE}/awards`, topic: "awards_approvals" },
      ]),
    });
    expect(done).toEqual({ builderId: BUILDER, websiteReadable: true });
    expect(checked).toEqual([`${SITE}/about`, `${SITE}/awards`, SITE]);
    expect(calls).toContainEqual({
      target: "save_builder_research_links",
      step: "rpc",
      args: [
        {
          p_builder: BUILDER,
          p_links: [
            { url: `${SITE}/about`, topic: "about_company" },
            { url: `${SITE}/awards`, topic: "awards_approvals" },
          ],
        },
      ],
    });
    expect(calls).toContainEqual({ target: "builder_research_pages", step: "delete", args: [] });
  });

  it("saves nothing while a page cannot be read, and says why under the box it was typed in", async () => {
    const { client, calls } = clientWith({ builders: { data: [{ website: SITE }], error: null } });
    const { pages } = checker({ [`${SITE}/awards`]: "could_not_open" });
    const attempt = saveResearchPages(client, pages, {
      builderId: BUILDER,
      links: links([
        { url: `${SITE}/about`, topic: "about_company" },
        { url: "", topic: "" },
        { url: `${SITE}/awards`, topic: "awards_approvals" },
      ]),
    });
    await expect(attempt).rejects.toMatchObject({
      code: "VALIDATION",
      fieldErrors: {
        "links.2.url": [
          { key: "builderResearch.problem.couldNotOpen", values: { site: "kadalhomes.example" } },
        ],
      },
    });
    expect(calls.some((call) => call.step === "rpc")).toBe(false);
    expect(calls.some((call) => call.step === "delete")).toBe(false);
  });

  it("saves the website as it is when its home page cannot be read, with the warning", async () => {
    const { client } = clientWith({ builders: { data: [{ website: SITE }], error: null } });
    const { pages } = checker({ [SITE]: "could_not_open" });
    expect(
      await saveResearchPages(client, pages, {
        builderId: BUILDER,
        links: links([{ url: `${SITE}/about`, topic: "about_company" }]),
      }),
    ).toEqual({ builderId: BUILDER, websiteReadable: false });
  });

  it("refuses pages for a builder with no website", async () => {
    const { client } = clientWith({ builders: { data: [{ website: null }], error: null } });
    await expect(
      saveResearchPages(client, checker().pages, {
        builderId: BUILDER,
        links: links([{ url: `${SITE}/about`, topic: "about_company" }]),
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION",
      fieldErrors: { _form: [{ key: "builderResearch.noWebsiteSaved" }] },
    });
  });

  it("turns the database's refusal of another builder into FORBIDDEN", async () => {
    const { client } = clientWith({
      builders: { data: [{ website: SITE }], error: null },
      save_builder_research_links: { data: null, error: { code: "42501" } },
    });
    const attempt = saveResearchPages(client, checker().pages, { builderId: BUILDER, links: [] });
    await expect(attempt).rejects.toBeInstanceOf(ActionError);
    await expect(attempt).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("UT-builder-research-panel-read: what the panel shows", () => {
  it("shows a page's latest failure, and the website's, but not one fixed since", async () => {
    const { client } = clientWith({
      builders: { data: [{ name: "Kadal Homes", website: SITE }], error: null },
      builder_research_links: {
        data: [
          { url: `${SITE}/about`, topic: "about_company", position: 1 },
          { url: `${SITE}/awards`, topic: "awards_approvals", position: 2 },
        ],
        error: null,
      },
      builder_research_reads: {
        data: [
          {
            url: `${SITE}/awards`,
            ok: false,
            problem: "blocked",
            created_at: "2026-11-27T10:00:00Z",
          },
          { url: `${SITE}/about`, ok: true, problem: null, created_at: "2026-11-27T09:00:00Z" },
          { url: SITE, ok: false, problem: "too_little_text", created_at: "2026-11-27T08:00:00Z" },
          {
            url: `${SITE}/about`,
            ok: false,
            problem: "could_not_open",
            created_at: "2026-11-26T09:00:00Z",
          },
        ],
        error: null,
      },
    });
    const panel = await loadResearchPanel(client, BUILDER);
    expect(panel).toMatchObject({
      builderId: BUILDER,
      name: "Kadal Homes",
      site: "kadalhomes.example",
      links: [
        { url: `${SITE}/about`, topic: "about_company" },
        { url: `${SITE}/awards`, topic: "awards_approvals" },
      ],
      websiteProblem: { url: SITE, problem: "too_little_text" },
      problems: [{ url: `${SITE}/awards`, problem: "blocked", at: "2026-11-27T10:00:00Z" }],
    });
  });

  it("is null for a builder the person cannot see", async () => {
    const { client } = clientWith({ builders: { data: [], error: null } });
    expect(await loadResearchPanel(client, BUILDER)).toBeNull();
  });
});

describe("UT-builder-research-schema: the panel's input", () => {
  it("drops empty boxes, keeps each box's place, and needs a topic and https for a filled one", () => {
    expect(
      links([
        { url: "", topic: "" },
        { url: ` ${SITE}/about `, topic: "about_company" },
      ]),
    ).toEqual([{ box: 1, url: `${SITE}/about`, topic: "about_company" }]);
    const bad = saveMyResearchPagesSchema.safeParse({
      links: [
        { url: "http://kadalhomes.example/about", topic: "about_company" },
        { url: `${SITE}/x`, topic: "" },
      ],
    });
    expect(bad.success).toBe(false);
    const paths = bad.error?.issues.map((issue) => [issue.path.join("."), issue.message]);
    expect(paths).toEqual([
      ["links.0.url", "validation.linkInvalid"],
      ["links.1.topic", "validation.required"],
    ]);
    expect(
      saveMyResearchPagesSchema.safeParse({
        links: Array.from({ length: 4 }, () => ({ url: "", topic: "" })),
      }).success,
    ).toBe(false);
  });
});

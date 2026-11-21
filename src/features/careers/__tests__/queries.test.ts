import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/types/database.types";
import {
  readAdminJob,
  readAdminJobCounts,
  readAdminJobList,
  readJobList,
  toJobFilters,
} from "../queries";
import type { SearchRow } from "../view";

const JOB = "00000000-0000-4000-b600-0000000000a1";
const DEPARTMENT = "00000000-0000-4000-b600-0000000000d1";

const ROW: SearchRow = {
  id: JOB,
  slug: "site-engineer",
  title: "Site Engineer",
  department_id: DEPARTMENT,
  department_slug: "engineering",
  department_name: "Engineering",
  location: "Chennai",
  work_mode: "onsite",
  employment_type: "full_time",
  experience: "",
  summary: "Supervise our sites.",
  snippet: "Supervise our sites.",
  salary_note: null,
  closes_at: null,
  posted_at: "2026-03-01T10:00:00+00:00",
  total_count: 30,
};

/** A client whose rpc answers from a script of pages: the offset decides which. */
function searchClient(pages: Record<number, SearchRow[]>, failure?: { code: string }) {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const rpc = vi.fn((name: string, args: Record<string, unknown>) => {
    calls.push({ name, args });
    if (failure) return Promise.resolve({ data: null, error: failure });
    return Promise.resolve({ data: pages[args.p_offset as number] ?? [], error: null });
  });
  return { supabase: { rpc } as unknown as SupabaseClient<Database>, calls };
}

describe("UT-careers-queries: the public list", () => {
  it("asks the search function for one page and draws it with the total", async () => {
    const { supabase, calls } = searchClient({ 12: [ROW] });
    const list = await readJobList(supabase, {
      query: " surveying ",
      department: "engineering",
      location: "Chennai",
      workMode: "hybrid",
      type: "contract",
      page: 2,
    });
    expect(calls).toEqual([
      {
        name: "search_job_postings",
        args: {
          p_query: "surveying",
          p_department: "engineering",
          p_location: "Chennai",
          p_work_mode: "hybrid",
          p_type: "contract",
          p_limit: 12,
          p_offset: 12,
        },
      },
    ]);
    expect(list).toMatchObject({ total: 30, page: 2, pageCount: 3 });
    expect(list.items.map((card) => card.slug)).toEqual(["site-engineer"]);
  });

  it("leaves out the filters that are not set", async () => {
    const { supabase, calls } = searchClient({ 0: [ROW] });
    await readJobList(supabase, { page: 1 });
    expect(calls[0]?.args).toEqual({ p_limit: 12, p_offset: 0 });
  });

  it("cuts words longer than the database allows, so a long paste is a search and not an error", async () => {
    const { supabase, calls } = searchClient({ 0: [ROW] });
    await readJobList(supabase, { query: "x".repeat(500), page: 1 });
    expect((calls[0]?.args.p_query as string).length).toBe(200);
  });

  it("answers a page past the end with no cards but the real total", async () => {
    const { supabase, calls } = searchClient({ 0: [ROW] });
    const list = await readJobList(supabase, { page: 9 });
    expect(list).toMatchObject({ items: [], total: 30, page: 9, pageCount: 3 });
    expect(calls.map((call) => call.args.p_offset)).toEqual([96, 0]);
  });

  it("answers no jobs with one empty page", async () => {
    const { supabase } = searchClient({});
    expect(await readJobList(supabase, { page: 1 })).toMatchObject({
      items: [],
      total: 0,
      pageCount: 1,
    });
  });

  it("treats a page below one as the first, and throws a failed read", async () => {
    const { supabase, calls } = searchClient({ 0: [ROW] });
    await readJobList(supabase, { page: -3 });
    expect(calls[0]?.args.p_offset).toBe(0);
    const failing = searchClient({}, { code: "XX000" });
    await expect(readJobList(failing.supabase, { page: 1 })).rejects.toEqual({ code: "XX000" });
  });
});

describe("UT-careers-queries: the filter row", () => {
  const departments = [
    { id: "d1", slug: "engineering", name: "Engineering" },
    { id: "d2", slug: "sales", name: "Sales" },
    { id: "d3", slug: "legal", name: "Legal" },
  ];

  it("offers only departments that have an open job, in the admin's order, and each place once", () => {
    const filters = toJobFilters(
      [
        { department_id: "d2", location: "Madurai" },
        { department_id: "d1", location: "Chennai" },
        { department_id: "d1", location: " chennai " },
        { department_id: "d1", location: "Coimbatore" },
      ],
      departments,
    );
    expect(filters.departments).toEqual([
      { slug: "engineering", name: "Engineering" },
      { slug: "sales", name: "Sales" },
    ]);
    expect(filters.locations).toEqual(["Chennai", "Coimbatore", "Madurai"]);
    expect(filters.total).toBe(4);
  });

  it("offers nothing when there is no open job", () => {
    expect(toJobFilters([], departments)).toEqual({ departments: [], locations: [], total: 0 });
  });
});

/** A query builder that records each call and answers the result when awaited. */
function builder(result: { data: unknown; error: unknown; count?: number | null }) {
  const calls: string[] = [];
  const query: Record<string, unknown> = {};
  for (const name of ["select", "order", "range", "not", "is", "eq", "textSearch", "maybeSingle"]) {
    query[name] = (...args: unknown[]) => {
      calls.push(
        `${name}:${args.map((arg) => (typeof arg === "object" ? JSON.stringify(arg) : String(arg))).join(",")}`,
      );
      return query;
    };
  }
  query.then = (resolve: (value: unknown) => unknown) => resolve(result);
  const supabase = { from: vi.fn(() => query) } as unknown as SupabaseClient<Database>;
  return { supabase, calls };
}

const ADMIN_ROW = {
  id: JOB,
  slug: "site-engineer",
  title: "Site Engineer",
  status: "draft",
  department_id: DEPARTMENT,
  location: "Chennai",
  work_mode: "onsite",
  employment_type: "full_time",
  posted_at: null,
  closes_at: null,
  updated_at: "2026-03-02T10:00:00+00:00",
  deleted_at: null,
};

describe("UT-careers-queries: the admin's list", () => {
  it("reads a page with named columns, newest edit first, leaving Trash out", async () => {
    const { supabase, calls } = builder({ data: [ADMIN_ROW], error: null, count: 41 });
    const list = await readAdminJobList(supabase, { status: "draft", page: 2 });
    expect(calls).toEqual([
      expect.stringContaining("select:id, slug, title, status, department_id, location"),
      'order:updated_at,{"ascending":false}',
      'order:id,{"ascending":true}',
      "range:20,39",
      "is:deleted_at,null",
      "eq:status,draft",
    ]);
    expect(calls[0]).not.toContain("description");
    expect(list).toMatchObject({ total: 41, page: 2, pageCount: 3 });
    expect(list.rows[0]).toMatchObject({ slug: "site-engineer", status: "draft", trashed: false });
  });

  it("shows Trash as its own view, and filters by department and words", async () => {
    const trash = builder({ data: [], error: null, count: 0 });
    await readAdminJobList(trash.supabase, { status: "trash", page: 1 });
    expect(trash.calls).toContain("not:deleted_at,is,null");
    expect(trash.calls.some((call) => call.startsWith("eq:status"))).toBe(false);

    const filtered = builder({ data: [], error: null, count: 0 });
    await readAdminJobList(filtered.supabase, {
      departmentId: DEPARTMENT,
      query: " surveying ",
      page: 1,
    });
    expect(filtered.calls).toContain(`eq:department_id,${DEPARTMENT}`);
    expect(filtered.calls).toContain(
      'textSearch:search_vector,surveying,{"type":"websearch","config":"english"}',
    );
  });

  it("throws a failed read, so the portal's error page shows it", async () => {
    const failure = { code: "XX000", message: "down" };
    const { supabase } = builder({ data: null, error: failure });
    await expect(readAdminJobList(supabase, { page: 1 })).rejects.toBe(failure);
  });
});

describe("UT-careers-queries: the admin's counts and editor", () => {
  it("counts each tab with a head request", async () => {
    const { supabase } = builder({ data: null, error: null, count: 4 });
    expect(await readAdminJobCounts(supabase)).toEqual({ draft: 4, open: 4, closed: 4, trash: 4 });
  });

  it("reads one job for the editor, or nothing", async () => {
    const found = builder({
      data: {
        ...ADMIN_ROW,
        experience: "",
        summary: "Supervise our sites.",
        description: "A description.",
        responsibilities: "",
        requirements: "A degree",
        salary_note: null,
        apply_url: "https://jobs.example.test/x",
        apply_email: null,
        created_at: "2026-03-01T10:00:00+00:00",
      },
      error: null,
    });
    const view = await readAdminJob(found.supabase, JOB);
    expect(view?.applyUrl).toBe("https://jobs.example.test/x");
    expect(found.calls).toContain(`eq:id,${JOB}`);
    const missing = builder({ data: null, error: null });
    expect(await readAdminJob(missing.supabase, JOB)).toBeNull();
  });
});

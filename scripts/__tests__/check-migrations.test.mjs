import { describe, expect, it } from "vitest";
import { evaluateMigrations } from "../check-migrations.mjs";

const NAME = (ts, slug = "change") => `supabase/migrations/${ts}_${slug}.sql`;
const file = (ts, content, slug) => ({ path: NAME(ts, slug), content });
const ids = (findings) => findings.map((finding) => finding.rule);

const baseWith = (existing, nameStatus = []) => ({
  baseFiles: existing.map((ts) => NAME(ts, "base")),
  nameStatus,
});

describe("G-13 check-migrations: immutability and order", () => {
  const existing = "20261101000000";

  it("accepts a new migration that sorts after the newest on the base branch", () => {
    const added = NAME("20261102000000");
    expect(
      evaluateMigrations({
        files: [file("20261102000000", "select 1;")],
        base: baseWith([existing], [{ status: "A", path: added }]),
      }),
    ).toEqual([]);
  });

  it("rejects modifying, deleting or renaming an existing migration", () => {
    const path = NAME(existing, "base");
    for (const status of ["M", "D", "R100", "T"]) {
      expect(
        ids(evaluateMigrations({ files: [], base: baseWith([existing], [{ status, path }]) })),
      ).toContain("MIG-IMMUTABLE");
    }
  });

  it("rejects a new migration with a timestamp not after the newest on base", () => {
    const added = NAME("20261031000000");
    expect(
      ids(
        evaluateMigrations({
          files: [file("20261031000000", "select 1;")],
          base: baseWith([existing], [{ status: "A", path: added }]),
        }),
      ),
    ).toContain("MIG-ORDER");
    const same = NAME(existing, "again");
    expect(
      ids(
        evaluateMigrations({
          files: [file(existing, "select 1;", "again")],
          base: baseWith([existing], [{ status: "A", path: same }]),
        }),
      ),
    ).toContain("MIG-ORDER");
  });

  it("skips ordering and immutability when there is no base, but still checks content", () => {
    expect(
      evaluateMigrations({ files: [file("20261102000000", "select 1;")], base: null }),
    ).toEqual([]);
  });
});

describe("G-13 check-migrations: content", () => {
  it("requires the 14-digit timestamp and snake_case name", () => {
    expect(
      ids(
        evaluateMigrations({
          files: [{ path: "supabase/migrations/init.sql", content: "select 1;" }],
        }),
      ),
    ).toContain("MIG-NAME");
    expect(
      ids(
        evaluateMigrations({
          files: [{ path: "supabase/migrations/20261102_short.sql", content: "select 1;" }],
        }),
      ),
    ).toContain("MIG-NAME");
    expect(
      ids(
        evaluateMigrations({
          files: [
            { path: "supabase/migrations/20261102000000_Bad-Name.sql", content: "select 1;" },
          ],
        }),
      ),
    ).toContain("MIG-NAME");
  });

  it("requires row level security in the same file as create table", () => {
    const bad = "create table public.properties (id uuid primary key);\n";
    expect(ids(evaluateMigrations({ files: [file("20261102000000", bad)] }))).toContain("MIG-RLS");
    const ok = `${bad}alter table public.properties enable row level security;\n`;
    expect(evaluateMigrations({ files: [file("20261102000000", ok)] })).toEqual([]);
    const unqualified =
      "create table if not exists leads (id int);\nalter table leads enable row level security;\n";
    expect(evaluateMigrations({ files: [file("20261102000000", unqualified)] })).toEqual([]);
  });

  it("ignores tables in other schemas and commented-out SQL", () => {
    expect(
      evaluateMigrations({ files: [file("20261102000000", "create table audit.log (id int);\n")] }),
    ).toEqual([]);
    expect(
      evaluateMigrations({
        files: [file("20261102000000", "-- create table public.x (id int);\nselect 1;\n")],
      }),
    ).toEqual([]);
  });

  it("requires a destructive header and a rollback file for destructive SQL", () => {
    const sql = "alter table public.properties drop column legacy;\n";
    expect(ids(evaluateMigrations({ files: [file("20261102000000", sql)] }))).toEqual([
      "MIG-DESTRUCTIVE",
      "MIG-DESTRUCTIVE",
    ]);
    const withHeader = `-- destructive: removes the unused legacy column after the expand step shipped\n${sql}`;
    expect(ids(evaluateMigrations({ files: [file("20261102000000", withHeader)] }))).toEqual([
      "MIG-DESTRUCTIVE",
    ]);
    expect(
      evaluateMigrations({
        files: [file("20261102000000", withHeader)],
        rollbackFiles: ["supabase/rollbacks/20261102000000.sql"],
      }),
    ).toEqual([]);
  });

  it("treats drop table, truncate and column type changes as destructive", () => {
    for (const sql of [
      "drop table public.a;",
      "truncate public.a;",
      "alter table public.a alter column x type text;",
      "alter table public.a alter column x set data type text;",
    ]) {
      expect(ids(evaluateMigrations({ files: [file("20261102000000", sql)] }))).toContain(
        "MIG-DESTRUCTIVE",
      );
    }
  });
});

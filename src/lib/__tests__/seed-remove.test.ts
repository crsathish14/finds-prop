import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SEED_REMOVE = readFileSync("supabase/seed-remove.sql", "utf8");
const SEED_TEST = readFileSync("supabase/seed-tests/seed.test.sql", "utf8");
const SEED = readFileSync("supabase/seed.sql", "utf8");

/** The statements between `begin;` and `commit;`, with every run of white space made one space. */
function statementsOf(text: string): string {
  const from = text.indexOf("begin;") + "begin;".length;
  const to = text.indexOf("commit;");
  return text.slice(from, to).replace(/\s+/g, " ").trim();
}

describe("seed-remove.sql: taking the fictional seed out again", () => {
  it("is the same set of statements the database test runs against the seed", () => {
    const marker = "$remove$";
    const first = SEED_TEST.indexOf(marker) + marker.length;
    const last = SEED_TEST.indexOf(marker, first);
    const tested = SEED_TEST.slice(first, last).replace(/\s+/g, " ").trim();
    expect(tested.length).toBeGreaterThan(200);
    expect(statementsOf(SEED_REMOVE)).toBe(tested);
  });

  it("deletes only by the seed's own id prefix, and the two seeded settings keys", () => {
    const statements = statementsOf(SEED_REMOVE);
    const deletes = statements.split(";").filter((part) => part.trim().length > 0);
    for (const part of deletes) {
      expect(part).toMatch(/^ ?delete from /);
      expect(part).toMatch(/5eed0000-0000-4000-80\d\d-%|key in \('homepage', 'region'\)/);
    }
    expect(statements).not.toMatch(/truncate|drop /i);
  });

  it("is run in one transaction, so it removes everything or nothing", () => {
    expect(SEED_REMOVE).toMatch(/^begin;$/m);
    expect(SEED_REMOVE).toMatch(/^commit;$/m);
  });
});

describe("seed.sql: the guard against a second load", () => {
  it("stops, before it writes anything, when seeded customers are already there", () => {
    const guard = SEED.indexOf("The fictional seed is already loaded");
    const firstInsert = SEED.indexOf("insert into auth.users");
    expect(guard).toBeGreaterThan(0);
    expect(guard).toBeLessThan(firstInsert);
    expect(SEED).toContain("id::text like '5eed0000-%'");
  });

  it("adds no contact form of its own: the default one is stored by a migration", () => {
    expect(SEED).not.toMatch(/'contact-us'/);
    expect(SEED).not.toMatch(/"type": "tel"/);
  });
});

import { describe, expect, it } from "vitest";
import {
  forbiddenIn,
  NEVER_PUBLIC_ON_HOMES,
  topLevelKeys,
  wordsOf,
} from "../../../tests/public-columns";
import {
  BUILDER_COLUMNS,
  BUILDER_DIRECTORY_COLUMNS,
  BUILDER_FIRST_PROJECT_COLUMNS,
  BUILDER_PROJECT_COLUMNS,
  LOCALITY_HOME_COLUMNS,
  LOCALITY_PROJECT_COLUMNS,
} from "../ai-chat/columns";
import { DEVELOPER_PROJECT_COLUMNS, RANKING_COLUMNS } from "../home/columns";
import { PHOTO_COLUMNS, PROPERTY_COLUMNS } from "../property/schemas";
import {
  PROJECT_COLUMNS,
  PROJECT_LIST_COLUMNS,
  TREND_COLUMNS,
  UNIT_COLUMNS,
} from "../projects/schemas";
import { SITEMAP_HOME_COLUMNS, SITEMAP_PROJECT_COLUMNS } from "../sitemap/columns";

// IT-queries, the part that needs no database (S4-T13, R-DB-06, ADR-017): the select strings the
// public pages send never name an owner, a moderation state, a private link or a builder's private
// contact, and never ask for every column. The integration test runs the same strings against the
// real database.

const HOME_SELECTS = {
  PROPERTY_COLUMNS,
  PHOTO_COLUMNS,
  SITEMAP_HOME_COLUMNS,
  LOCALITY_HOME_COLUMNS,
} as const;

const PROJECT_SELECTS = {
  PROJECT_LIST_COLUMNS,
  PROJECT_COLUMNS,
  UNIT_COLUMNS,
  TREND_COLUMNS,
  RANKING_COLUMNS,
  DEVELOPER_PROJECT_COLUMNS,
  SITEMAP_PROJECT_COLUMNS,
  LOCALITY_PROJECT_COLUMNS,
  BUILDER_PROJECT_COLUMNS,
  BUILDER_FIRST_PROJECT_COLUMNS,
} as const;

const BUILDER_SELECTS = { BUILDER_DIRECTORY_COLUMNS, BUILDER_COLUMNS } as const;

describe("IT-queries: the select strings of the public pages (S4-T13)", () => {
  it.each(Object.entries(HOME_SELECTS))("%s names no private column of a home", (_name, select) => {
    expect(forbiddenIn(select, NEVER_PUBLIC_ON_HOMES)).toEqual([]);
  });

  it.each(Object.entries(PROJECT_SELECTS))("%s names no private column", (_name, select) => {
    expect(forbiddenIn(select)).toEqual([]);
  });

  it.each(Object.entries(BUILDER_SELECTS))(
    "%s names no private column of a builder",
    (_name, select) => {
      expect(forbiddenIn(select)).toEqual([]);
    },
  );

  it("a home is selected without its owner, private address, exact point or review state", () => {
    for (const word of ["owner_id", "address", "location", "rejection_reason", "status"]) {
      expect(wordsOf(PROPERTY_COLUMNS)).not.toContain(word);
    }
  });

  it("the checker itself catches a private column, a builder contact and a star", () => {
    expect(forbiddenIn("id, owner_id")).toEqual(["owner_id"]);
    expect(forbiddenIn("slug, builders!inner(id, email)")).toEqual(["email"]);
    expect(forbiddenIn("*")).toEqual(["*"]);
    expect(forbiddenIn("id, address", NEVER_PUBLIC_ON_HOMES)).toEqual(["address"]);
    expect(forbiddenIn("contact_phone, published_at, location_note")).toEqual([]);
  });

  it("counts an embedded table as one key", () => {
    expect(topLevelKeys("slug, name, builders!inner(id, name)")).toEqual([
      "builders",
      "name",
      "slug",
    ]);
  });
});

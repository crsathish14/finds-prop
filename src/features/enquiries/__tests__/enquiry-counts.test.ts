import { beforeEach, describe, expect, it, vi } from "vitest";

type Answer = { count: number | null; error: null | { code: string } };

const db = vi.hoisted(() => ({
  own: { data: [] as { id: string }[], error: null as null | { code: string } },
  /** The answers to the enquiry counts, in the order they are asked. */
  answers: [] as { count: number | null; error: null | { code: string } }[],
  asked: [] as string[],
  logged: [] as unknown[][],
}));

vi.mock("server-only", () => ({}));
vi.mock("@/features/auth", () => ({ getAccountSummary: async () => ({}) }));
vi.mock("@/server/logger", () => ({
  logger: { error: (...args: unknown[]) => db.logged.push(args) },
}));

/** A filter chain that records what it was asked and answers like the database when awaited. */
function chain(options: unknown): PromiseLike<Answer> & Record<string, unknown> {
  const asked = [`count:${JSON.stringify(options)}`];
  const answer = db.answers.shift() ?? { count: 0, error: null };
  const node = {
    in: (column: string, ids: string[]) => {
      asked.push(`in:${column}:${ids.join(",")}`);
      return node;
    },
    eq: (column: string, value: string) => {
      asked.push(`eq:${column}:${value}`);
      return node;
    },
    then: (resolve: (value: Answer) => unknown) => {
      db.asked.push(asked.join(" "));
      return Promise.resolve(answer).then(resolve);
    },
  };
  return node as unknown as PromiseLike<Answer> & Record<string, unknown>;
}

vi.mock("@/server/supabase/server", () => ({
  createServerSupabase: async () => ({
    rpc: () => ({ select: () => ({ neq: () => ({ limit: async () => db.own }) }) }),
    from: () => ({ select: (_columns: string, options: unknown) => chain(options) }),
  }),
}));

const { countReceivedEnquiries, countSentEnquiries } = await import("../queries");

const HEAD = 'count:{"count":"exact","head":true}';

beforeEach(() => {
  db.own = { data: [], error: null };
  db.answers = [];
  db.asked = [];
  db.logged = [];
});

describe("countReceivedEnquiries: the number on the Enquiries received tab (S6-T03)", () => {
  it("counts all enquiries on the owner's own listings and the New ones, in the database", async () => {
    db.own = { data: [{ id: "p1" }, { id: "p2" }], error: null };
    db.answers = [
      { count: 6, error: null },
      { count: 2, error: null },
    ];
    expect(await countReceivedEnquiries()).toEqual({ total: 6, fresh: 2 });
    expect(db.asked).toContain(`${HEAD} in:property_id:p1,p2`);
    expect(db.asked).toContain(`${HEAD} in:property_id:p1,p2 eq:status:new`);
  });

  it("is 0 and 0, and reads no enquiries, for an owner with no listings", async () => {
    expect(await countReceivedEnquiries()).toEqual({ total: 0, fresh: 0 });
    expect(db.asked).toEqual([]);
  });

  it("logs the code and throws when the owner's listings cannot be read", async () => {
    db.own = { data: [], error: { code: "XX000" } };
    await expect(countReceivedEnquiries()).rejects.toEqual({ code: "XX000" });
    expect(db.logged[0]?.[1]).toEqual({ errorCode: "XX000" });
  });

  it("logs the code and throws when a count fails", async () => {
    db.own = { data: [{ id: "p1" }], error: null };
    db.answers = [
      { count: 6, error: null },
      { count: null, error: { code: "XX001" } },
    ];
    await expect(countReceivedEnquiries()).rejects.toEqual({ code: "XX001" });
    expect(db.logged).toEqual([
      ["received enquiries could not be counted", { errorCode: "XX001" }],
    ]);
  });
});

describe("countSentEnquiries: the number on the My enquiries tab (S6-T03)", () => {
  it("counts the enquiries the visitor sent, by their own id", async () => {
    db.answers = [{ count: 4, error: null }];
    expect(await countSentEnquiries("user-1")).toBe(4);
    expect(db.asked).toEqual([`${HEAD} eq:user_id:user-1`]);
  });

  it("logs the code and throws when the count fails", async () => {
    db.answers = [{ count: null, error: { code: "XX002" } }];
    await expect(countSentEnquiries("user-1")).rejects.toEqual({ code: "XX002" });
    expect(db.logged).toEqual([["sent enquiries could not be counted", { errorCode: "XX002" }]]);
  });
});

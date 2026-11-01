import { beforeEach, describe, expect, it, vi } from "vitest";

const createAdminSupabase = vi.fn();
vi.mock("@/server/supabase/admin.server", () => ({
  createAdminSupabase: (requestId?: string) => createAdminSupabase(requestId) as unknown,
}));

/** A query builder that records every call and answers with a fixed result when awaited. */
function builder(answer: { data?: unknown; error?: unknown }) {
  const calls: [string, unknown[]][] = [];
  const chain: Record<string, unknown> = {};
  for (const name of ["upsert", "select", "update", "delete", "eq", "maybeSingle"]) {
    chain[name] = (...parameters: unknown[]) => {
      calls.push([name, parameters]);
      return chain;
    };
  }
  chain.then = (resolve: (value: unknown) => unknown) =>
    resolve({ data: answer.data ?? null, error: answer.error ?? null });
  return { chain, calls };
}

const row = { scope: "createListing", subject: "user-1", key: "key-1" };

async function tableWith(answer: { data?: unknown; error?: unknown }) {
  const fake = builder(answer);
  createAdminSupabase.mockReturnValue({ from: () => fake.chain });
  const { createIdempotencyTable } = await import("@/server/idempotency/idempotency-table");
  return { table: createIdempotencyTable("req-12345678"), calls: fake.calls };
}

describe("UT-idempotency: the database table", () => {
  beforeEach(() => {
    createAdminSupabase.mockReset();
  });

  it("claims a key without overwriting an existing one, and says whether it created it", async () => {
    const created = await tableWith({ data: [{ key: "key-1" }] });
    expect(await created.table.insertIfAbsent(row)).toBe(true);
    expect(createAdminSupabase).toHaveBeenCalledWith("req-12345678");
    expect(created.calls[0]).toEqual([
      "upsert",
      [row, { onConflict: "scope,subject,key", ignoreDuplicates: true }],
    ]);
    const existing = await tableWith({ data: [] });
    expect(await existing.table.insertIfAbsent(row)).toBe(false);
  });

  it("reads the stored result for exactly this claim", async () => {
    const { table, calls } = await tableWith({ data: { result: { ok: true } } });
    expect(await table.read(row)).toEqual({ result: { ok: true } });
    expect(calls.filter(([name]) => name === "eq").map(([, parameters]) => parameters)).toEqual([
      ["scope", "createListing"],
      ["subject", "user-1"],
      ["key", "key-1"],
    ]);
  });

  it("stores a result and removes a claim for exactly this claim", async () => {
    const saved = await tableWith({});
    await saved.table.save(row, { ok: true, data: 1 });
    expect(saved.calls[0]).toEqual(["update", [{ result: { ok: true, data: 1 } }]]);
    const removed = await tableWith({});
    await removed.table.remove(row);
    expect(removed.calls[0]?.[0]).toBe("delete");
    expect(removed.calls.filter(([name]) => name === "eq")).toHaveLength(3);
  });

  it("fails with INTERNAL when the database errors, and says nothing about why", async () => {
    const { table } = await tableWith({ error: { message: "secret detail" } });
    await expect(table.insertIfAbsent(row)).rejects.toMatchObject({ code: "INTERNAL" });
    await expect(table.read(row)).rejects.toMatchObject({ code: "INTERNAL" });
    await expect(table.save(row, 1)).rejects.toMatchObject({ code: "INTERNAL" });
    await expect(table.remove(row)).rejects.toMatchObject({ code: "INTERNAL" });
    await expect(table.read(row)).rejects.not.toThrow(/secret detail/);
  });
});

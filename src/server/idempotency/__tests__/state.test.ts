import { describe, expect, it } from "vitest";
import { ActionError } from "@/server/actions/normalise-error";
import {
  beginIdempotent,
  completeIdempotent,
  releaseIdempotent,
  type IdempotencyRow,
  type IdempotencyTable,
} from "@/server/idempotency/state";

/** The claim table in memory, behaving like the database table with its unique key. */
function memoryTable() {
  const rows = new Map<string, { result: unknown }>();
  const keyOf = (row: IdempotencyRow) => `${row.scope}|${row.subject}|${row.key}`;
  const table: IdempotencyTable = {
    insertIfAbsent: (row) => {
      if (rows.has(keyOf(row))) return Promise.resolve(false);
      rows.set(keyOf(row), { result: null });
      return Promise.resolve(true);
    },
    read: (row) => Promise.resolve(rows.get(keyOf(row)) ?? null),
    save: (row, result) => {
      rows.set(keyOf(row), { result });
      return Promise.resolve();
    },
    remove: (row) => {
      rows.delete(keyOf(row));
      return Promise.resolve();
    },
  };
  return { table, rows };
}

const row: IdempotencyRow = { scope: "createListing", subject: "user-1", key: "key-1" };

describe("UT-idempotency (plan 05 section 10)", () => {
  it("lets the first call run", async () => {
    const { table } = memoryTable();
    expect(await beginIdempotent(table, row)).toEqual({ replay: false });
  });

  it("returns the first result to a repeat of a finished call", async () => {
    const { table } = memoryTable();
    await beginIdempotent(table, row);
    await completeIdempotent(table, row, { ok: true, data: "first" });
    expect(await beginIdempotent(table, row)).toEqual({
      replay: true,
      result: { ok: true, data: "first" },
    });
  });

  it("refuses a repeat of a call that is still running with CONFLICT", async () => {
    const { table } = memoryTable();
    await beginIdempotent(table, row);
    await expect(beginIdempotent(table, row)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("lets the user try again once a failed call has given its claim back", async () => {
    const { table } = memoryTable();
    await beginIdempotent(table, row);
    await releaseIdempotent(table, row);
    expect(await beginIdempotent(table, row)).toEqual({ replay: false });
  });

  it("keeps claims apart by action, by user and by key", async () => {
    const { table } = memoryTable();
    await beginIdempotent(table, row);
    expect(await beginIdempotent(table, { ...row, scope: "sendEnquiry" })).toEqual({
      replay: false,
    });
    expect(await beginIdempotent(table, { ...row, subject: "user-2" })).toEqual({ replay: false });
    expect(await beginIdempotent(table, { ...row, key: "key-2" })).toEqual({ replay: false });
  });

  it("takes the claim when it was given back between the insert and the read", async () => {
    const { table } = memoryTable();
    const inserts = [false, true];
    const racing: IdempotencyTable = {
      ...table,
      insertIfAbsent: () => Promise.resolve(inserts.shift() ?? false),
      read: () => Promise.resolve(null),
    };
    expect(await beginIdempotent(racing, row)).toEqual({ replay: false });
  });

  it("does not loop forever when the claim keeps disappearing", async () => {
    const { table } = memoryTable();
    const flapping: IdempotencyTable = {
      ...table,
      insertIfAbsent: () => Promise.resolve(false),
      read: () => Promise.resolve(null),
    };
    await expect(beginIdempotent(flapping, row)).rejects.toBeInstanceOf(ActionError);
  });
});

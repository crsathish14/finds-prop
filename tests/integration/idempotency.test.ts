import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createIdempotencyTable } from "@/server/idempotency/idempotency-table";
import {
  beginIdempotent,
  completeIdempotent,
  releaseIdempotent,
  type IdempotencyRow,
} from "@/server/idempotency/state";
import { adminClient, visitorClient } from "./support/clients";

const SCOPE = "it_idempotency";
const table = createIdempotencyTable(randomUUID());

function newRow(): IdempotencyRow {
  return { scope: SCOPE, subject: `it-${randomUUID()}`, key: randomUUID() };
}

afterAll(async () => {
  await adminClient().from("idempotency_keys").delete().eq("scope", SCOPE);
});

describe("IT-idempotency: one claim per (action, who, key) in the real table", () => {
  it("lets the first call run and stops a second call while the first is still running", async () => {
    const row = newRow();
    expect(await beginIdempotent(table, row)).toEqual({ replay: false });
    await expect(beginIdempotent(table, row)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("hands a repeat of a finished call the first result without running again", async () => {
    const row = newRow();
    await beginIdempotent(table, row);
    await completeIdempotent(table, row, { listingId: "abc", saved: true });
    expect(await beginIdempotent(table, row)).toEqual({
      replay: true,
      result: { listingId: "abc", saved: true },
    });
  });

  it("gives the claim back when the call fails, so the person can try again", async () => {
    const row = newRow();
    await beginIdempotent(table, row);
    await releaseIdempotent(table, row);
    expect(await beginIdempotent(table, row)).toEqual({ replay: false });
  });

  it("keeps different keys, different people and different actions apart", async () => {
    const row = newRow();
    await beginIdempotent(table, row);
    expect(await beginIdempotent(table, { ...row, key: randomUUID() })).toEqual({ replay: false });
    expect(await beginIdempotent(table, { ...row, subject: `it-${randomUUID()}` })).toEqual({
      replay: false,
    });
    expect(await beginIdempotent(table, { ...row, scope: `${SCOPE}_other` })).toEqual({
      replay: false,
    });
    await adminClient().from("idempotency_keys").delete().eq("scope", `${SCOPE}_other`);
  });

  it("lets only one of several simultaneous calls run", async () => {
    const row = newRow();
    const outcomes = await Promise.allSettled(
      Array.from({ length: 8 }, () => beginIdempotent(table, row)),
    );
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    for (const outcome of outcomes) {
      if (outcome.status === "rejected") expect(outcome.reason).toMatchObject({ code: "CONFLICT" });
    }
  });

  it("is closed to visitors, who could otherwise read or spend another person's claims", async () => {
    const row = newRow();
    await beginIdempotent(table, row);
    const read = await visitorClient().from("idempotency_keys").select("key").eq("scope", SCOPE);
    expect(read.error).not.toBeNull();
    const write = await visitorClient()
      .from("idempotency_keys")
      .insert({ scope: SCOPE, subject: row.subject, key: randomUUID() });
    expect(write.error).not.toBeNull();
  });
});

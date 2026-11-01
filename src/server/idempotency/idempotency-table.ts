import "server-only";
import { ActionError } from "../actions/normalise-error";
import { createAdminSupabase } from "../supabase/admin.server";
import type { Json } from "@/types/database.types";
import type { IdempotencyRow, IdempotencyTable } from "./state";

/** The claim table in the database. `idempotency_keys` is closed to users, so this uses the service role. */
export function createIdempotencyTable(requestId: string): IdempotencyTable {
  const client = createAdminSupabase(requestId);
  const fail = (what: string): never => {
    throw new ActionError("INTERNAL", `Idempotency: could not ${what}`);
  };
  return {
    async insertIfAbsent(row: IdempotencyRow) {
      const { data, error } = await client
        .from("idempotency_keys")
        .upsert(
          { scope: row.scope, subject: row.subject, key: row.key },
          { onConflict: "scope,subject,key", ignoreDuplicates: true },
        )
        .select("key");
      if (error) return fail("claim the key");
      return data.length > 0;
    },
    async read(row: IdempotencyRow) {
      const { data, error } = await client
        .from("idempotency_keys")
        .select("result")
        .eq("scope", row.scope)
        .eq("subject", row.subject)
        .eq("key", row.key)
        .maybeSingle();
      if (error) return fail("read the key");
      return data;
    },
    async save(row: IdempotencyRow, result: unknown) {
      const { error } = await client
        .from("idempotency_keys")
        .update({ result: result as Json })
        .eq("scope", row.scope)
        .eq("subject", row.subject)
        .eq("key", row.key);
      if (error) fail("store the result");
    },
    async remove(row: IdempotencyRow) {
      const { error } = await client
        .from("idempotency_keys")
        .delete()
        .eq("scope", row.scope)
        .eq("subject", row.subject)
        .eq("key", row.key);
      if (error) fail("release the key");
    },
  };
}

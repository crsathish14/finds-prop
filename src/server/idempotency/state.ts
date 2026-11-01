import { ActionError } from "../actions/normalise-error";

/**
 * Duplicate protection for creates (plan 05 section 10). The form makes a key when it opens; the
 * action claims (action, who, key) before it runs. A repeat of a finished action returns the first
 * result without running again. A repeat of one still running is refused with CONFLICT. An action
 * that fails gives its claim back so the user can try again.
 */
export interface IdempotencyRow {
  scope: string;
  subject: string;
  key: string;
}

/** The claim table, as the state logic sees it. */
export interface IdempotencyTable {
  /** True when this call created the claim, false when one already existed. */
  insertIfAbsent(row: IdempotencyRow): Promise<boolean>;
  /** The stored claim; `result` is null while the first call is still running. */
  read(row: IdempotencyRow): Promise<{ result: unknown } | null>;
  save(row: IdempotencyRow, result: unknown): Promise<void>;
  remove(row: IdempotencyRow): Promise<void>;
}

export type IdempotencyState = { replay: true; result: unknown } | { replay: false };

export async function beginIdempotent(
  table: IdempotencyTable,
  row: IdempotencyRow,
): Promise<IdempotencyState> {
  // Two tries: a claim given back between our insert and our read means we may now take it.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (await table.insertIfAbsent(row)) return { replay: false };
    const existing = await table.read(row);
    if (existing === null) continue;
    if (existing.result === null || existing.result === undefined) {
      throw new ActionError("CONFLICT", "The same request is already running");
    }
    return { replay: true, result: existing.result };
  }
  throw new ActionError("CONFLICT", "The same request is already running");
}

export function completeIdempotent(
  table: IdempotencyTable,
  row: IdempotencyRow,
  result: unknown,
): Promise<void> {
  return table.save(row, result);
}

export function releaseIdempotent(table: IdempotencyTable, row: IdempotencyRow): Promise<void> {
  return table.remove(row);
}

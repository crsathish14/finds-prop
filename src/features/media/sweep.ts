import { createHash, timingSafeEqual } from "node:crypto";
import { SWEEP_AFTER_HOURS, SWEEP_BATCH } from "./constants";

/**
 * The hourly sweep of photo files nobody claimed (S6-T01, ADR-015 step 4). A file lands in the bucket
 * before the server has looked at it, so a file with no `listing_media` row for 24 hours is one of: an
 * upload the browser never finished, a photo the owner removed, or a listing that was deleted. The
 * database lists them (`orphan_listing_photos`), this deletes them through the storage service.
 *
 * Who may call it: the scheduled job in the database sends the token stored in `internal_cron_tokens`
 * (`media_sweep`) in the `x-cron-token` header. Anything else is refused.
 */
export interface SweepStore {
  /** The token the job must send, or null when none is set (then nobody is let in). */
  readToken(): Promise<string | null>;
  listOrphans(olderThanHours: number, limit: number): Promise<string[]>;
  removeObjects(paths: string[]): Promise<void>;
}

/** Compares two secrets without leaking, through the length or the first difference, how close a guess was. */
export function sameSecret(provided: string, expected: string): boolean {
  const left = createHash("sha256").update(provided).digest();
  const right = createHash("sha256").update(expected).digest();
  return timingSafeEqual(left, right);
}

export type SweepResult = { allowed: false } | { allowed: true; removed: number };

export async function sweepOrphanPhotos(
  store: SweepStore,
  providedToken: string | null,
): Promise<SweepResult> {
  const expected = await store.readToken();
  if (!expected || !providedToken || !sameSecret(providedToken, expected)) {
    return { allowed: false };
  }
  const orphans = await store.listOrphans(SWEEP_AFTER_HOURS, SWEEP_BATCH);
  if (orphans.length > 0) await store.removeObjects(orphans);
  return { allowed: true, removed: orphans.length };
}

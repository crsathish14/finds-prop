import { MAX_ATTEMPTS, RETRY_MINUTES } from "./constants";

/**
 * The retry schedule (BR-66, UT-retry). `attempt` is the number of the delivery that has just failed, counting from 1.
 * After the first failure the next try is in 1 minute, then 5, 30, 120 and 720; after the sixth failure there is no
 * next try and the delivery stays failed.
 */
export function retryDelayMinutes(attempt: number): number | null {
  if (!Number.isInteger(attempt) || attempt < 1 || attempt >= MAX_ATTEMPTS) return null;
  return RETRY_MINUTES[attempt - 1] ?? null;
}

/** When the next try is due, or null when the tries are used up. */
export function nextRetryAt(attempt: number, now: Date): Date | null {
  const minutes = retryDelayMinutes(attempt);
  return minutes === null ? null : new Date(now.getTime() + minutes * 60_000);
}

/** The state a submission is left in after a failed delivery. */
export function stateAfterFailure(
  attempt: number,
  now: Date,
): { final: boolean; nextRetryAt: Date | null } {
  const next = nextRetryAt(attempt, now);
  return { final: next === null, nextRetryAt: next };
}

import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { logger } from "@/server/logger";
import { reportError } from "@/server/observability";
import { readRequestId } from "@/server/request-id";
import { DELIVERY_BATCH } from "./constants";
import { runDeliveries, syncRetryJob, type DeliveryStore } from "./delivery";
import { createDeliveryStore } from "./service";

/** Compares two secrets without leaking, through the length or the first difference, how close a guess was. */
export function sameSecret(provided: string, expected: string): boolean {
  const left = createHash("sha256").update(provided).digest();
  const right = createHash("sha256").update(expected).digest();
  return timingSafeEqual(left, right);
}

const noStore = { "Cache-Control": "no-store" };

/**
 * The route handler's body for `/api/internal/crm-retry` (S7-T09 part B2). The scheduled job in the database calls it
 * once a minute while a delivery waits, with the shared token in `x-cron-token` (BR-66, BR-67). A wrong or missing
 * token gets a plain 401 and nothing else; the answer to a good call is only how many submissions were taken, sent
 * and failed. Once nothing waits any more, the job turns itself off. `overrides` is for tests.
 */
export async function handleCrmRetry(
  request: Request,
  overrides: { store?: DeliveryStore; fetch?: typeof fetch } = {},
): Promise<Response> {
  const requestId = readRequestId(request.headers) ?? crypto.randomUUID();
  const log = logger.child({ requestId, route: "crm-retry" });
  try {
    const store = overrides.store ?? createDeliveryStore(requestId);
    const provided = request.headers.get("x-cron-token");
    const expected = await store.readToken();
    if (!expected || !provided || !sameSecret(provided, expected)) {
      log.warn("crm retry refused: token missing or wrong");
      return Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });
    }
    const summary = await runDeliveries(
      store,
      { limit: DELIVERY_BATCH },
      { fetch: overrides.fetch ?? fetch, log },
    );
    await syncRetryJob(store, summary, log, "job");
    log.info("crm retry done", {
      claimed: summary.claimed,
      sent: summary.sent,
      failed: summary.failed,
      lost: summary.lost,
    });
    return Response.json(
      { claimed: summary.claimed, sent: summary.sent, failed: summary.failed },
      { headers: noStore },
    );
  } catch (error) {
    log.error("crm retry failed", { error });
    await reportError(error, { source: "handler", requestId, route: "crm-retry" });
    return Response.json({ error: "failed" }, { status: 500, headers: noStore });
  }
}

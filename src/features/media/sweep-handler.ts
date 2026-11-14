import "server-only";
import { logger } from "@/server/logger";
import { reportError } from "@/server/observability";
import { readRequestId } from "@/server/request-id";
import { createSweepStore } from "./service";
import { sweepOrphanPhotos } from "./sweep";

/**
 * The route handler's body for `/api/internal/sweep-media` (S6-T01). The scheduled job in the database
 * calls it once an hour with the shared token in `x-cron-token`. A wrong or missing token gets a plain 401
 * and nothing else; the answer to a good call is only how many files were removed.
 */
export async function handleSweepMedia(request: Request): Promise<Response> {
  const requestId = readRequestId(request.headers) ?? crypto.randomUUID();
  const log = logger.child({ requestId, route: "sweep-media" });
  try {
    const result = await sweepOrphanPhotos(
      createSweepStore(requestId),
      request.headers.get("x-cron-token"),
    );
    if (!result.allowed) {
      log.warn("sweep refused: token missing or wrong");
      return Response.json(
        { error: "unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }
    log.info("sweep done", { removed: result.removed });
    return Response.json({ removed: result.removed }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    log.error("sweep failed", { error });
    await reportError(error, { source: "handler", requestId, route: "sweep-media" });
    return Response.json(
      { error: "failed" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

import "server-only";
import { updateTag } from "next/cache";
import { headers } from "next/headers";
import { writeAudit } from "../audit/audit";
import { getSessionView } from "../auth/get-session-view";
import type { SessionView } from "../auth/session";
import { env } from "../env";
import { createIdempotencyTable } from "../idempotency/idempotency-table";
import {
  beginIdempotent,
  completeIdempotent,
  releaseIdempotent,
  type IdempotencyRow,
} from "../idempotency/state";
import { createLogger } from "../logger";
import { enforceActionRateLimit } from "../rate-limit/rate-limit";
import { clientIp, visitorHash } from "../rate-limit/visitor-hash";
import { readRequestId } from "../request-id";
import type { ActionDeps, IdempotencyRequest } from "./define-action";

/** Who a claim belongs to: the signed-in user, or an anonymous visitor's hash. */
async function claimSubject(session: SessionView | null): Promise<string> {
  if (session) return session.userId;
  const incoming = await headers();
  return visitorHash(
    env.RATE_LIMIT_HMAC_SECRET,
    clientIp(incoming, env.APP_ENV !== "local"),
    incoming.get("user-agent") ?? "",
  );
}

async function rowFor(request: IdempotencyRequest): Promise<IdempotencyRow> {
  return { scope: request.scope, subject: await claimSubject(request.session), key: request.key };
}

/** The real dependencies of defineAction (S3-T07 and S3-T12). */
export const actionDeps: ActionDeps = {
  // The proxy gave the request an id; use it so logs, Supabase calls and audit entries agree.
  newRequestId: async () => readRequestId(await headers()) ?? crypto.randomUUID(),
  getSession: getSessionView,
  rateLimit: enforceActionRateLimit,
  beginIdempotent: async (request) =>
    beginIdempotent(createIdempotencyTable(request.requestId), await rowFor(request)),
  completeIdempotent: async (request) =>
    completeIdempotent(
      createIdempotencyTable(request.requestId),
      await rowFor(request),
      request.result,
    ),
  releaseIdempotent: async (request) =>
    releaseIdempotent(createIdempotencyTable(request.requestId), await rowFor(request)),
  // updateTag works only inside a Server Action, which is where defineAction runs (Next.js 16).
  invalidate: (tags) => {
    for (const tag of tags) updateTag(tag);
  },
  audit: writeAudit,
  log: createLogger(),
};

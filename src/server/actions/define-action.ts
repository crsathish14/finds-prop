import type { z } from "zod";
import type { ActionResult } from "@/types/action";
import { getSessionView } from "../auth/get-session-view";
import { assertAdmin, assertBuilder, assertUser, assertVerifiedPhone } from "../auth/guards";
import type { SessionView } from "../auth/session";
import { createLogger, type Logger } from "../logger";
import { toFieldErrors } from "./field-errors";
import { ActionError, toFailure } from "./normalise-error";

/**
 * defineAction: the single way to build a Server Action (R-BE-01).
 *
 * Pipeline, fixed order (R-BE-02, plan 05 section 5):
 *   1 parse  2 authenticate  3 authorise  4 rate limit  5 idempotency
 *   6 handler  7 cache invalidation  8 audit  9 normalise errors and return
 *
 * Stage 1 delivered the skeleton. S3-T07 supplies the real session. Every dependency that needs
 * infrastructure that does not exist yet (rate limits, idempotency table, audit log, cache) still
 * defaults to a FAIL-CLOSED stand-in: an action that asks for it gets an error rather than silently
 * skipping the protection. S3-T12 supplies those through `createDefineAction`.
 */

/**
 * Who may call the action. `user` is any signed-in account; `verified-phone` also needs a phone
 * confirmed by a code (customer write paths); `builder` needs the role and an active builder
 * record (BR-34, agents included); `super_admin` is the reserved admin.
 */
export type ActionAuth = "none" | "user" | "verified-phone" | { role: "builder" | "super_admin" };

export type { SessionView };

export interface ActionContext<I> {
  input: I;
  session: SessionView | null;
  requestId: string;
  log: Logger;
}

export interface ActionDeps {
  newRequestId(): string;
  getSession(): Promise<SessionView | null>;
  rateLimit(scope: string, session: SessionView | null): Promise<void>;
  beginIdempotent(key: string): Promise<{ replay: true; result: unknown } | { replay: false }>;
  completeIdempotent(key: string, result: unknown): Promise<void>;
  invalidate(tags: readonly string[]): void;
  audit(event: { action: string; session: SessionView | null; requestId: string }): Promise<void>;
  log: Logger;
}

export interface ActionConfig<S extends z.ZodType, R> {
  /** Named by intent, for example "submitEnquiry". */
  name: string;
  input: S;
  auth: ActionAuth;
  rateLimit?: { scope: string };
  idempotencyKey?: (input: z.infer<S>) => string;
  /** Cache tags to invalidate after a successful write. */
  invalidate?: (result: R, input: z.infer<S>) => readonly string[];
  audit?: { action: string };
  handler: (context: ActionContext<z.infer<S>>) => Promise<R>;
}

const notConfigured = (what: string) => (): never => {
  throw new ActionError("INTERNAL", `${what} is not configured`);
};

export const failClosedDeps: ActionDeps = {
  newRequestId: () => crypto.randomUUID(),
  getSession: () => Promise.resolve(null),
  rateLimit: notConfigured("Rate limiting"),
  beginIdempotent: notConfigured("Idempotency"),
  completeIdempotent: notConfigured("Idempotency"),
  invalidate: notConfigured("Cache invalidation"),
  audit: notConfigured("Audit"),
  log: createLogger(),
};

function authorise(auth: ActionAuth, session: SessionView | null): void {
  if (auth === "none") return;
  if (auth === "user") assertUser(session);
  else if (auth === "verified-phone") assertVerifiedPhone(session);
  else if (auth.role === "builder") assertBuilder(session);
  else assertAdmin(session);
}

/** Accepts plain objects or FormData (repeated keys become arrays). */
export function toInputObject(raw: unknown): unknown {
  if (typeof FormData !== "undefined" && raw instanceof FormData) {
    const result: Record<string, FormDataEntryValue | FormDataEntryValue[]> = {};
    for (const [key, value] of raw.entries()) {
      const existing = result[key];
      if (existing === undefined) result[key] = value;
      else if (Array.isArray(existing)) existing.push(value);
      else result[key] = [existing, value];
    }
    return result;
  }
  return raw;
}

export function createDefineAction(deps: ActionDeps) {
  return function defineAction<S extends z.ZodType, R>(config: ActionConfig<S, R>) {
    return async function action(raw: unknown): Promise<ActionResult<R>> {
      const requestId = deps.newRequestId();
      const log = deps.log.child({ requestId, route: config.name });
      const started = Date.now();
      try {
        // 1 parse
        const submitted = toInputObject(raw);
        const parsed = config.input.safeParse(submitted);
        if (!parsed.success) {
          throw new ActionError("VALIDATION", "Input failed validation", {
            fieldErrors: toFieldErrors(parsed.error, submitted),
          });
        }
        const input = parsed.data as z.infer<S>;

        // 2 authenticate
        const session = config.auth === "none" ? null : await deps.getSession();
        // 3 authorise
        authorise(config.auth, session);
        // 4 rate limit
        if (config.rateLimit) await deps.rateLimit(config.rateLimit.scope, session);

        // 5 idempotency
        let key: string | undefined;
        if (config.idempotencyKey) {
          key = config.idempotencyKey(input);
          const state = await deps.beginIdempotent(key);
          if (state.replay) return state.result as ActionResult<R>;
        }

        // 6 handler
        const data = await config.handler({ input, session, requestId, log });
        const result: ActionResult<R> = { ok: true, data };

        // 7 cache invalidation (after the write succeeded)
        if (config.invalidate) deps.invalidate(config.invalidate(data, input));
        // 8 audit
        if (config.audit) await deps.audit({ action: config.audit.action, session, requestId });
        if (key !== undefined) await deps.completeIdempotent(key, result);

        log.info("action ok", { durationMs: Date.now() - started });
        return result;
      } catch (error) {
        // 9 normalise: details to the log (redacted), a safe failure to the caller
        const failure = toFailure(error, requestId);
        log.error("action failed", {
          errorCode: failure.code,
          durationMs: Date.now() - started,
          error,
        });
        return failure;
      }
    };
  };
}

export const defineAction = createDefineAction({ ...failClosedDeps, getSession: getSessionView });

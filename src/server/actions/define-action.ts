import type { z } from "zod";
import type { ActionResult } from "@/types/action";
import { assertAdmin, assertBuilder, assertUser, assertVerifiedPhone } from "../auth/guards";
import type { SessionView } from "../auth/session";
import { createLogger, type Logger } from "../logger";
import type { ErrorContext } from "../observability";
import type { RateLimitScope } from "../rate-limit/limits";
import { actionDeps } from "./deps";
import { toFieldErrors } from "./field-errors";
import { ActionError, toFailure } from "./normalise-error";

/**
 * defineAction: the single way to build a Server Action (R-BE-01).
 *
 * Pipeline, fixed order (R-BE-02, plan 05 section 5):
 *   1 parse  2 authenticate  3 authorise  4 rate limit  5 idempotency
 *   6 handler  7 cache invalidation  8 audit  9 normalise errors and return
 *
 * Steps 4 and 5 protect the write, so a failure there refuses the call (fail closed). Once the
 * handler has saved something, steps 7 and 8 and storing the idempotent result can no longer undo
 * it: a failure there is logged as an error and the caller still gets the success. If the handler
 * itself fails, the idempotency claim is given back so the user can try again.
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

/** Names the claim: which action, who is acting (decided by the dependency), and the form's key. */
export interface IdempotencyRequest {
  scope: string;
  key: string;
  session: SessionView | null;
  requestId: string;
}

export interface ActionAuditEvent {
  action: string;
  entity?: { type: string; id?: string } | undefined;
  session: SessionView | null;
  requestId: string;
}

export interface ActionDeps {
  newRequestId(): string | Promise<string>;
  getSession(): Promise<SessionView | null>;
  rateLimit(request: {
    scope: RateLimitScope;
    session: SessionView | null;
    key?: string;
    requestId: string;
  }): Promise<void>;
  beginIdempotent(
    request: IdempotencyRequest,
  ): Promise<{ replay: true; result: unknown } | { replay: false }>;
  completeIdempotent(request: IdempotencyRequest & { result: unknown }): Promise<void>;
  releaseIdempotent(request: IdempotencyRequest): Promise<void>;
  invalidate(tags: readonly string[]): void;
  audit(event: ActionAuditEvent): Promise<void>;
  log: Logger;
  /** Sends an unexpected error to the error tracker (ADR-130). Optional: tests and local work have none. */
  reportError?(error: unknown, context: ErrorContext): Promise<void>;
}

export interface ActionConfig<S extends z.ZodType, R> {
  /** Named by intent, for example "submitEnquiry". Also names the idempotency claim. */
  name: string;
  input: S;
  auth: ActionAuth;
  /** The scope comes from the closed list in rate-limit/limits.ts; `key` feeds the rules that need one. */
  rateLimit?: { scope: RateLimitScope; key?: (input: z.infer<S>) => string };
  idempotencyKey?: (input: z.infer<S>) => string;
  /** Cache tags to invalidate after a successful write. */
  invalidate?: (result: R, input: z.infer<S>) => readonly string[];
  /** A history entry for an event the database triggers cannot see (staff sign-in and the like). */
  audit?: {
    action: string;
    entity?: (result: R, input: z.infer<S>) => { type: string; id?: string };
  };
  handler: (context: ActionContext<z.infer<S>>) => Promise<R>;
}

const notConfigured = (what: string) => (): never => {
  throw new ActionError("INTERNAL", `${what} is not configured`);
};

/** Stand-ins for tests: the protections that guard a write refuse, the rest only log. */
export const failClosedDeps: ActionDeps = {
  newRequestId: () => crypto.randomUUID(),
  getSession: () => Promise.resolve(null),
  rateLimit: notConfigured("Rate limiting"),
  beginIdempotent: notConfigured("Idempotency"),
  completeIdempotent: notConfigured("Idempotency"),
  releaseIdempotent: notConfigured("Idempotency"),
  invalidate: notConfigured("Cache invalidation"),
  audit: notConfigured("Audit"),
  log: createLogger(),
};

/** The most powerful role the session holds, or "anonymous". A label for reports, never an id. */
function roleOf(session: SessionView | null): string {
  if (!session) return "anonymous";
  if (session.roles.includes("super_admin")) return "super_admin";
  if (session.roles.includes("builder")) return "builder";
  return "customer";
}

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
      const requestId = await deps.newRequestId();
      const log = deps.log.child({ requestId, route: config.name });
      const started = Date.now();

      // Known once authentication has run; the error tracker is told who was acting (role only).
      let actor: SessionView | null = null;
      const report = async (error: unknown, errorCode: string): Promise<void> => {
        try {
          await deps.reportError?.(error, {
            source: "action",
            requestId,
            route: config.name,
            errorCode,
            role: roleOf(actor),
          });
        } catch {
          // Reporting must never change what the caller gets.
        }
      };

      /** After the write: log a failure and carry on, because the data is already saved. */
      const afterWrite = async (what: string, step: () => void | Promise<void>) => {
        try {
          await step();
        } catch (error) {
          log.error(`${what} failed after the write`, { error });
          await report(error, "AFTER_WRITE");
        }
      };

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
        actor = session;
        // 3 authorise
        authorise(config.auth, session);
        // 4 rate limit
        if (config.rateLimit) {
          const key = config.rateLimit.key?.(input);
          await deps.rateLimit({
            scope: config.rateLimit.scope,
            session,
            requestId,
            ...(key !== undefined ? { key } : {}),
          });
        }

        // 5 idempotency
        let claim: IdempotencyRequest | undefined;
        if (config.idempotencyKey) {
          claim = { scope: config.name, key: config.idempotencyKey(input), session, requestId };
          const state = await deps.beginIdempotent(claim);
          if (state.replay) return state.result as ActionResult<R>;
        }

        // 6 handler: a failure gives the claim back so the user can try again
        let data: R;
        try {
          data = await config.handler({ input, session, requestId, log });
        } catch (error) {
          if (claim) {
            const held = claim;
            await afterWrite("giving the idempotency claim back", () =>
              deps.releaseIdempotent(held),
            );
          }
          throw error;
        }
        const result: ActionResult<R> = { ok: true, data };

        // 7 cache invalidation
        if (config.invalidate) {
          const tags = config.invalidate(data, input);
          await afterWrite("cache invalidation", () => deps.invalidate(tags));
        }
        // 8 audit
        if (config.audit) {
          const { action: auditAction, entity } = config.audit;
          await afterWrite("audit", () =>
            deps.audit({ action: auditAction, entity: entity?.(data, input), session, requestId }),
          );
        }
        if (claim) {
          const held = claim;
          await afterWrite("storing the idempotent result", () =>
            deps.completeIdempotent({ ...held, result }),
          );
        }

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
        // Only the unexpected is reported: a refusal, a missing record or bad input is not a bug.
        if (failure.code === "INTERNAL") await report(error, failure.code);
        return failure;
      }
    };
  };
}

export const defineAction = createDefineAction(actionDeps);

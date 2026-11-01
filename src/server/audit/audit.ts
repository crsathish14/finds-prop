import "server-only";
import { headers } from "next/headers";
import { env } from "../env";
import { ActionError } from "../actions/normalise-error";
import type { SessionView } from "../auth/session";
import { clientIp, hashValue } from "../rate-limit/visitor-hash";
import { createAdminSupabase } from "../supabase/admin.server";

/**
 * audit_record() accepts null for the actor (a system event), the entity id and the address hash
 * (it is not declared STRICT), but the generated types mark every argument as required text. This
 * is the one place that says so.
 */
const optional = (value: string | null) => value as string;

export interface AuditEvent {
  action: string;
  entity?: { type: string; id?: string } | undefined;
  session: SessionView | null;
  requestId: string;
}

/** How the log names the actor (the database accepts exactly these four). */
export function actorKind(
  session: SessionView | null,
): "super_admin" | "builder" | "customer" | "system" {
  if (!session) return "system";
  if (session.roles.includes("super_admin")) return "super_admin";
  if (session.builderId !== null) return "builder";
  return "customer";
}

/**
 * Writes one history entry for an action the database triggers cannot see (staff sign-in and the
 * like), through the service-only audit_record(). It holds names and ids only: no phone, no email,
 * no message text. The address is stored as a hash, and not at all when the secret is missing.
 */
export async function writeAudit(event: AuditEvent): Promise<void> {
  const incoming = await headers();
  const secret = env.RATE_LIMIT_HMAC_SECRET;
  const ipHash = secret ? hashValue(secret, clientIp(incoming, env.APP_ENV !== "local")) : null;
  const client = createAdminSupabase(event.requestId);
  const { error } = await client.rpc("audit_record", {
    actor: optional(event.session?.userId ?? null),
    actor_kind: actorKind(event.session),
    action_name: event.action,
    entity_kind: event.entity?.type ?? "action",
    entity_key: optional(event.entity?.id ?? null),
    change: {},
    request_key: event.requestId,
    ip_digest: optional(ipHash),
  });
  if (error) throw new ActionError("INTERNAL", "Could not write the audit entry");
}

import { ActionError } from "@/server/actions/normalise-error";
import type { Logger } from "@/server/logger";
import { DELIVERY_CONCURRENCY } from "./constants";
import { stateAfterFailure } from "./retry";
import {
  sendToCrm,
  type CrmConnection,
  type CrmSecrets,
  type CrmSendResult,
  type SendDeps,
} from "./send";

/**
 * The delivery engine (S7-T09 part B2, FR-ADM-09, BR-64 to BR-66, ADR-116): take the submissions the database says are
 * due, send each to its CRM with the part A sender, and record what came of it. The database decides who is due and
 * keeps the rules of the states (ADR-114); this file decides what to send and what to do next. It reaches nothing
 * itself: the claim, the connection with its secrets, the record and the cron job come in through `DeliveryStore`, and
 * a test passes stand-ins for those and for `fetch`.
 */

/** A submission the database has leased to this run. */
export interface DueDelivery {
  submissionId: string;
  integrationId: string;
  /** The number of this attempt, from 1. */
  attempt: number;
  formName: string;
  projectId: string | null;
  projectName: string | null;
  projectSlug: string | null;
  name: string | null;
  mobile: string | null;
  email: string | null;
  /** The answers as stored: an object of text, numbers, lists. */
  data: unknown;
  source: string | null;
  createdAt: string;
}

/** What one attempt came to, as the database records it. */
export interface DeliveryRecord {
  submissionId: string;
  integrationName: string;
  attempt: number;
  ok: boolean;
  httpStatus: number | null;
  snippet: string;
  leadId: string | null;
  /** When the next try is due; null after a success and after the sixth attempt. */
  nextRetry: Date | null;
}

export interface DeliveryStore {
  /** Leases due submissions (or the one named). */
  claim(limit: number, submissionId?: string): Promise<DueDelivery[]>;
  /** The connection with its secrets and project codes, or null when it is gone. */
  readConnection(integrationId: string): Promise<{
    name: string;
    connection: CrmConnection;
    secrets: CrmSecrets;
    projectCodes: Record<string, string>;
  } | null>;
  record(entry: DeliveryRecord): Promise<void>;
  /** The token the retry route must be sent, or null when none is set. */
  readToken(): Promise<string | null>;
  /** Whether a submission on an active connection still waits to be sent or retried. */
  hasWaiting(): Promise<boolean>;
  armRetryJob(): Promise<void>;
  disarmRetryJob(): Promise<void>;
}

export interface DeliveryDeps extends SendDeps {
  log: Logger;
}

/** What one attempt came to, for the caller. */
export interface DeliveryOutcome {
  submissionId: string;
  ok: boolean;
  /** The CRM's HTTP status, or null when there was no answer. */
  status: number | null;
  /** A later try was scheduled. */
  retryScheduled: boolean;
}

export interface DeliverySummary {
  claimed: number;
  sent: number;
  failed: number;
  /** Attempts that were sent but whose result could not be recorded; the lease ends and the sweep takes them again. */
  lost: number;
  retryScheduled: boolean;
  outcomes: DeliveryOutcome[];
}

const scalar = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(scalar).filter(Boolean).join(", ");
  return "";
};

/**
 * What the connection's templates can use: the form's answers, then the facts of the lead. The contact columns win
 * over an answer of the same name when they are filled in. `project_code` is the connection's own code for the
 * project, or nothing.
 */
export function leadValues(
  due: DueDelivery,
  projectCodes: Record<string, string>,
): Record<string, string> {
  const values: Record<string, string> = {};
  if (typeof due.data === "object" && due.data !== null && !Array.isArray(due.data)) {
    for (const [key, answer] of Object.entries(due.data)) values[key] = scalar(answer);
  }
  if (due.name) values["name"] = due.name;
  if (due.mobile) values["mobile"] = due.mobile;
  if (due.email) values["email"] = due.email;
  values["form_name"] = due.formName;
  values["project_id"] = due.projectId ?? "";
  values["project_name"] = due.projectName ?? "";
  values["project_slug"] = due.projectSlug ?? "";
  values["project_code"] = (due.projectId ? projectCodes[due.projectId] : undefined) ?? "";
  values["source"] = due.source ?? "";
  values["submitted_at"] = due.createdAt;
  values["submission_id"] = due.submissionId;
  return values;
}

const noAnswer = (snippet: string): CrmSendResult => ({
  ok: false,
  status: null,
  snippet,
  leadId: null,
  durationMs: 0,
});

/**
 * Sends one leased submission and records the result. A connection that is gone, or any unexpected error while
 * sending, is a failed attempt with a plain sentence, so the submission follows the same schedule as any other
 * failure. If the result cannot be recorded this throws: the lease then ends by itself and the sweep takes the
 * submission again.
 */
export async function deliverOne(
  store: DeliveryStore,
  due: DueDelivery,
  deps: DeliveryDeps,
): Promise<DeliveryOutcome> {
  const now = deps.now ?? Date.now;
  let integrationName = "CRM";
  let result: CrmSendResult;
  try {
    const found = await store.readConnection(due.integrationId);
    if (!found) {
      result = noAnswer("The connection was deleted.");
    } else {
      integrationName = found.name;
      result = await sendToCrm(
        found.connection,
        found.secrets,
        leadValues(due, found.projectCodes),
        deps,
      );
    }
  } catch (error) {
    deps.log.error("crm delivery failed unexpectedly", { submissionId: due.submissionId, error });
    result = noAnswer("The delivery could not be sent.");
  }
  const next = result.ok ? null : stateAfterFailure(due.attempt, new Date(now())).nextRetryAt;
  await store.record({
    submissionId: due.submissionId,
    integrationName,
    attempt: due.attempt,
    ok: result.ok,
    httpStatus: result.status,
    snippet: result.snippet,
    leadId: result.leadId,
    nextRetry: next,
  });
  return {
    submissionId: due.submissionId,
    ok: result.ok,
    status: result.status,
    retryScheduled: next !== null,
  };
}

/**
 * Claims what is due (or the one submission named) and sends it, a few at a time. One submission that cannot be
 * recorded does not stop the others.
 */
export async function runDeliveries(
  store: DeliveryStore,
  options: { limit: number; submissionId?: string },
  deps: DeliveryDeps,
): Promise<DeliverySummary> {
  const due = await store.claim(options.limit, options.submissionId);
  const outcomes: DeliveryOutcome[] = [];
  let lost = 0;
  for (let start = 0; start < due.length; start += DELIVERY_CONCURRENCY) {
    const chunk = due.slice(start, start + DELIVERY_CONCURRENCY);
    const settled = await Promise.allSettled(chunk.map((entry) => deliverOne(store, entry, deps)));
    settled.forEach((item, index) => {
      if (item.status === "fulfilled") {
        outcomes.push(item.value);
      } else {
        lost += 1;
        deps.log.error("crm delivery result could not be recorded", {
          submissionId: chunk[index]?.submissionId,
          error: item.reason,
        });
      }
    });
  }
  return {
    claimed: due.length,
    sent: outcomes.filter((outcome) => outcome.ok).length,
    failed: outcomes.filter((outcome) => !outcome.ok).length,
    lost,
    retryScheduled: outcomes.some((outcome) => outcome.retryScheduled),
    outcomes,
  };
}

/** Arms the job; if that fails (the site address or token is not set yet) it is logged and nothing is raised. */
export async function armRetryJobQuietly(store: DeliveryStore, log: Logger): Promise<void> {
  try {
    await store.armRetryJob();
  } catch (error) {
    log.warn("the crm retry job could not be armed", { error });
  }
}

/**
 * Keeps the once-a-minute job in step with the work (BR-66: armed and disarmed as needed). After a send that left a
 * retry waiting, or lost a result, the job is armed. Inside the job's own run, it is disarmed once nothing waits.
 * Changing the job can fail (the site address or the token is not set yet); that is logged, never raised, so a
 * visitor's form or the admin's button is not affected.
 */
export async function syncRetryJob(
  store: DeliveryStore,
  summary: DeliverySummary,
  log: Logger,
  from: "job" | "other",
): Promise<void> {
  try {
    if (from === "job") {
      if (!(await store.hasWaiting())) await store.disarmRetryJob();
    } else if (summary.retryScheduled || summary.lost > 0) {
      await store.armRetryJob();
    }
  } catch (error) {
    log.warn("the crm retry job could not be changed", { from, error });
  }
}

/** "Retry delivery now": sends one submission at once, on a fresh schedule. */
export async function retryDelivery(
  store: DeliveryStore,
  input: { submissionId: string },
  deps: DeliveryDeps,
): Promise<{ summary: DeliverySummary; outcome: DeliveryOutcome }> {
  const summary = await runDeliveries(store, { limit: 1, submissionId: input.submissionId }, deps);
  const outcome = summary.outcomes[0];
  if (!outcome && summary.lost > 0) {
    throw new ActionError("INTERNAL", "The result of the delivery could not be saved");
  }
  if (!outcome) {
    // Not found, already sent, being sent by another run, or on an inactive connection.
    throw new ActionError("CONFLICT", "The submission cannot be sent now");
  }
  return { summary, outcome };
}

import { z } from "zod";

/**
 * One line of the delivery log as the admin's API logs tab draws it (S7-T09, FR-ADM-09). Dates are ISO text; the
 * screen formats them. The answer is already cut to 500 characters and has the secrets blanked out by the server
 * that wrote it, so it is safe to show.
 */
export interface CrmLogView {
  id: string;
  createdAt: string;
  integrationName: string;
  /** The form's name, or "Connection test" for a test call. */
  formName: string | null;
  outcome: "success" | "failed";
  /** The CRM's HTTP status, or null when there was no answer. */
  httpStatus: number | null;
  attempt: number;
  snippet: string | null;
  /** The submission the call was for; a test call has none. */
  submissionId: string | null;
  /**
   * True only for the newest line of a submission that is still failed, so "Retry" is offered once for it and never
   * on an older line or on a test.
   */
  retryable: boolean;
}

export interface CrmLogsPage {
  logs: CrmLogView[];
  /** How many form submissions are failed right now (not how many failed lines the log holds). */
  failedSubmissions: number;
}

const rowSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  integration_name: z.string(),
  form_name: z.string().nullable(),
  outcome: z.enum(["success", "failed"]),
  http_status: z.number().int().nullable(),
  attempt: z.number().int().min(1),
  response_snippet: z.string().nullable(),
  submission_id: z.string().nullable(),
});

/**
 * Pure: the log rows, newest first, as views. `stillFailed` holds the ids of the submissions whose CRM state is
 * failed now. A row not in the expected shape is left out and counted, so one odd row never takes the page down.
 * Because the rows are newest first, the first line seen for a submission is its latest one.
 */
export function toCrmLogViews(
  rows: readonly unknown[] | null,
  stillFailed: ReadonlySet<string>,
): { logs: CrmLogView[]; skipped: number } {
  const logs: CrmLogView[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  for (const raw of rows ?? []) {
    const parsed = rowSchema.safeParse(raw);
    if (!parsed.success) {
      skipped += 1;
      continue;
    }
    const row = parsed.data;
    const latest = row.submission_id !== null && !seen.has(row.submission_id);
    if (row.submission_id !== null) seen.add(row.submission_id);
    logs.push({
      id: row.id,
      createdAt: row.created_at,
      integrationName: row.integration_name,
      formName: row.form_name,
      outcome: row.outcome,
      httpStatus: row.http_status,
      attempt: row.attempt,
      snippet: row.response_snippet,
      submissionId: row.submission_id,
      retryable:
        latest &&
        row.outcome === "failed" &&
        row.submission_id !== null &&
        stillFailed.has(row.submission_id),
    });
  }
  return { logs, skipped };
}

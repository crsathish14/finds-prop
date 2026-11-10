import { ActionError } from "@/server/actions/normalise-error";
import type { CrmMethod } from "./constants";
import { assertSafeUrl, UnsafeUrlError, type HostLookup } from "./safe-url";
import { joinUrl, sendToCrm, type CrmConnection, type CrmSecrets, type SendDeps } from "./send";
import type { DeleteIntegrationInput, SaveIntegrationInput, TestIntegrationInput } from "./schemas";

/**
 * The rules of the admin's CRM connections (S7-T09, FR-ADM-09), apart from the code that reaches the database so they
 * can be tested with a stand-in. Saving and deleting go through the admin's own session (`CrmAdminStore`): the
 * database lets only the super admin write, records each change in the audit log with the admin as the actor, and
 * keeps the secrets in a table nobody but the service role can read (BR-64). Only a test of a connection needs the
 * secrets, so it alone uses the service role (`CrmSendStore`). This file checks the address before anything is
 * stored or sent (BR-65) and turns what the database answers into the closed set of action errors.
 */

/** The columns of a connection the admin writes, as the save function takes them. */
// A type alias, not an interface, so it counts as a JSON object when it is passed to the save function.
export type CrmRow = {
  name: string;
  lead_source: string | null;
  base_url: string;
  endpoint: string | null;
  method: CrmMethod;
  lead_id_path: string | null;
  active: boolean;
  headers: Record<string, string>;
  body_mapping: Record<string, string>;
  project_codes: Record<string, string>;
};

/** The secrets to change: text sets one, null clears one, a key left out keeps what is stored. */
export type SecretChanges = Partial<
  Record<"api_key" | "api_secret" | "access_token", string | null>
>;

export interface CrmSaved {
  integrationId: string;
}

/** Calls made as the signed-in admin. Each throws the database's failure through `mapCrmError`. */
export interface CrmAdminStore {
  save(row: CrmRow, integrationId: string | null, secrets: SecretChanges): Promise<CrmSaved>;
  remove(integrationId: string): Promise<CrmSaved>;
}

/** One line of the delivery log. */
export interface CrmLogEntry {
  integrationId: string;
  integrationName: string;
  formName: string;
  outcome: "success" | "failed";
  httpStatus: number | null;
  attempt: number;
  snippet: string;
}

/** Calls made with the service role, for what only the server may see. */
export interface CrmSendStore {
  /** The connection with its secrets, or null when there is none. */
  readForSend(integrationId: string): Promise<{
    name: string;
    connection: CrmConnection;
    secrets: CrmSecrets;
    projectCodes: Record<string, string>;
  } | null>;
  writeLog(entry: CrmLogEntry): Promise<void>;
}

/** What the database says when a call fails. */
export interface DatabaseFailure {
  code?: string | undefined;
  message?: string | undefined;
}

/** Turns what the database raises into the closed set of action errors. */
export function mapCrmError(failure: DatabaseFailure): ActionError {
  const { code, message } = failure;
  if (code === "42501" || message === "crm.not_allowed") {
    return new ActionError("FORBIDDEN", "You don't have permission to do that.");
  }
  if (code === "P0002" || code === "PGRST116" || message === "crm.not_found") {
    return new ActionError("NOT_FOUND", "The connection was not found");
  }
  if (code === "23514" || code === "22023" || code === "22P02") {
    return new ActionError("VALIDATION", "The database refused a value", {
      fieldErrors: { _form: [{ key: "validation.invalid" }] },
    });
  }
  return new ActionError("INTERNAL", "The connection could not be saved");
}

/** The address was refused: the message goes on the address box. */
export function addressRefused(): ActionError {
  return new ActionError("VALIDATION", "The address is not allowed", {
    fieldErrors: { baseUrl: [{ key: "validation.crmUrlNotAllowed" }] },
  });
}

const toObject = (rows: readonly { name: string; value: string }[]): Record<string, string> =>
  Object.fromEntries(rows.map((row) => [row.name, row.value]));

/** The columns from what the screen sent. */
export function toCrmRow(input: SaveIntegrationInput): CrmRow {
  return {
    name: input.name,
    lead_source: input.leadSource ?? null,
    base_url: input.baseUrl,
    endpoint: input.endpoint ?? null,
    method: input.method,
    lead_id_path: input.leadIdPath ?? null,
    active: input.active,
    headers: toObject(input.headers),
    body_mapping: toObject(input.bodyMapping.map((row) => ({ name: row.field, value: row.value }))),
    project_codes: Object.fromEntries(input.projectCodes.map((row) => [row.projectId, row.code])),
  };
}

/** Only the secrets the screen sent: text sets, null clears, left out keeps. */
export function toSecretChanges(secrets: SaveIntegrationInput["secrets"]): SecretChanges {
  const changes: SecretChanges = {};
  if (secrets?.apiKey !== undefined) changes.api_key = secrets.apiKey;
  if (secrets?.apiSecret !== undefined) changes.api_secret = secrets.apiSecret;
  if (secrets?.accessToken !== undefined) changes.access_token = secrets.accessToken;
  return changes;
}

/** Checks the address, then saves. An address that is not public https is refused before anything is stored. */
export async function saveIntegration(
  store: CrmAdminStore,
  input: SaveIntegrationInput,
  lookup?: HostLookup,
): Promise<CrmSaved> {
  try {
    await assertSafeUrl(joinUrl(input.baseUrl, input.endpoint ?? null), lookup);
  } catch (error) {
    if (error instanceof UnsafeUrlError) throw addressRefused();
    throw error;
  }
  return store.save(toCrmRow(input), input.integrationId ?? null, toSecretChanges(input.secrets));
}

export function deleteIntegration(
  store: CrmAdminStore,
  input: DeleteIntegrationInput,
): Promise<CrmSaved> {
  return store.remove(input.integrationId);
}

/** The lead a test sends. It is plainly a test, and carries no real person's details. */
export const TEST_LEAD: Record<string, string> = {
  name: "Find Prop test",
  mobile: "9000000000",
  email: "test@findprop.invalid",
  message: "This is a test from Find Prop. Please ignore it.",
  form_name: "Connection test",
  project_name: "Test project",
  project_slug: "test-project",
  project_code: "TEST",
  project_id: "",
  submission_id: "",
  submitted_at: "2026-01-01T00:00:00.000Z",
};

/** What a test came to, for the page to say: no secret and no answer text. */
export interface CrmTestResult {
  integrationName: string;
  ok: boolean;
  /** The CRM's HTTP status, or null when there was no answer (not allowed, unreachable, too slow). */
  status: number | null;
  durationMs: number;
}

/**
 * Sends the test lead to a connection, active or not, and writes one line in the delivery log (with no submission).
 * The log line holds the start of the answer, cut and with the secrets blanked out.
 */
export async function testIntegration(
  store: CrmSendStore,
  input: TestIntegrationInput,
  deps: SendDeps,
): Promise<CrmTestResult> {
  const found = await store.readForSend(input.integrationId);
  if (!found) throw new ActionError("NOT_FOUND", "The connection was not found");
  const result = await sendToCrm(found.connection, found.secrets, TEST_LEAD, deps);
  await store.writeLog({
    integrationId: input.integrationId,
    integrationName: found.name,
    formName: TEST_LEAD["form_name"] ?? "Connection test",
    outcome: result.ok ? "success" : "failed",
    httpStatus: result.status,
    attempt: 1,
    snippet: result.snippet,
  });
  return {
    integrationName: found.name,
    ok: result.ok,
    status: result.status,
    durationMs: result.durationMs,
  };
}

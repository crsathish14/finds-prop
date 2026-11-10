import { REQUEST_TIMEOUT_MS, RESPONSE_BYTES_MAX, SNIPPET_MAX, type CrmMethod } from "./constants";
import { joinUrl } from "./address";
import { assertSafeUrl, UnsafeUrlError, type HostLookup } from "./safe-url";

/**
 * One call to a CRM (S7-T09, FR-ADM-09, BR-64, BR-65): fill the connection's templates, check the address, send with
 * redirects off, a time limit and a size limit, and read the answer. Used by the admin's "Test API" and, in the next
 * part, by the delivery engine, so both behave the same. Nothing here reaches the database: the connection and its
 * secrets come in, the outcome goes out, and a test passes a stand-in for `fetch` and for the address lookup.
 * Whatever is logged or shown is cut and has every secret in it blanked out (BR-64).
 */
export interface CrmConnection {
  baseUrl: string;
  endpoint: string | null;
  method: CrmMethod;
  leadSource: string | null;
  leadIdPath: string | null;
  /** Header name to template. */
  headers: Record<string, string>;
  /** CRM field to template. */
  bodyMapping: Record<string, string>;
}

export interface CrmSecrets {
  apiKey: string | null;
  apiSecret: string | null;
  accessToken: string | null;
}

/** What one call came to. `status` is null when there was no answer at all. */
export interface CrmSendResult {
  ok: boolean;
  status: number | null;
  /** The start of the answer, or a plain sentence about why there was none. Never holds a secret. */
  snippet: string;
  /** The lead's id in the CRM, when the answer has it at the connection's lead id path. */
  leadId: string | null;
  durationMs: number;
}

export interface SendDeps {
  fetch: typeof fetch;
  lookup?: HostLookup;
  now?: () => number;
}

/** Puts `{{name}}` in a template: the value of `name`, or nothing when there is none. */
export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(
    /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g,
    (_whole, key: string) => values[key] ?? "",
  );
}

/** A value inside a JSON answer by its dotted path (`data.lead.id`); only text and numbers count. */
export function pickPath(json: unknown, path: string | null): string | null {
  if (!path) return null;
  let current: unknown = json;
  for (const part of path.split(".")) {
    if (typeof current !== "object" || current === null) return null;
    current = (current as Record<string, unknown>)[part];
  }
  if (typeof current === "string") return current.slice(0, 120) || null;
  if (typeof current === "number" && Number.isFinite(current)) return String(current);
  return null;
}

/** The text with every secret value replaced by asterisks, so an answer that echoes one cannot leak it. */
export function redact(text: string, secrets: CrmSecrets): string {
  let out = text;
  for (const value of [secrets.apiKey, secrets.apiSecret, secrets.accessToken]) {
    if (value && value.length >= 4) out = out.split(value).join("***");
  }
  return out;
}

async function readCapped(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < RESPONSE_BYTES_MAX) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.byteLength;
  }
  await reader.cancel().catch(() => undefined);
  const joined = new Uint8Array(Math.min(size, RESPONSE_BYTES_MAX));
  let offset = 0;
  for (const chunk of chunks) {
    const room = joined.length - offset;
    if (room <= 0) break;
    joined.set(chunk.subarray(0, room), offset);
    offset += Math.min(chunk.byteLength, room);
  }
  return new TextDecoder().decode(joined);
}

const failed = (snippet: string, startedAt: number, now: () => number): CrmSendResult => ({
  ok: false,
  status: null,
  snippet,
  leadId: null,
  durationMs: Math.max(0, now() - startedAt),
});

/**
 * Sends one lead. `values` are the form's answers and the extra facts of the lead (form name, project name, ...);
 * the connection's lead source and secrets are available to the templates as `lead_source`, `api_key`, `api_secret`
 * and `access_token`. A 2xx answer is a success; anything else, and any failure to get an answer, is a failure with a
 * sentence the admin can act on.
 */
export async function sendToCrm(
  connection: CrmConnection,
  secrets: CrmSecrets,
  values: Record<string, string>,
  deps: SendDeps,
): Promise<CrmSendResult> {
  const now = deps.now ?? Date.now;
  const startedAt = now();
  const variables: Record<string, string> = {
    ...values,
    lead_source: connection.leadSource ?? "",
    api_key: secrets.apiKey ?? "",
    api_secret: secrets.apiSecret ?? "",
    access_token: secrets.accessToken ?? "",
  };

  let url: URL;
  try {
    url = await assertSafeUrl(joinUrl(connection.baseUrl, connection.endpoint), deps.lookup);
  } catch (error) {
    if (error instanceof UnsafeUrlError) {
      return failed("This address is not allowed: it must be https and public.", startedAt, now);
    }
    throw error;
  }

  const headers = new Headers();
  try {
    for (const [name, template] of Object.entries(connection.headers)) {
      headers.set(name, fillTemplate(template, variables));
    }
  } catch {
    return failed("A header could not be sent. Check the header values.", startedAt, now);
  }
  if (!headers.has("content-type")) headers.set("content-type", "application/json");
  const body: Record<string, string> = {};
  for (const [field, template] of Object.entries(connection.bodyMapping)) {
    body[field] = fillTemplate(template, variables);
  }

  let response: Response;
  try {
    response = await deps.fetch(url.toString(), {
      method: connection.method,
      headers,
      body: JSON.stringify(body),
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut =
      error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return failed(
      timedOut ? "The CRM did not answer in time." : "The CRM could not be reached.",
      startedAt,
      now,
    );
  }

  let text: string;
  try {
    text = await readCapped(response);
  } catch {
    text = "";
  }
  const durationMs = Math.max(0, now() - startedAt);
  const redirected = response.status >= 300 && response.status < 400;
  const snippet = redirected
    ? "The CRM tried to send the call to another address, which is not followed."
    : redact(text, secrets).slice(0, SNIPPET_MAX);
  const ok = response.ok && !redirected;
  let leadId: string | null = null;
  if (ok) {
    try {
      leadId = pickPath(JSON.parse(text) as unknown, connection.leadIdPath);
    } catch {
      leadId = null;
    }
  }
  return { ok, status: response.status, snippet, leadId, durationMs };
}

export { joinUrl };

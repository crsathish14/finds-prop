import { AI_MAX_REQUEST_BYTES } from "@/config/ai";
import { chatRequestSchema, type ChatRequest } from "./request";

/**
 * Step 2 of the endpoint: is this a request it accepts, and what does it say. The checks that need no database
 * and no secret come first and cost nothing: where the request came from, what it claims to be, how big it is, then
 * the JSON and the shape (`request.ts`). The body is read up to a byte limit and never further.
 */

/**
 * Whether a browser sent this from our own pages. A browser always says where a POST came from: `Sec-Fetch-Site`,
 * and `Origin`. Anything from another site is refused (the endpoint counts a message and costs money, and a signed-in
 * visitor's cookie must not be usable from a page of someone else). A request with neither header is not a browser
 * and carries no cookie of the visitor's to abuse. The endpoint also needs `application/json`, which a cross-site
 * form cannot send without a preflight that this endpoint never answers.
 */
function isSameOrigin(headers: Pick<Headers, "get">): boolean {
  const site = headers.get("sec-fetch-site");
  if (site !== null && site !== "same-origin" && site !== "none") return false;
  const origin = headers.get("origin");
  if (origin === null) return true;
  const host = (headers.get("x-forwarded-host") ?? headers.get("host"))?.split(",")[0]?.trim();
  try {
    return host !== undefined && host !== "" && new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** The body as text, or `null` when it is larger than `AI_MAX_REQUEST_BYTES`. Stops reading at the limit. */
async function readLimitedText(request: Request): Promise<string | null> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > AI_MAX_REQUEST_BYTES) return null;
  const reader = request.body?.getReader();
  if (reader === undefined) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > AI_MAX_REQUEST_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

export type ParsedRequest =
  | { readonly ok: true; readonly request: ChatRequest }
  | { readonly ok: false; readonly status: 400 | 403 | 413 | 415 };

export async function parseChatRequest(request: Request): Promise<ParsedRequest> {
  if (!isSameOrigin(request.headers)) return { ok: false, status: 403 };
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) return { ok: false, status: 415 };
  const text = await readLimitedText(request);
  if (text === null) return { ok: false, status: 413 };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, status: 400 };
  }
  const parsed = chatRequestSchema.safeParse(json);
  return parsed.success ? { ok: true, request: parsed.data } : { ok: false, status: 400 };
}

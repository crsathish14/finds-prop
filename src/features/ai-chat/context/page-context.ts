/**
 * The page context of the chat (ADR-128 section 10, AI-P7-T01): which item the customer was looking at when they
 * opened the chat. Only public ids travel: `?home=<shortId>`, `?project=<slug>` or `?compare=<id>,<id>[,<id>]`, in the
 * link and again in the request body. No title, price or any listing text is ever carried, so nothing in a link can
 * put words into the assistant's mouth. The server checks every id against what is listed now before it is used
 * (`resolve.ts`); this file is only the shape and the link, so the buttons and the page share one definition.
 */

/** The search parameters of `/ai-search` that carry the context. */
export const CONTEXT_PARAMS = { home: "home", project: "project", compare: "compare" } as const;

/** What the page and the request may carry, once checked. Every field is optional; all are ids. */
export interface ChatContext {
  readonly home?: string;
  readonly project?: string;
  readonly compare?: readonly string[];
}

export type ContextSubject =
  | { readonly kind: "home"; readonly shortId: string }
  | { readonly kind: "project"; readonly slug: string }
  | { readonly kind: "compare"; readonly shortIds: readonly string[] };

const CHAT_PATH = "/ai-search";

/** The address of the chat with this subject as its context. Ids are encoded; nothing else is added. */
export function chatContextHref(subject: ContextSubject): string {
  switch (subject.kind) {
    case "home":
      return `${CHAT_PATH}?${CONTEXT_PARAMS.home}=${encodeURIComponent(subject.shortId)}`;
    case "project":
      return `${CHAT_PATH}?${CONTEXT_PARAMS.project}=${encodeURIComponent(subject.slug)}`;
    case "compare":
      return `${CHAT_PATH}?${CONTEXT_PARAMS.compare}=${subject.shortIds.map(encodeURIComponent).join(",")}`;
  }
}

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): unknown {
  return typeof value === "string" ? value : value?.[0];
}

/** The raw, unchecked context of an address: only strings, nothing validated. It is checked by `resolveContext`. */
export function readContextParams(params: SearchParams): unknown {
  const compare = first(params[CONTEXT_PARAMS.compare]);
  return {
    home: first(params[CONTEXT_PARAMS.home]),
    project: first(params[CONTEXT_PARAMS.project]),
    compare: typeof compare === "string" ? compare.split(",") : undefined,
  };
}

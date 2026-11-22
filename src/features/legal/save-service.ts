import { ActionError } from "@/server/actions/normalise-error";
import { LEGAL_SETTING_KEYS, type EditableLegalKind } from "./constants";
import { legalRowSchema, type LegalInput, type LegalRow, type StoredDocument } from "./schemas";

/**
 * The rules of saving a legal page (ADR-151), apart from the code that reaches the database so they can be tested with
 * a stand-in. The real store is in `store.ts`: it acts as the signed-in admin, so the database's own policies decide
 * what is allowed (only the super admin may write `site_settings`; the audit trigger records which setting changed,
 * never its content). The action has already checked the caller is the super admin and counted the rate limit.
 */

export interface LegalStore {
  /** The stored value of one page's row, or null when there is none yet. */
  read(key: string): Promise<unknown>;
  /** Replaces one page's row (adds it the first time). Throws the database's failure through `mapLegalError`. */
  write(key: string, value: Record<string, unknown>): Promise<void>;
}

/** What was saved: enough for the screen to say what happened. */
export interface LegalDone {
  kind: EditableLegalKind;
  published: boolean;
  version: string | null;
}

export interface LegalFailure {
  code?: string | undefined;
  message?: string | undefined;
}

/** Turns what the database raises into the closed set of action errors. */
export function mapLegalError(failure: LegalFailure): ActionError {
  const { code } = failure;
  if (code === "42501") {
    return new ActionError("FORBIDDEN", "You don't have permission to do that.");
  }
  if (code === "23514" || code === "22P02" || code === "23502") {
    return new ActionError("VALIDATION", "The page is not valid");
  }
  return new ActionError("INTERNAL", "The page could not be saved");
}

/** The day of a moment in India, as `YYYY-MM-DD`: the "Last updated" date a reader sees. */
export function dayInIndia(moment: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(moment);
}

/** The version after the given one: whole numbers counting up from 1. A version that is not a number starts again at 1. */
export function nextVersion(previous: string | null): string {
  const number = previous !== null && /^\d+$/.test(previous) ? Number(previous) : 0;
  return String(number + 1);
}

/** What a row holds now; a row that does not match its shape counts as empty rather than blocking a save. */
export function rowOf(stored: unknown): LegalRow {
  const parsed = legalRowSchema.safeParse(stored);
  return parsed.success ? parsed.data : {};
}

/**
 * Saves a page. A working copy is kept beside the published version, so editing a live page never changes what
 * visitors read until it is published. Publishing sets the day and the next version, makes the text live, and clears
 * the working copy.
 */
export async function saveLegalContent(
  store: LegalStore,
  input: LegalInput,
  moment: Date = new Date(),
): Promise<LegalDone> {
  const key = LEGAL_SETTING_KEYS[input.kind];
  const row = rowOf(await store.read(key));

  if (input.publish) {
    const version = nextVersion(row.published?.version ?? null);
    const published: StoredDocument = {
      draft: false,
      updated: dayInIndia(moment),
      version,
      summary: input.summary,
      sections: input.sections,
    };
    await store.write(key, { published });
    return { kind: input.kind, published: true, version };
  }

  const working: StoredDocument = {
    draft: true,
    updated: null,
    version: null,
    summary: input.summary,
    sections: input.sections,
  };
  await store.write(key, row.published ? { published: row.published, working } : { working });
  return { kind: input.kind, published: false, version: null };
}

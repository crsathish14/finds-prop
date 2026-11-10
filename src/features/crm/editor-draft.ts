import type {
  CrmConnectionBox,
  CrmConnectionValues,
  CrmCredentialMode,
} from "@/components/domain/crm-connection-fields";
import type { CrmIntegrationView } from "./view";

/**
 * What the admin's CRM editor keeps while it is open and how it turns into the save request (S7-T09, FR-ADM-09,
 * BR-64). Pure, so it is tested without a screen. A saved secret is never in the draft: it holds only what the admin
 * has typed and what they chose to do with each secret (keep, replace, clear), and the save leaves a kept secret out
 * of the request so the server keeps what it holds.
 */

export const SECRET_NAMES = ["apiKey", "apiSecret", "accessToken"] as const;
export type SecretName = (typeof SECRET_NAMES)[number];

export type SecretDraft = { mode: CrmCredentialMode; value: string };

/** One row of a list: the first box and the second (header name and value, CRM field and template, project and code). */
export type DraftRow = { id: string; first: string; second: string };

export type ListName = "headers" | "mapping" | "codes";
export const LIST_NAMES = ["headers", "mapping", "codes"] as const;

export type CrmDraft = {
  connection: CrmConnectionValues;
  secrets: Record<SecretName, SecretDraft>;
  headers: DraftRow[];
  mapping: DraftRow[];
  codes: DraftRow[];
};

const KEEP: SecretDraft = { mode: "keep", value: "" };

export function blankDraft(): CrmDraft {
  return {
    connection: {
      name: "",
      leadSource: "",
      baseUrl: "",
      endpoint: "",
      method: "POST",
      leadIdPath: "",
      active: true,
    },
    secrets: { apiKey: KEEP, apiSecret: KEEP, accessToken: KEEP },
    headers: [],
    mapping: [],
    codes: [],
  };
}

const ROW_PREFIX: Record<ListName, string> = { headers: "h", mapping: "m", codes: "c" };

/** The draft of a connection that exists. Its secrets are all "keep": nothing about them is known but whether they are set. */
export function draftOf(view: CrmIntegrationView): CrmDraft {
  return {
    connection: {
      name: view.name,
      leadSource: view.leadSource ?? "",
      baseUrl: view.baseUrl,
      endpoint: view.endpoint ?? "",
      method: view.method,
      leadIdPath: view.leadIdPath ?? "",
      active: view.active,
    },
    secrets: { apiKey: KEEP, apiSecret: KEEP, accessToken: KEEP },
    headers: view.headers.map((row, index) => ({
      id: `h${index}`,
      first: row.name,
      second: row.value,
    })),
    mapping: view.bodyMapping.map((row, index) => ({
      id: `m${index}`,
      first: row.field,
      second: row.value,
    })),
    codes: view.projectCodes.map((row, index) => ({
      id: `c${index}`,
      first: row.projectId,
      second: row.code,
    })),
  };
}

/** An id for a row added to a list that no row of the list has. */
export function nextRowId(list: ListName, rows: readonly DraftRow[]): string {
  const prefix = ROW_PREFIX[list];
  const used = rows.map((row) => Number(row.id.slice(prefix.length))).filter(Number.isFinite);
  return `${prefix}${used.length === 0 ? 0 : Math.max(...used) + 1}`;
}

const isBlankRow = (row: DraftRow) => row.first.trim() === "" && row.second.trim() === "";

/** Which draft row each row of the request came from, by list, so a problem at row 2 of the request lands on its box. */
export type SentRows = Record<ListName, string[]>;

/**
 * The save request. A row with both boxes empty is left out (the admin pressed Add and changed their mind); a row with
 * one box empty is sent, so the server says which box. A blank text is sent as it is and the schema clears it. A
 * secret: kept is left out; replaced is the text typed (a blank one is left out too, which keeps what is saved);
 * cleared is null. A secret with nothing saved is "kept" until something is typed, then it is sent as text.
 */
export function payloadOf(
  draft: CrmDraft,
  stored: Readonly<Record<SecretName, boolean>>,
): { payload: Record<string, unknown>; sent: SentRows } {
  const sent: SentRows = { headers: [], mapping: [], codes: [] };
  const rowsOf = <T>(list: ListName, make: (row: DraftRow) => T): T[] =>
    draft[list]
      .filter((row) => !isBlankRow(row))
      .map((row) => {
        sent[list].push(row.id);
        return make(row);
      });

  const secrets: Record<string, string | null> = {};
  for (const name of SECRET_NAMES) {
    const { mode, value } = draft.secrets[name];
    if (mode === "clear" && stored[name]) secrets[name] = null;
    else if ((mode === "replace" || !stored[name]) && value.trim() !== "") secrets[name] = value;
  }

  const { connection } = draft;
  const payload: Record<string, unknown> = {
    name: connection.name,
    leadSource: connection.leadSource,
    baseUrl: connection.baseUrl,
    endpoint: connection.endpoint,
    method: connection.method,
    leadIdPath: connection.leadIdPath,
    active: connection.active,
    headers: rowsOf("headers", (row) => ({ name: row.first, value: row.second })),
    bodyMapping: rowsOf("mapping", (row) => ({ field: row.first, value: row.second })),
    projectCodes: rowsOf("codes", (row) => ({ projectId: row.first, code: row.second })),
  };
  if (Object.keys(secrets).length > 0) payload["secrets"] = secrets;
  return { payload, sent };
}

export type RowProblems = Record<string, { first?: string; second?: string }>;

export type EditorProblems = {
  connection: Partial<Record<CrmConnectionBox, string>>;
  secrets: Partial<Record<SecretName, string>>;
  headers: RowProblems;
  mapping: RowProblems;
  codes: RowProblems;
  /** Problems that belong to no one box. */
  form: string[];
};

/** A fresh record with no problem in it (the objects are filled in as problems are found, so each use needs its own). */
export const noProblems = (): EditorProblems => ({
  connection: {},
  secrets: {},
  headers: {},
  mapping: {},
  codes: {},
  form: [],
});

/** How many boxes (and notes that belong to none) have a problem. */
export function countProblems(problems: EditorProblems): number {
  const rows = (list: RowProblems) =>
    Object.values(list).reduce((sum, boxes) => sum + Object.keys(boxes).length, 0);
  return (
    Object.keys(problems.connection).length +
    Object.keys(problems.secrets).length +
    rows(problems.headers) +
    rows(problems.mapping) +
    rows(problems.codes) +
    problems.form.length
  );
}

/**
 * A name (or a project) used twice in a list, found before sending: the message goes on the later row's first box, as
 * the server would put it. Blank rows are ignored, and names are compared without case or spaces at the ends.
 */
export function duplicateRowProblems(draft: CrmDraft, message: string): EditorProblems {
  const found = noProblems();
  for (const list of LIST_NAMES) {
    const seen = new Set<string>();
    for (const row of draft[list]) {
      if (isBlankRow(row)) continue;
      const key = row.first.trim().toLowerCase();
      if (key === "") continue;
      if (seen.has(key)) found[list][row.id] = { first: message };
      seen.add(key);
    }
  }
  return found;
}

const CONNECTION_BOXES: readonly string[] = [
  "name",
  "leadSource",
  "baseUrl",
  "endpoint",
  "method",
  "leadIdPath",
  "active",
];

const LIST_OF_PATH: Record<string, ListName> = {
  headers: "headers",
  bodyMapping: "mapping",
  projectCodes: "codes",
};

/** Which box of a row each path ends in. */
const SIDE_OF_BOX: Record<string, "first" | "second"> = {
  name: "first",
  field: "first",
  projectId: "first",
  value: "second",
  code: "second",
};

/**
 * Puts what the server said is wrong on the boxes it belongs to. `byPath` is the first message of each path the
 * server named (`baseUrl`, `headers.1.value`, `secrets.apiKey`); a row's number is its place in the request, which
 * `sent` maps back to the draft row. A path that belongs to no box becomes a note for the whole form.
 */
export function problemsOf(
  byPath: Readonly<Record<string, string>>,
  sent: SentRows,
): EditorProblems {
  const result = noProblems();
  for (const [path, message] of Object.entries(byPath)) {
    const [head, index, box] = path.split(".");
    const parts = path.split(".").length;
    if (head !== undefined && parts === 1 && CONNECTION_BOXES.includes(head)) {
      const name = head as CrmConnectionBox;
      if (result.connection[name] === undefined) result.connection[name] = message;
      continue;
    }
    if (head === "secrets" && index !== undefined && parts === 2) {
      const name = SECRET_NAMES.find((candidate) => candidate === index);
      if (name) {
        if (result.secrets[name] === undefined) result.secrets[name] = message;
        continue;
      }
    }
    const list = head === undefined ? undefined : LIST_OF_PATH[head];
    if (list && index !== undefined && box !== undefined && parts === 3) {
      const id = sent[list][Number(index)];
      const side = SIDE_OF_BOX[box];
      if (id && side) {
        const own = result[list][id] ?? {};
        if (own[side] === undefined) own[side] = message;
        result[list][id] = own;
        continue;
      }
    }
    result.form.push(message);
  }
  return result;
}

/** A copy of a record without one key (a record of problems is partial, so the copy has the same type). */
export function without<T extends object>(record: T, key: string): T {
  return Object.fromEntries(Object.entries(record).filter(([name]) => name !== key)) as T;
}

import { z } from "zod";

/**
 * The page cursor of the admin's two lists, newest first (S7-T07): server side only, it uses Buffer. It is the
 * creation time and id of the last row of a page, joined and made safe for an address.
 */
export function encodeCursor(row: { createdAt: string; id: string }): string {
  return Buffer.from(JSON.stringify([row.createdAt, row.id]), "utf8").toString("base64url");
}

const cursorSchema = z.tuple([z.iso.datetime({ offset: true }), z.uuid()]);

/** Pure: reads a cursor back, or null when it is not one a page could have made (it is then ignored). */
export function decodeCursor(cursor: string | undefined): { at: string; id: string } | null {
  if (!cursor) return null;
  try {
    const parsed = cursorSchema.safeParse(
      JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")),
    );
    return parsed.success ? { at: parsed.data[0], id: parsed.data[1] } : null;
  } catch {
    return null;
  }
}

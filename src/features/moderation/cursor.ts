import { z } from "zod";
import type { QueueItem } from "./view";

/** The page cursor of the admin queue (S6-T04): server side only, it uses Buffer. */

/** The cursor of the last row of a page: its submission time and id, joined and made safe for an address. */
export function encodeCursor(item: Pick<QueueItem, "submittedAt" | "id">): string {
  return Buffer.from(JSON.stringify([item.submittedAt, item.id]), "utf8").toString("base64url");
}

const cursorSchema = z.tuple([z.iso.datetime({ offset: true }), z.uuid()]);

/** Pure: reads a cursor back, or null when it is not one this page could have made (it is then ignored). */
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

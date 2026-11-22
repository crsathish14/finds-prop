import type { Metadata } from "next";
import { NO_INDEX } from "@/features/seo";
import type { Translate } from "@/lib/format";

/**
 * The title of a list page for a visitor who is not signed in: one generic title for every list and every
 * filter, and never indexed, so a search engine learns nothing of what the list holds (login wall, ADR-171).
 */
export function loginWallMetadata(translate: Translate): Metadata {
  return { title: translate("loginWall.metaTitle"), ...NO_INDEX };
}

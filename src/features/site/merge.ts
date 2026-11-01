import type { Logger } from "@/server/logger";
import { SITE_DEFAULTS } from "./defaults";
import { SITE_SETTING_KEYS, SITE_SETTING_SCHEMAS, type SiteSettings } from "./schemas";

export interface SiteSettingRow {
  key: string;
  value: unknown;
}

/**
 * Merges stored rows over the built-in defaults (BR-81), one key at a time. A row is used only if
 * it passes its schema; a row that does not is ignored and logged by key, never by content. Keys
 * the site does not know are ignored. Within a key, fields in the row replace the default field;
 * lists and nested objects are replaced whole, not merged.
 */
export function mergeSiteSettings(rows: SiteSettingRow[], log: Logger): SiteSettings {
  const merged: SiteSettings = structuredClone(SITE_DEFAULTS);
  for (const key of SITE_SETTING_KEYS) {
    const row = rows.find((candidate) => candidate.key === key);
    if (!row) continue;
    const parsed = SITE_SETTING_SCHEMAS[key].partial().safeParse(row.value);
    if (!parsed.success) {
      log.warn("site setting ignored, it does not match its schema", { settingKey: key });
      continue;
    }
    Object.assign(merged[key], parsed.data);
  }
  return merged;
}

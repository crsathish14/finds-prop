import { z } from "zod";
import { CRM_METHODS, type CrmMethod } from "./constants";

/**
 * One connection as the admin's CRM screen draws it (S7-T09, FR-ADM-09, BR-64): the settings, and for each secret only
 * whether it is set. The secrets themselves are never read into the browser's data; the database function that feeds
 * this returns booleans, so there is nothing to leak.
 */
export interface CrmIntegrationView {
  id: string;
  name: string;
  leadSource: string | null;
  baseUrl: string;
  endpoint: string | null;
  method: CrmMethod;
  leadIdPath: string | null;
  active: boolean;
  headers: { name: string; value: string }[];
  bodyMapping: { field: string; value: string }[];
  projectCodes: { projectId: string; code: string }[];
  hasApiKey: boolean;
  hasApiSecret: boolean;
  hasAccessToken: boolean;
  /** How many forms send to this connection. */
  forms: number;
}

const textMap = z.record(z.string(), z.string());

const rowSchema = z.object({
  id: z.string(),
  name: z.string(),
  lead_source: z.string().nullable(),
  base_url: z.string(),
  endpoint: z.string().nullable(),
  method: z.enum(CRM_METHODS),
  lead_id_path: z.string().nullable(),
  active: z.boolean(),
  headers: textMap,
  body_mapping: textMap,
  project_codes: textMap,
  has_api_key: z.boolean(),
  has_api_secret: z.boolean(),
  has_access_token: z.boolean(),
  forms: z.number().int().min(0),
});

/**
 * The rows from `admin_crm_integrations()`. A row that is not in the expected shape is left out and counted, so one
 * bad row does not take the page down, and the caller can log it.
 */
export function toCrmIntegrationViews(rows: readonly unknown[] | null): {
  integrations: CrmIntegrationView[];
  skipped: number;
} {
  const integrations: CrmIntegrationView[] = [];
  let skipped = 0;
  for (const raw of rows ?? []) {
    const parsed = rowSchema.safeParse(raw);
    if (!parsed.success) {
      skipped += 1;
      continue;
    }
    const row = parsed.data;
    integrations.push({
      id: row.id,
      name: row.name,
      leadSource: row.lead_source,
      baseUrl: row.base_url,
      endpoint: row.endpoint,
      method: row.method,
      leadIdPath: row.lead_id_path,
      active: row.active,
      headers: Object.entries(row.headers).map(([name, value]) => ({ name, value })),
      bodyMapping: Object.entries(row.body_mapping).map(([field, value]) => ({ field, value })),
      projectCodes: Object.entries(row.project_codes).map(([projectId, code]) => ({
        projectId,
        code,
      })),
      hasApiKey: row.has_api_key,
      hasApiSecret: row.has_api_secret,
      hasAccessToken: row.has_access_token,
      forms: row.forms,
    });
  }
  return { integrations, skipped };
}

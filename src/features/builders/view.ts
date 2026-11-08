import { z } from "zod";
import { BUILDER_KINDS, type BuilderKind } from "./constants";

/**
 * One line of the admin's Builders table (S7-T05, FR-ADM-04), ready to draw. The status is worked out from
 * what the database says: a builder who was deactivated is Inactive; one who has never signed in is Invited (they
 * have been given the sign-in address and have not used it); anyone else is Active.
 */
export type BuilderStatus = "active" | "invited" | "inactive";

export interface BuilderRowView {
  id: string;
  name: string;
  email: string;
  kind: BuilderKind;
  status: BuilderStatus;
  contactPerson: string | null;
  phone: string | null;
  logoUrl: string | null;
  website: string | null;
  description: string | null;
  projects: number;
  leads: number;
  invitedAt: string | null;
  lastSignInAt: string | null;
}

const overviewRowSchema = z.object({
  active: z.boolean(),
  contact_person: z.string().nullable(),
  description: z.string().nullable(),
  email: z.string(),
  id: z.string(),
  invited_at: z.string().nullable(),
  kind: z.string(),
  last_sign_in_at: z.string().nullable(),
  leads: z.number(),
  logo_url: z.string().nullable(),
  name: z.string(),
  phone: z.string().nullable(),
  projects: z.number(),
  website: z.string().nullable(),
});

export function statusOf(row: { active: boolean; last_sign_in_at: string | null }): BuilderStatus {
  if (!row.active) return "inactive";
  return row.last_sign_in_at === null ? "invited" : "active";
}

/** Pure: the rows `admin_builder_overview()` gave, in the order they came; a row that is not shaped as one is left out. */
export function toBuilderRows(rows: readonly unknown[]): BuilderRowView[] {
  return rows.flatMap((row) => {
    const parsed = overviewRowSchema.safeParse(row);
    if (!parsed.success) return [];
    const found = parsed.data;
    const kind = (BUILDER_KINDS as readonly string[]).includes(found.kind)
      ? (found.kind as BuilderKind)
      : "builder";
    return [
      {
        id: found.id,
        name: found.name,
        email: found.email,
        kind,
        status: statusOf(found),
        contactPerson: found.contact_person,
        phone: found.phone,
        logoUrl: found.logo_url,
        website: found.website,
        description: found.description,
        projects: found.projects,
        leads: found.leads,
        invitedAt: found.invited_at,
        lastSignInAt: found.last_sign_in_at,
      },
    ];
  });
}

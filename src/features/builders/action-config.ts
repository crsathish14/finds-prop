import { tagsAfterBuilderChange } from "@/lib/cache-tags";
import {
  inviteBuilderSchema,
  resendInvitationSchema,
  setBuilderActiveSchema,
  updateBuilderSchema,
  updateMyProfileSchema,
} from "./schemas";

/**
 * How the admin's builder actions run, kept apart from the "use server" file so a test can build them (S7-T05).
 * Only a super admin may call them, and each is limited with the admin's other decisions (`admin_decision`, 120
 * an hour: a busy day of inviting is well inside it, a stuck script is not). No idempotency key: inviting the same
 * email twice finds the record already there and is refused, and the other three set a value, so a repeat
 * changes nothing more. Deactivating or activating a builder and saving their details change what the public
 * pages show (the developer showcase and the builder's name and logo on project pages), so their tags are
 * refreshed; an invitation or a resend does not touch public data. The changes are recorded in the audit log by
 * the database triggers, with the admin as the actor, so there is no `audit` entry here.
 */
export const inviteBuilderConfig = {
  name: "inviteBuilder",
  input: inviteBuilderSchema,
  auth: { role: "super_admin" as const },
  rateLimit: { scope: "admin_decision" as const },
};

export const resendInvitationConfig = {
  name: "resendInvitation",
  input: resendInvitationSchema,
  auth: { role: "super_admin" as const },
  rateLimit: { scope: "admin_decision" as const },
};

export const setBuilderActiveConfig = {
  name: "setBuilderActive",
  input: setBuilderActiveSchema,
  auth: { role: "super_admin" as const },
  rateLimit: { scope: "admin_decision" as const },
  invalidate: () => tagsAfterBuilderChange(),
};

export const updateBuilderConfig = {
  name: "updateBuilder",
  input: updateBuilderSchema,
  auth: { role: "super_admin" as const },
  rateLimit: { scope: "admin_decision" as const },
  invalidate: () => tagsAfterBuilderChange(),
};

/**
 * The builder's own profile (S7-T03, FR-BLD-05): their company's name, contact person, phone, logo, website and
 * introduction. It runs as the signed-in builder (an agent too), not the service role: the database lets a builder
 * change those columns of their own record only. Limited with the builder's other edits (`builder_edit`); refreshes
 * what the public pages show of a builder (the developer showcase and the name and logo on project pages). A profile
 * change needs no approval, and has no audit entry: the database records only activation and type changes of a
 * builder, and the company's own description of itself is not a decision.
 */
export const updateMyProfileConfig = {
  name: "updateMyProfile",
  input: updateMyProfileSchema,
  auth: { role: "builder" as const },
  rateLimit: { scope: "builder_edit" as const },
  invalidate: () => tagsAfterBuilderChange(),
};

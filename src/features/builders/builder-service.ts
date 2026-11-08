import { ActionError } from "@/server/actions/normalise-error";
import type { BuilderKind } from "./constants";
import type { InviteBuilderInput, UpdateBuilderInput } from "./schemas";

/**
 * The rules of the admin's builder management (S7-T05, FR-ADM-04), apart from the code that reaches the database
 * and the auth service so they can be tested with a stand-in. The real store is in `service.ts` (on the
 * service-role allow-list). Builders and agents sign in with Google only (ADR-010), so an invitation is an account
 * that already exists with a confirmed email, the builder role and the builder record; when the person later
 * signs in with Google on that address, Supabase links it to this account. Nothing is emailed in v1 (DEC-27): the
 * admin passes the sign-in address on. The database keeps the rules that must not be walked around (the reserved
 * admin addresses are refused, one record per email, only the admin or the system changes the account columns).
 */

/** The columns of a builder record the admin writes. */
export interface BuilderRow {
  name: string;
  kind: BuilderKind;
  contact_person: string | null;
  phone: string | null;
  logo_url: string | null;
  website: string | null;
  description: string | null;
}

/** What the store knows of one builder, enough to decide what may be done to it. */
export interface BuilderState {
  id: string;
  active: boolean;
  /** True once the person has signed in at all (Google, through the account made for them). */
  signedIn: boolean;
}

/** Calls made with the service role, after the caller was checked to be the super admin. */
export interface BuilderStore {
  /** Adds the record, with no account yet. Throws the database's failure through `mapBuilderError`. */
  insertBuilder(row: BuilderRow & { email: string }): Promise<string>;
  /** Makes the account with a confirmed email; the id of the new account. Throws through `mapBuilderError`. */
  createAccount(email: string): Promise<string>;
  /** Ties the record to the account and grants the builder role. */
  linkAccount(builderId: string, userId: string): Promise<void>;
  /** Undoes a half-made invitation: the record, then the account if one was made. Never throws. */
  discard(builderId: string, userId: string | null): Promise<void>;
  readBuilder(builderId: string): Promise<BuilderState | null>;
  /** Stamps the invitation as sent again. */
  stampInvitation(builderId: string): Promise<void>;
  setActive(builderId: string, active: boolean): Promise<boolean>;
  updateDetails(builderId: string, row: BuilderRow): Promise<boolean>;
}

/** What the database or the auth service says when a call fails. */
export interface BuilderFailure {
  code?: string | undefined;
  message?: string | undefined;
}

/**
 * Turns what the database and the auth service raise into the closed set of action errors. The reserved admin
 * addresses and an email that already has a record or an account are problems with the email box; anything else
 * is ours.
 */
export function mapBuilderError(failure: BuilderFailure): ActionError {
  const { code, message } = failure;
  if (message === "builders.reserved_email") {
    return new ActionError("VALIDATION", "That email cannot be used for a builder account", {
      fieldErrors: { email: [{ key: "validation.builderEmailReserved" }] },
    });
  }
  if (code === "23505" || code === "email_exists" || code === "user_already_exists") {
    return new ActionError("VALIDATION", "That email already has an account or a record", {
      fieldErrors: { email: [{ key: "validation.emailTaken" }] },
    });
  }
  if (message === "builders.admin_only_columns" || code === "42501") {
    return new ActionError("FORBIDDEN", "You don't have permission to do that.");
  }
  return new ActionError("INTERNAL", "The builder could not be saved");
}

/** The record's columns from what the form gave. A box left empty is no value. */
export function toBuilderRow(
  input: Pick<
    InviteBuilderInput,
    "name" | "kind" | "contactPerson" | "phone" | "logoUrl" | "website" | "description"
  >,
): BuilderRow {
  return {
    name: input.name,
    kind: input.kind,
    contact_person: input.contactPerson ?? null,
    phone: input.phone ?? null,
    logo_url: input.logoUrl ?? null,
    website: input.website ?? null,
    description: input.description ?? null,
  };
}

/**
 * Invites a builder or an agent. The record goes in first, because the database refuses the reserved addresses
 * and a second record for an email there, which is cheaper to find out than an account; then the account with a
 * confirmed email (so Google links to it by that address); then the link and the role. If any later step fails,
 * what was made is taken away again, so a failed invitation leaves nothing behind and can be tried again.
 */
export async function inviteBuilder(
  store: BuilderStore,
  input: InviteBuilderInput,
): Promise<{ builderId: string }> {
  const builderId = await store.insertBuilder({ ...toBuilderRow(input), email: input.email });
  let userId: string | null = null;
  try {
    userId = await store.createAccount(input.email);
    await store.linkAccount(builderId, userId);
  } catch (error) {
    await store.discard(builderId, userId);
    throw error;
  }
  return { builderId };
}

/**
 * "Resend invitation": nothing is emailed in v1, so this stamps the invitation as sent again and lets the screen show
 * the sign-in address once more. Only a builder who has not signed in yet and is active can be re-invited.
 */
export async function resendInvitation(
  store: BuilderStore,
  parameters: { builderId: string },
): Promise<{ builderId: string }> {
  const found = await store.readBuilder(parameters.builderId);
  if (!found) throw new ActionError("NOT_FOUND", "The builder was not found");
  if (!found.active || found.signedIn) {
    throw new ActionError("CONFLICT", "The builder is not waiting for an invitation");
  }
  await store.stampInvitation(parameters.builderId);
  return { builderId: parameters.builderId };
}

/** Activates or deactivates a builder. Builders are never deleted (DEC-28); a deactivated one loses the portal. */
export async function setBuilderActive(
  store: BuilderStore,
  parameters: { builderId: string; active: boolean },
): Promise<{ builderId: string; active: boolean }> {
  const changed = await store.setActive(parameters.builderId, parameters.active);
  if (!changed) throw new ActionError("NOT_FOUND", "The builder was not found");
  return { builderId: parameters.builderId, active: parameters.active };
}

/** Saves the details of a builder (not the email). */
export async function updateBuilderDetails(
  store: BuilderStore,
  input: UpdateBuilderInput,
): Promise<{ builderId: string }> {
  const changed = await store.updateDetails(input.builderId, toBuilderRow(input));
  if (!changed) throw new ActionError("NOT_FOUND", "The builder was not found");
  return { builderId: input.builderId };
}

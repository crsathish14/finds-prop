import "server-only";
import { cache } from "react";
import { ActionError } from "../actions/normalise-error";
import { createServerSupabase } from "../supabase/server";
import { buildSessionView, type SessionView } from "./session";

/**
 * The signed-in user for this request, or null. Computed once per request (React cache).
 *
 * The token is verified with getClaims(), never trusted from getSession() (AGENTS.md). Roles and
 * the builder record are read as the user, so the database's own row rules apply. Roles are read
 * for this user only: an admin can read every row in user_roles, so the filter is not optional.
 */
export const getSessionView = cache(async (): Promise<SessionView | null> => {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims || typeof claims.sub !== "string") return null;

  const [roleRows, builder] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", claims.sub),
    supabase.rpc("current_builder_id"),
  ]);
  if (roleRows.error || builder.error) {
    throw new ActionError("INTERNAL", "Could not read the signed-in user's roles");
  }
  return buildSessionView({
    claims,
    roles: roleRows.data.map((row) => row.role),
    builderId: builder.data,
  });
});

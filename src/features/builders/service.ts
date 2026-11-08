import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminSupabase } from "@/server/supabase/admin.server";
import type { Database } from "@/types/database.types";
import { mapBuilderError, type BuilderStore } from "./builder-service";

/**
 * The part of the admin's builder management that touches the database and the auth service (S7-T05). It is on
 * the service-role allow-list (docs/engineering/security.md 4.3, eslint.config.mjs): making an account with a
 * confirmed email and granting a role are things only the service role can do, and the admin's own account
 * has no column grant on `active`, `kind` or `email` (a builder's account columns are written by the system
 * only). The only callers are actions built with `defineAction`, which have already checked the caller is the super
 * admin and counted the rate limit.
 */
export function createBuilderStore(requestId?: string): BuilderStore {
  return builderStore(createAdminSupabase(requestId));
}

/** The same store for any client with the service role (the integration tests pass theirs). */
export function builderStore(client: SupabaseClient<Database>): BuilderStore {
  return {
    async insertBuilder(row) {
      const { data, error } = await client
        .from("builders")
        .insert({ ...row, invited_at: new Date().toISOString() })
        .select("id")
        .single();
      if (error || !data) throw mapBuilderError(error ?? {});
      return data.id;
    },

    async createAccount(email) {
      const { data, error } = await client.auth.admin.createUser({ email, email_confirm: true });
      if (error || !data.user) {
        throw mapBuilderError({ code: error?.code, message: error?.message });
      }
      return data.user.id;
    },

    async linkAccount(builderId, userId) {
      const linked = await client.from("builders").update({ user_id: userId }).eq("id", builderId);
      if (linked.error) throw mapBuilderError(linked.error);
      const granted = await client.from("user_roles").insert({ user_id: userId, role: "builder" });
      // A second grant of the same role is not a problem.
      if (granted.error && granted.error.code !== "23505") throw mapBuilderError(granted.error);
    },

    async discard(builderId, userId) {
      try {
        await client.from("builders").delete().eq("id", builderId);
        if (userId) await client.auth.admin.deleteUser(userId);
      } catch {
        // Cleaning up must not hide the failure that made it necessary.
      }
    },

    async readBuilder(builderId) {
      const { data, error } = await client
        .from("builders")
        .select("id, active, user_id")
        .eq("id", builderId)
        .maybeSingle();
      if (error) throw mapBuilderError(error);
      if (!data) return null;
      if (!data.user_id) return { id: data.id, active: data.active, signedIn: false };
      const account = await client.auth.admin.getUserById(data.user_id);
      if (account.error) throw mapBuilderError({ code: account.error.code });
      return {
        id: data.id,
        active: data.active,
        signedIn: Boolean(account.data.user?.last_sign_in_at),
      };
    },

    async stampInvitation(builderId) {
      const { error } = await client
        .from("builders")
        .update({ invited_at: new Date().toISOString() })
        .eq("id", builderId);
      if (error) throw mapBuilderError(error);
    },

    async setActive(builderId, active) {
      const { data, error } = await client
        .from("builders")
        .update({ active })
        .eq("id", builderId)
        .select("id");
      if (error) throw mapBuilderError(error);
      return data.length > 0;
    },

    async updateDetails(builderId, row) {
      const { data, error } = await client
        .from("builders")
        .update(row)
        .eq("id", builderId)
        .select("id");
      if (error) throw mapBuilderError(error);
      return data.length > 0;
    },
  };
}

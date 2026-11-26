import "server-only";
import { createServerSupabase } from "@/server/supabase/server";
import type { AgentContactStore } from "./contact-service";

/** Reads the phone as the signed-in caller, so the database function sees their own session (R-BE-07: no service role). */
export function createAgentContactStore(): AgentContactStore {
  return {
    async readPhone(agentId) {
      const client = await createServerSupabase();
      const { data, error } = await client.rpc("agent_contact", { p_id: agentId });
      if (error) return { phone: null, errorCode: error.code };
      return { phone: typeof data === "string" && data.length > 0 ? data : null };
    },
  };
}

import "server-only";
import { createServerSupabase } from "@/server/supabase/server";
import { ActionError } from "@/server/actions/normalise-error";
import { loadResearchPanel, myBuilderId, type ResearchPanelView } from "./panel-service";

/**
 * The "Pages for the AI assistant" panel, read as the signed-in person (AI search Phase 4): the builder's own on the
 * profile page, any builder's for the super admin. Null when there is nothing to show (no such builder, or not theirs).
 */
export async function getMyResearchPanel(): Promise<ResearchPanelView | null> {
  const client = await createServerSupabase();
  let builderId: string;
  try {
    builderId = await myBuilderId(client);
  } catch (error) {
    if (error instanceof ActionError && error.code === "NOT_FOUND") return null;
    throw error;
  }
  return loadResearchPanel(client, builderId);
}

export async function getBuilderResearchPanel(
  builderId: string,
): Promise<ResearchPanelView | null> {
  return loadResearchPanel(await createServerSupabase(), builderId);
}

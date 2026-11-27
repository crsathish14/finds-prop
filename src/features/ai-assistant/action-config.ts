import { aiAssistantInputSchema } from "./schemas";

/**
 * How the admin AI assistant page's save runs (ADR-218, piece 7), kept apart from the "use server" file so a test can
 * build it. Only a super admin may call it, limited with the admin's other edits (`admin_edit`). It sets two values, so
 * a repeat changes nothing more and needs no idempotency key; nothing public is cached from it. The table has no audit
 * trigger, so the save adds its own entry (`ai_assistant.settings_changed`, with the admin as the actor).
 */
export const saveAiAssistantConfig = {
  name: "saveAiAssistant",
  input: aiAssistantInputSchema,
  auth: { role: "super_admin" as const },
  rateLimit: { scope: "admin_edit" as const },
  audit: {
    action: "ai_assistant.settings_changed",
    entity: () => ({ type: "ai_assistant_settings", id: "1" }),
  },
};

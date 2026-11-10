import { connection } from "next/server";
import { handleCrmRetry } from "@/features/crm";

/**
 * Called once a minute by the database's scheduled job (`arm_crm_retry`) while a CRM delivery waits, to send the
 * submissions that are due (S7-T09, BR-66). It answers only to the job's token; see `features/crm/retry-handler.ts`.
 */
export async function POST(request: Request) {
  await connection();
  return handleCrmRetry(request);
}

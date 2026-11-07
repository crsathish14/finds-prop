import { connection } from "next/server";
import { handleSweepMedia } from "@/features/media";

/**
 * Called once an hour by the database's scheduled job (`arm_media_sweep`) to remove photo files nobody
 * claimed (S6-T01). It answers only to the job's token; see `features/media/sweep.ts`.
 */
export async function POST(request: Request) {
  await connection();
  return handleSweepMedia(request);
}

import { connection } from "next/server";
import { env } from "@/server/env";

/**
 * Liveness probe for uptime monitors and deploy smoke tests. Returns no secrets and no data from
 * the database. A database and scheduled-job check is added in Stage 3 (plan 09 section 6.3).
 * `connection()` keeps the response dynamic so it is evaluated on every request, not at build time.
 * On Vercel it also names the deployed commit, so the release workflow (ADR-201) can tell when the
 * new version is live. The commit is already public in the repository; it is not a secret.
 */
export async function GET() {
  await connection();
  return Response.json(
    {
      status: "ok",
      app: "findsprop",
      ...(env.VERCEL_GIT_COMMIT_SHA ? { commit: env.VERCEL_GIT_COMMIT_SHA } : {}),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

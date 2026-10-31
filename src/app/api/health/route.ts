import { connection } from "next/server";

/**
 * Liveness probe for uptime monitors and deploy smoke tests. Returns no secrets and no data from
 * the database. A database and scheduled-job check is added in Stage 3 (plan 09 section 6.3).
 * `connection()` keeps the response dynamic so it is evaluated on every request, not at build time.
 */
export async function GET() {
  await connection();
  return Response.json(
    { status: "ok", app: "findsprop" },
    { headers: { "Cache-Control": "no-store" } },
  );
}

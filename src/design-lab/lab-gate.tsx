import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { designLabEnabled } from "@/server/env";

/**
 * Serves the Design Lab only when DESIGN_LAB=1 and this is not a production deployment (ADR-020);
 * otherwise the route does not exist. `connection()` makes the check run per request, so a build
 * made without the flag does not bake the 404 into the page.
 */
export async function LabGate({ children }: { children: ReactNode }) {
  await connection();
  if (!designLabEnabled) notFound();
  return children;
}

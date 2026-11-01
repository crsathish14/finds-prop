import { headers } from "next/headers";
import type { ReactNode } from "react";
import { readReturnPath } from "@/server/auth/return-path";
import { guardPage } from "@/server/auth/page-guards";
import type { PageArea } from "@/server/auth/page-access";

/**
 * Guards a whole route group from its layout (S3-T11): a visitor who may not see the area is
 * redirected, and nothing below is rendered. It is a convenience for the visitor, not the guard of
 * record: pages still ask for their data through the database rules (plan 07 section 2.6).
 * Wrap it in <Suspense>, because it reads the visitor's cookies.
 */
export async function PageGate({ area, children }: { area: PageArea; children: ReactNode }) {
  await guardPage(area, readReturnPath(await headers()));
  return children;
}

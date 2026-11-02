import { redirect } from "next/navigation";
import { getSessionView } from "@/server/auth/get-session-view";
import { decidePageAccess, type PageArea } from "@/server/auth/page-access";

/**
 * For the sign-in pages: a visitor who already has access to the area is sent on instead of seeing
 * the sign-in page again. Anyone else stays, including a signed-in visitor without access, who may
 * want to switch accounts. Wrap it in <Suspense>, because it reads the visitor's cookies.
 */
export async function SignedInRedirect({
  area,
  destination,
}: {
  area: PageArea;
  destination: string;
}) {
  if (decidePageAccess(area, await getSessionView()).allowed) redirect(destination);
  return null;
}

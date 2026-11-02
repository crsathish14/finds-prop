import { parseStaffProblem, type QueryValues, type StaffArea } from "@/server/auth/staff-sign-in";
import { StaffSignInScreen } from "./staff-sign-in-screen";

/**
 * Reads the page's query string (?denied=1, ?cancelled=1, ?error=1, set by the callback and the page
 * guards) and shows the matching state. It reads search parameters, so the page wraps it in <Suspense>.
 */
export async function StaffSignInFromQuery({
  area,
  searchParams,
}: {
  area: StaffArea;
  searchParams: Promise<QueryValues>;
}) {
  return <StaffSignInScreen area={area} problem={parseStaffProblem(await searchParams)} />;
}

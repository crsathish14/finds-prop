import { redirect } from "next/navigation";
import type { EmailResult } from "@/lib/url/email-result";
import { getSessionEmail } from "@/server/auth/session-email";
import { EmailResultScreen } from "./email-result.client";

/**
 * Shows the answer to an email link. "Verified" needs the visitor's own session to name the address;
 * without one (a stale link opened in another browser) the page is just the sign-in page. "Expired"
 * is shown to anyone, signed in or not. Reads the visitor's cookies, so the page wraps it in <Suspense>.
 */
export async function EmailResultFromQuery({ result }: { result: EmailResult }) {
  const { signedIn, email } = await getSessionEmail();
  if (result === "verified" && !email) redirect("/auth");
  return (
    <main id="main" className="mx-auto w-full max-w-mid flex-1 px-gutter py-10 md:py-14">
      <EmailResultScreen result={result} email={email} signedIn={signedIn} />
    </main>
  );
}

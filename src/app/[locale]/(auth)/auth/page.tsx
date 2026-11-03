import { Suspense } from "react";
import { EmailResultFromQuery, PhoneSignInFromQuery } from "@/features/auth";
import { parseEmailResult } from "@/lib/url/email-result";

// The customer sign-in page. `?email=verified` or `?email=expired` is the answer to an email link
// (ADD-03): it is shown even to a signed-in visitor. A visitor who arrives already signed in goes
// where they were headed (?redirect=), or to their dashboard (BR-06): the sign-in screen does that
// itself, not a redirect made here on the server, because signing in on this page re-renders it
// with the visitor signed in, in the middle of the name and email steps.
export default function AuthPage({ searchParams }: PageProps<"/[locale]/auth">) {
  return (
    <Suspense fallback={null}>
      <AuthContent searchParams={searchParams} />
    </Suspense>
  );
}

async function AuthContent({ searchParams }: Pick<PageProps<"/[locale]/auth">, "searchParams">) {
  const query = await searchParams;
  const emailResult = parseEmailResult(query.email);
  if (emailResult) return <EmailResultFromQuery result={emailResult} />;
  return <PhoneSignInFromQuery searchParams={searchParams} />;
}

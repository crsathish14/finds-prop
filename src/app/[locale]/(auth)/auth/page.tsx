import { Suspense } from "react";
import { SignedInRedirect } from "@/app/[locale]/_components/signed-in-redirect";
import { EmailResultFromQuery, PhoneSignInFromQuery } from "@/features/auth";
import { parseEmailResult } from "@/lib/url/email-result";
import { safeRedirectPath } from "@/lib/url/safe-redirect";

// The customer sign-in page. `?email=verified` or `?email=expired` is the answer to an email link
// (ADD-03): it is shown even to a signed-in visitor. Anyone else who is signed in goes where they
// were headed (?redirect=), or to their dashboard (BR-06).
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
  return (
    <>
      <Suspense fallback={null}>
        <CustomerRedirect searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={null}>
        <PhoneSignInFromQuery searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function CustomerRedirect({
  searchParams,
}: Pick<PageProps<"/[locale]/auth">, "searchParams">) {
  const { redirect } = await searchParams;
  return (
    <SignedInRedirect
      area="customer"
      destination={safeRedirectPath(Array.isArray(redirect) ? redirect[0] : redirect, "/dashboard")}
    />
  );
}

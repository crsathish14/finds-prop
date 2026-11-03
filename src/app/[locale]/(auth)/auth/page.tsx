import { Suspense } from "react";
import { SignedInRedirect } from "@/app/[locale]/_components/signed-in-redirect";
import { PhoneSignInFromQuery } from "@/features/auth";
import { safeRedirectPath } from "@/lib/url/safe-redirect";

// A signed-in visitor goes where they were headed (?redirect=), or to their dashboard (BR-06).
export default function AuthPage({ searchParams }: PageProps<"/[locale]/auth">) {
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

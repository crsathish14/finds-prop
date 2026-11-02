import { Suspense } from "react";
import { SignedInRedirect } from "@/app/[locale]/_components/signed-in-redirect";
import { StaffSignInFromQuery } from "@/features/staff-auth";

export default function BuilderLoginPage({ searchParams }: PageProps<"/[locale]/builder/login">) {
  return (
    <>
      <Suspense fallback={null}>
        <SignedInRedirect area="builder" destination="/builder/dashboard" />
      </Suspense>
      <Suspense fallback={null}>
        <StaffSignInFromQuery area="builder" searchParams={searchParams} />
      </Suspense>
    </>
  );
}

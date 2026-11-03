import { Suspense } from "react";
import { SignedInRedirect } from "@/app/[locale]/_components/signed-in-redirect";
import { StaffSignInFromQuery } from "@/features/staff-auth";

export default function AdminLoginPage({ searchParams }: PageProps<"/[locale]/admin/login">) {
  return (
    <>
      <Suspense fallback={null}>
        <SignedInRedirect area="admin" destination="/admin/dashboard" />
      </Suspense>
      <Suspense fallback={null}>
        <StaffSignInFromQuery area="admin" searchParams={searchParams} />
      </Suspense>
    </>
  );
}

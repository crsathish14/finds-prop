import { Suspense } from "react";
import { RoutePlaceholder } from "@/app/[locale]/_components/route-placeholder";
import { SignedInRedirect } from "@/app/[locale]/_components/signed-in-redirect";

export default function AdminLoginPage() {
  return (
    <>
      <Suspense fallback={null}>
        <SignedInRedirect area="admin" destination="/admin/dashboard" />
      </Suspense>
      <RoutePlaceholder route="/admin/login" />
    </>
  );
}

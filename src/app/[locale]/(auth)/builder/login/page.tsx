import { Suspense } from "react";
import { RoutePlaceholder } from "@/app/[locale]/_components/route-placeholder";
import { SignedInRedirect } from "@/app/[locale]/_components/signed-in-redirect";

export default function BuilderLoginPage() {
  return (
    <>
      <Suspense fallback={null}>
        <SignedInRedirect area="builder" destination="/builder/dashboard" />
      </Suspense>
      <RoutePlaceholder route="/builder/login" />
    </>
  );
}

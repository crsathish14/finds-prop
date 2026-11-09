import { Suspense, type ReactNode } from "react";
import { PageGate } from "@/app/[locale]/_components/page-gate";
import { BuilderFrame } from "@/features/builder-portal";

/**
 * Every builder page: the role gate first (a visitor or a non-builder never sees anything below it), then the portal
 * frame with the sidebar and the account menu (S7-T03). Both read the visitor's cookies, hence the Suspense.
 */
export default function BuilderLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <PageGate area="builder">
        <BuilderFrame>{children}</BuilderFrame>
      </PageGate>
    </Suspense>
  );
}

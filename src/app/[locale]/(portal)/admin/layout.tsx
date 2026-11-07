import { Suspense, type ReactNode } from "react";
import { PageGate } from "@/app/[locale]/_components/page-gate";
import { AdminFrame } from "@/features/admin";

/**
 * Every admin page: the role gate first (a visitor or a non-admin never sees anything below it), then the portal
 * frame with the sidebar and the account menu (S6-T04). Both read the visitor's cookies, hence the Suspense.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <PageGate area="admin">
        <AdminFrame>{children}</AdminFrame>
      </PageGate>
    </Suspense>
  );
}

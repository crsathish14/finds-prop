import { Suspense, type ReactNode } from "react";
import { PageGate } from "@/app/[locale]/_components/page-gate";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <PageGate area="admin">{children}</PageGate>
    </Suspense>
  );
}

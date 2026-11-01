import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { PageGate } from "@/app/[locale]/_components/page-gate";

// Signed-in customer pages: personal, so never indexed.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <PageGate area="customer">{children}</PageGate>
    </Suspense>
  );
}

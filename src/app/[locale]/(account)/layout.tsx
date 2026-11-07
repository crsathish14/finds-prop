import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { PageGate } from "@/app/[locale]/_components/page-gate";
import { PublicBottomBar, PublicFooter, PublicHeader } from "@/features/site";

// Signed-in customer pages: personal, so never indexed.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PublicHeader />
      {/* Keeps the footer below the fold while the page streams in, so it cannot jump (layout shift). */}
      <div className="flex min-h-dvh flex-col">
        <Suspense fallback={null}>
          <PageGate area="customer">{children}</PageGate>
        </Suspense>
      </div>
      <PublicFooter />
      <PublicBottomBar />
    </>
  );
}

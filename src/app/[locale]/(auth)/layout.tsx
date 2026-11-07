import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PublicFooter, PublicHeader } from "@/features/site";

// Sign-in pages are not for search engines. Nothing here is guarded: these are the pages a
// signed-out visitor is sent to, so guarding them would redirect to themselves. The bottom bar is
// not shown on them (navigation doc, section 6).
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PublicHeader />
      {/* Keeps the footer below the fold while the page streams in, so it cannot jump (layout shift). */}
      <div className="flex min-h-dvh flex-col">{children}</div>
      <PublicFooter />
    </>
  );
}

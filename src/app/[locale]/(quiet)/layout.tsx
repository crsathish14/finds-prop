import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PublicHeader } from "@/features/site";

// The administrator sign-in page is quiet (ADD-06): the header but no footer, never indexed, and
// not guarded, for the same reason as the other sign-in pages.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function QuietLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PublicHeader />
      {children}
    </>
  );
}

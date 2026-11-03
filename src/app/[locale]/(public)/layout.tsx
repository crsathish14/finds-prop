import type { ReactNode } from "react";
import { PublicBottomBar, PublicFooter, PublicHeader } from "@/features/site";

// The public pages share the site header, footer and (on phones, where the navigation doc lists it)
// the bottom bar.
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PublicHeader />
      {children}
      <PublicFooter />
      <PublicBottomBar />
    </>
  );
}

import type { ReactNode } from "react";
import { CompareBar } from "@/features/compare";
import { PublicBottomBar, PublicFooter, PublicHeader } from "@/features/site";

// The public pages share the site header, footer and (on phones, where the navigation doc lists it)
// the bottom bar. The compare bar appears on the pages where homes can be chosen, once one is.
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PublicHeader />
      {children}
      <PublicFooter />
      <PublicBottomBar />
      <CompareBar />
    </>
  );
}

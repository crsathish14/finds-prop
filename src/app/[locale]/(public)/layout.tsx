import type { ReactNode } from "react";
import { PublicHeader } from "@/features/site";

// The public pages share the site header. The footer and bottom bar are added in their own change.
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PublicHeader />
      {children}
    </>
  );
}

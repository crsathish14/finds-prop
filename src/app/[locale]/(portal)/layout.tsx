import type { Metadata } from "next";
import type { ReactNode } from "react";

// The admin and builder portals are never indexed. Each portal guards itself in its own layout.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function PortalLayout({ children }: { children: ReactNode }) {
  return children;
}

import type { Metadata } from "next";
import type { ReactNode } from "react";

// Sign-in pages are not for search engines. Nothing here is guarded: these are the pages a
// signed-out visitor is sent to, so guarding them would redirect to themselves.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AuthLayout({ children }: { children: ReactNode }) {
  return children;
}

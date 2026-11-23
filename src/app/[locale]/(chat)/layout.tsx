import type { ReactNode } from "react";
import { CompareBar } from "@/features/compare";
import { PublicBottomBar, PublicHeader } from "@/features/site";

// The AI search page has the site header, the bottom bar on phones and the compare bar, but no footer (owner, 24 Nov
// 2026, ADR-185): the conversation and its message box are the page, and a footer under them gets in the way.
export default function ChatLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PublicHeader />
      <div className="flex min-h-dvh flex-col">{children}</div>
      <PublicBottomBar />
      <CompareBar />
    </>
  );
}

import type { ReactNode } from "react";
import { CompareBar } from "@/features/compare";
import { PublicBottomBar, PublicHeader } from "@/features/site";

// The AI search page has the site header, the bottom bar on phones and the compare bar, but no footer (owner, 24 Nov
// 2026, ADR-185): the conversation and its message box are the page, and a footer under them gets in the way. Below lg
// the chat is a pager exactly one screen tall (ADR-220), so the page is not forced to be taller than its content there.
export default function ChatLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PublicHeader />
      <div className="flex flex-col lg:min-h-dvh">{children}</div>
      <PublicBottomBar />
      <CompareBar />
    </>
  );
}

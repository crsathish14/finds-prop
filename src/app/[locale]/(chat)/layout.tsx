import type { ReactNode } from "react";
import { CompareBar } from "@/features/compare";
import { PublicHeader } from "@/features/site";

// The AI search page has the site header and the compare bar, but no footer (owner, 24 Nov 2026, ADR-185) and no bottom
// bar on phones (owner, 28 Nov 2026): the conversation and its message box are the page, and bars around them get in
// the way. Below lg the chat is a pager exactly one screen under the header (ADR-220), so the page is not forced to be
// taller than its content there.
export default function ChatLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PublicHeader />
      <div className="flex flex-col lg:min-h-dvh">{children}</div>
      <CompareBar />
    </>
  );
}

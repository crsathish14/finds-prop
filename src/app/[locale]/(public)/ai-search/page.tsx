import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AiChatScreen, AiChatScreenSkeleton } from "@/features/ai-chat";
import { NO_INDEX } from "@/features/seo";
import { getFeatureFlags, getTranslate } from "@/features/site";

export async function generateMetadata(): Promise<Metadata> {
  const translate = await getTranslate();
  return {
    title: translate("ai.pageTitle"),
    description: translate("ai.pageDescription"),
    ...NO_INDEX,
  };
}

/**
 * The AI chat (ADR-128, P5-T02). AI search is not part of the launch (FLAG_AI_SEARCH): while the flag is off the page
 * does not exist, and nothing in the navigation points to it (R-FE-17). The page only composes; the conversation,
 * the stream and the sign-in gate are in the feature's island.
 */
export default function AiSearchPage() {
  if (!getFeatureFlags().aiSearch) notFound();
  return (
    <main id="main" className="flex flex-1 flex-col">
      <Suspense fallback={<AiChatScreenSkeleton />}>
        <AiChatScreen />
      </Suspense>
    </main>
  );
}

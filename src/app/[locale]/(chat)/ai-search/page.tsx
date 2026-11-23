import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AiChatScreen, AiChatScreenSkeleton } from "@/features/ai-chat";
import { NO_INDEX } from "@/features/seo";
import { getFeatureFlags, getSiteSettings, getTranslate } from "@/features/site";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata(): Promise<Metadata> {
  const translate = await getTranslate();
  return {
    title: translate("ai.pageTitle"),
    description: translate("ai.pageDescription"),
    ...NO_INDEX,
  };
}

/**
 * The disclaimer the super admin wrote for this page (ADR-152), under the chat. Plain text; nothing is drawn while it
 * is empty. It reads the cached site content and no cookies, so it is not part of the chat's dynamic hole.
 */
async function AiSearchDisclaimer() {
  const { disclaimers } = await getSiteSettings();
  if (!disclaimers.aiSearch) return null;
  return (
    <p
      data-slot="ai-search-disclaimer"
      className="mx-auto w-full max-w-205 px-gutter pt-2 pb-6 text-small whitespace-pre-line text-muted"
    >
      {disclaimers.aiSearch}
    </p>
  );
}

/**
 * The AI chat (ADR-128, P5-T02). AI search is not part of the launch (FLAG_AI_SEARCH): while the flag is off the page
 * does not exist, and nothing in the navigation points to it (R-FE-17). The page only composes; the conversation,
 * the stream and the sign-in gate are in the feature's island.
 */
export default function AiSearchPage({ searchParams }: PageProps) {
  if (!getFeatureFlags().aiSearch) notFound();
  return (
    <main id="main" className="flex flex-1 flex-col">
      <Suspense fallback={<AiChatScreenSkeleton />}>
        <AiChatScreen searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={null}>
        <AiSearchDisclaimer />
      </Suspense>
    </main>
  );
}

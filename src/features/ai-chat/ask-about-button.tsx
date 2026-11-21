import { AiCta } from "@/components/ui/ai-cta.client";
import { AiSparkle } from "@/components/ui/ai-sparkle";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { getFeatureFlags, getTranslate } from "@/features/site";
import { chatContextHref, type ContextSubject } from "./context/page-context";

const LABEL_KEYS = {
  home: "ai.askHome",
  project: "ai.askProject",
  compare: "ai.askCompare",
} as const;

/**
 * "Ask about this home", "Ask about this project" and "Ask about these homes" (AI-P7-T01, owner decision of 16 Nov
 * 2026): a secondary button that is a link to the chat with the item as its context. The link carries the public id
 * or ids and nothing else; the chat checks them on the server. While `FLAG_AI_SEARCH` is off it is not drawn at all,
 * so nothing on the page points to a chat that does not exist (R-FE-17). It needs no sign-in.
 * It gets the AI motion (AiCta "outline"): a short wiggle the first time it scrolls into view, then a calmer idle loop.
 */
export async function AskAboutButton({ subject }: { subject: ContextSubject }) {
  if (!getFeatureFlags().aiSearch) return null;
  const translate = await getTranslate();
  return (
    <Button asChild variant="secondary" size="sm">
      <AiCta name="ask" variant="outline" entrance>
        <Link href={chatContextHref(subject)} className="no-underline hover:no-underline">
          <AiSparkle />
          {translate(LABEL_KEYS[subject.kind])}
        </Link>
      </AiCta>
    </Button>
  );
}

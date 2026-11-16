import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
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
 */
export async function AskAboutButton({ subject }: { subject: ContextSubject }) {
  if (!getFeatureFlags().aiSearch) return null;
  const translate = await getTranslate();
  return (
    <Button asChild variant="secondary" size="sm">
      <Link href={chatContextHref(subject)} className="no-underline hover:no-underline">
        <Icon icon={Sparkles} size="sm" />
        {translate(LABEL_KEYS[subject.kind])}
      </Link>
    </Button>
  );
}

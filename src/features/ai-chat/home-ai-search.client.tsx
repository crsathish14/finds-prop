"use client";

import { useRouter } from "next/navigation";
import { HomeSearchBar } from "@/components/domain/home-search-bar.client";
import { MAX_INPUT_CHARACTERS } from "@/config/ai";
import { browserStorage } from "./chat/chat-model";
import { keepHomeQuestion } from "./chat/home-question";

/** The chat page (ADR-128). */
const AI_SEARCH_PATH = "/ai-search";

/**
 * The home page's search bar joined to the chat (owner's change of 22 Nov 2026, ADR-150): the words are kept in this
 * tab (`keepHomeQuestion`) and the chat opens and sends them as its first message. Drawn only while
 * `FLAG_AI_SEARCH` is on; the page shows the keyword bar otherwise. The sign-in the chat needs is still decided by the
 * chat's endpoint: a visitor who is not signed in finds the words back in the box after signing in.
 */
export function HomeAiSearch() {
  const router = useRouter();
  return (
    <HomeSearchBar
      mode="ai"
      action={AI_SEARCH_PATH}
      maxLength={MAX_INPUT_CHARACTERS}
      onSearch={(text) => {
        keepHomeQuestion(browserStorage(), text);
        router.push(AI_SEARCH_PATH);
      }}
    />
  );
}

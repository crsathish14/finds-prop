import { Skeleton } from "@/components/ui/skeleton";
import { CompareCardToggle, CompareChatBar } from "@/features/compare";
import { SaveHomeButton } from "@/features/saved";
import { getSessionView } from "@/server/auth/get-session-view";
import { realContextReads } from "./context/reads";
import { readContextParams } from "./context/page-context";
import { resolveContext } from "./context/resolve";
import { ChatIsland } from "./chat/chat.client";

export type AiChatScreenProps = {
  /** The address's search parameters (`?home=`, `?project=`, `?compare=`), read under the page's Suspense. */
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * The body of `/ai-search`: who is signed in, and the chat island. Signed in or not is read here on the server (from
 * the verified token) and passed as one boolean, so the island can tell a visitor who has come back from signing in.
 * It reads cookies, so the page puts it under Suspense. The island never decides who may chat: the endpoint does.
 * It also hands the island the heart and Compare controls of the answer cards, because the island may not import the
 * features that own them (their indexes hold server code).
 */
export async function AiChatScreen({ searchParams }: AiChatScreenProps) {
  const [session, params] = await Promise.all([getSessionView(), searchParams]);
  // The page the chat was opened from (AI-P7-T01): checked here against what is listed now, so a bad or stale link
  // simply opens the chat with no context. A read that fails does the same. Only ids go on to the island.
  const context = await resolveContext(readContextParams(params), realContextReads).catch(
    () => null,
  );
  return (
    <ChatIsland
      signedIn={session !== null}
      context={context}
      controls={{ Save: SaveHomeButton, Compare: CompareCardToggle, CompareBar: CompareChatBar }}
    />
  );
}

/** What shows while the session is read. */
export function AiChatScreenSkeleton() {
  return (
    <div aria-busy="true" className="mx-auto grid w-full max-w-205 gap-6 px-gutter py-10">
      <Skeleton shape="title" className="w-2/3" />
      <Skeleton shape="text" className="w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

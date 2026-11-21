import { CircleUser, Heart, House, Plus, Search, Sparkles } from "lucide-react";
import { Suspense } from "react";
import { AiSparkle } from "@/components/ui/ai-sparkle";
import { Icon } from "@/components/ui/icon";
import { BottomBarNav } from "./bottom-bar.client";
import { buildBottomBar, type BottomBarKey } from "./chrome";
import { getFeatureFlags } from "./flags";
import { getTranslate } from "./translator";

const ICONS = {
  home: House,
  search: Search,
  ai: Sparkles,
  post: Plus,
  saved: Heart,
  me: CircleUser,
} as const satisfies Record<BottomBarKey, unknown>;

/**
 * The bottom bar for phones: Home, Search, Post, Saved and Me, or with the AI chat on (ADD-17) Home,
 * Search, AI, Post and Me. The same bar serves visitors and signed-in people. Saved and Me lead to
 * pages that send a visitor to sign-in and back, so it needs no session, and it shows no saved count
 * until saved homes exist (S5-T01).
 */
export async function PublicBottomBar() {
  const bar = buildBottomBar(await getTranslate(), getFeatureFlags());
  // The bar reads the path, which a route with an unknown segment only has at request time.
  return (
    <Suspense fallback={null}>
      <BottomBarNav
        navLabel={bar.navLabel}
        items={bar.items.map((item) => ({
          ...item,
          icon: item.key === "ai" ? <AiSparkle size="md" /> : <Icon icon={ICONS[item.key]} />,
        }))}
      />
    </Suspense>
  );
}

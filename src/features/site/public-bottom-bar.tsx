import { CircleUser, Heart, House, Plus, Search } from "lucide-react";
import { Suspense } from "react";
import { Icon } from "@/components/ui/icon";
import { BottomBarNav } from "./bottom-bar.client";
import { buildBottomBar, type BottomBarKey } from "./chrome";
import { getTranslate } from "./translator";

const ICONS = {
  home: House,
  search: Search,
  post: Plus,
  saved: Heart,
  me: CircleUser,
} as const satisfies Record<BottomBarKey, unknown>;

/**
 * The bottom bar for phones: Home, Search, Post, Saved and Me. The same bar serves visitors and
 * signed-in people. Saved and Me lead to pages that send a visitor to sign-in and back, so it
 * needs no session, and it shows no saved count until saved homes exist (S5-T01).
 */
export async function PublicBottomBar() {
  const bar = buildBottomBar(await getTranslate());
  // The bar reads the path, which a route with an unknown segment only has at request time.
  return (
    <Suspense fallback={null}>
      <BottomBarNav
        navLabel={bar.navLabel}
        items={bar.items.map((item) => ({ ...item, icon: <Icon icon={ICONS[item.key]} /> }))}
      />
    </Suspense>
  );
}

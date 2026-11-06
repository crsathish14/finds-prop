import type { ReactNode } from "react";
import { PropertyCard } from "@/components/domain/property-card";
import { SectionGrid } from "@/components/domain/section-grid";
import { getTranslate } from "@/features/site";
import { publicEnv } from "@/lib/public-env";
import { toSavedCard } from "./cards";
import { SaveHomeButton } from "./save-home.client";
import { savedHomes } from "./queries";

/** The first saved homes are above the fold, so their pictures load at once. */
const PRIORITY_CARDS = 3;

/**
 * The Saved tab of the dashboard (S5-T01): the visitor's saved homes as the search draws them, each
 * with its heart to remove it. With none that the database still shows, the tab shows its empty state
 * (the fallback the page gives). A failed read throws, so the account's error page shows it.
 */
export async function SavedTab({ fallback }: { fallback: ReactNode }) {
  const [homes, translate] = await Promise.all([savedHomes(), getTranslate()]);
  if (homes.length === 0) return fallback;
  return (
    <section aria-label={translate("account.dashboard.tabs.saved")}>
      <SectionGrid variant="cards">
        {homes.map((home, index) => (
          <PropertyCard
            key={home.shortId}
            property={toSavedCard(home, {
              translate,
              supabaseUrl: publicEnv.NEXT_PUBLIC_SUPABASE_URL,
            })}
            priority={index < PRIORITY_CARDS}
            save={<SaveHomeButton shortId={home.shortId} />}
          />
        ))}
      </SectionGrid>
    </section>
  );
}

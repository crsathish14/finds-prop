import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { buildHeader } from "./chrome";
import { getFeatureFlags } from "./flags";
import { HeaderAccountActions, HeaderAccountDrawer } from "./header-account";
import { HeaderFrame } from "./header-frame.client";
import { HeaderView } from "./header-view";
import { getSiteSettings } from "./queries";
import { getTranslate } from "./translator";

/**
 * The header of every public page (S4-T06): logo, the main links and Post property come from the
 * cached site content and the flags, so they are part of the page's static shell. Who is signed in
 * is read behind its own Suspense boundaries, where a fixed-size placeholder holds the place of the
 * account button and the menu button so nothing jumps when they arrive. The client frame only adds
 * the current-page mark; until it has the path, the same header is shown without it.
 */
export async function PublicHeader() {
  const translate = await getTranslate();
  const settings = await getSiteSettings();
  const header = buildHeader(settings.header, getFeatureFlags(), translate);

  const view = {
    header,
    labels: {
      nav: translate("site.header.navLabel"),
      home: translate("site.header.homeLabel", { brandName: header.brandName }),
    },
    accountSlot: (
      <Suspense fallback={<Skeleton shape="circle" className="size-10" />}>
        <HeaderAccountActions />
      </Suspense>
    ),
    menuSlot: (
      <Suspense fallback={<Skeleton shape="circle" className="size-(--size-icon-btn) lg:hidden" />}>
        <HeaderAccountDrawer links={header.links} cta={header.cta} />
      </Suspense>
    ),
  };
  return (
    <Suspense fallback={<HeaderView {...view} />}>
      <HeaderFrame {...view} />
    </Suspense>
  );
}

import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import { SHARE_IMAGE_HEIGHT, SHARE_IMAGE_WIDTH } from "@/features/seo";
import { routing } from "@/i18n/routing";
import { ShareCard } from "@/styles/share-card";

/**
 * The default share image (FR-PUB-14): the brand card every public page falls back to when it has no
 * photo of its own. It is drawn in code from the site's own name and tagline, so there is no file to
 * keep in step with the brand. The address ends in `.png` so the proxy leaves it alone, and it is
 * not under any path `robots.txt` shuts, so the crawlers that fetch share images may read it.
 */
export async function GET() {
  const translate = await getTranslations({ locale: routing.defaultLocale, namespace: "meta" });
  return new ImageResponse(
    <ShareCard name={translate("title")} tagline={translate("description")} />,
    {
      width: SHARE_IMAGE_WIDTH,
      height: SHARE_IMAGE_HEIGHT,
      headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" },
    },
  );
}

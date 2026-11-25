import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Toaster } from "@/components/patterns/toaster";
import { SkipLink } from "@/components/ui/skip-link";
import { TooltipProvider } from "@/components/ui/tooltip";
import { siteOrigin } from "@/features/seo";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { fontVariables } from "@/styles/fonts";
import { SHARE_CARD_COLORS } from "@/styles/share-card";
import "@/styles/globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

// The browser's address-bar colour on phones: the brand's ink (the same ink as the app icon; the one place colours are written out is the share card).
export const viewport: Viewport = { themeColor: SHARE_CARD_COLORS.background };

export async function generateMetadata(): Promise<Metadata> {
  const translate = await getTranslations("meta");
  // The base every page's relative canonical, Open Graph and share-image address is made whole with.
  return {
    metadataBase: new URL(siteOrigin()),
    title: { default: translate("title"), template: translate("titleTemplate") },
    description: translate("description"),
    icons: {
      icon: [
        { url: "/brand/findsprop-app-icon.svg", type: "image/svg+xml" },
        { url: "/icons/icon-16.png", sizes: "16x16", type: "image/png" },
        { url: "/icons/icon-32.png", sizes: "32x32", type: "image/png" },
        { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
  };
}

// The header, footer and bottom bar are shared components (src/components/layout); each page group
// adds the ones it needs. What every page gets: the skip link, tooltips and the toast area.
export default async function RootLayout({ children }: LayoutProps<"/[locale]">) {
  const locale = await getLocale();
  const translate = await getTranslations();
  return (
    <html lang={locale} className={cn(fontVariables, "h-full antialiased")}>
      <body className="min-h-full flex flex-col">
        <SkipLink>{translate("common.skipToContent")}</SkipLink>
        <NextIntlClientProvider>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster
            closeLabel={translate("common.close")}
            containerLabel={translate("toast.container")}
          />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

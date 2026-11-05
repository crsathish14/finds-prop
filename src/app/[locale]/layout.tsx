import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Toaster } from "@/components/patterns/toaster";
import { SkipLink } from "@/components/ui/skip-link";
import { TooltipProvider } from "@/components/ui/tooltip";
import { siteOrigin } from "@/features/seo";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { fontVariables } from "@/styles/fonts";
import "@/styles/globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const translate = await getTranslations("meta");
  // The base every page's relative canonical, Open Graph and share-image address is made whole with.
  return {
    metadataBase: new URL(siteOrigin()),
    title: { default: translate("title"), template: translate("titleTemplate") },
    description: translate("description"),
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

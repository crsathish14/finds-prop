import type en from "@/i18n/messages/en.json";
import type { routing } from "@/i18n/routing";

// Typed keys: translate("home.nope") fails typecheck.
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof en;
  }
}

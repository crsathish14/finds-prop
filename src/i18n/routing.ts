import { defineRouting } from "next-intl/routing";

// English is the only enabled language. It has no URL prefix; a later language gets one
// (/ta/...). DEC-40, ADR-035.
export const routing = defineRouting({
  locales: ["en"],
  defaultLocale: "en",
  localePrefix: "as-needed",
});

import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { notFound } from "next/navigation";
import * as rootParams from "next/root-params";
import { routing } from "./routing";

// The language comes from the [locale] route segment (root params), not from a request header,
// so pages stay prerendered with Cache Components. Unknown languages are a 404.
export default getRequestConfig(async ({ locale: override }) => {
  let locale: string | undefined = override;
  if (!locale) locale = await rootParams.locale();
  if (!hasLocale(routing.locales, locale)) notFound();
  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});

import "server-only";
import { getTranslations } from "next-intl/server";
import type { Translate } from "@/lib/format";

/**
 * The page's translator as the plain `(key, values)` function the chrome builders take. next-intl
 * types keys from en.json; the builders pass keys as strings, as the sign-in screens do, and the
 * message check (G-21) and the tests that read the real catalogue catch a wrong key.
 */
export async function getTranslate(): Promise<Translate> {
  return (await getTranslations()) as unknown as Translate;
}

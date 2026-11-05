import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { robotsFile, siteOrigin } from "@/features/seo";
import { env } from "@/server/env";

/**
 * `robots.txt` (FR-PUB-14): open to crawlers in production only, with the private paths shut. It waits
 * for a request, so the environment is read when a crawler asks and not when the site was built: a
 * build made for one environment can never answer for another.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection();
  return robotsFile({ production: env.APP_ENV === "production", origin: siteOrigin() });
}

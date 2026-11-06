import type { Metadata } from "next";
import { pageMetadata } from "@/features/seo";
import type { Translate } from "@/lib/format";

/** The title, description and canonical address of the contact page (S5-T05). */
export function contactMetadata(translate: Translate): Metadata {
  return pageMetadata({
    title: translate("contact.meta.title"),
    description: translate("contact.meta.description"),
    path: "/contact",
    siteName: translate("meta.title"),
  });
}

import type { Metadata } from "next";
import { PostPropertyScreen } from "@/features/listings";
import { getTranslate } from "@/features/site";

// The account layout already says the page is never indexed.
export async function generateMetadata(): Promise<Metadata> {
  const translate = await getTranslate();
  return { title: translate("postProperty.metaTitle") };
}

/** Post a property (S6-T02): a new listing, with the owner's drafts above it. */
export default function PostPropertyPage() {
  return <PostPropertyScreen />;
}

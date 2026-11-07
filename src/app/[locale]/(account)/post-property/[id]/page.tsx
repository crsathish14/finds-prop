import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getMyDraft, MY_LISTINGS_HREF, PostPropertyScreen } from "@/features/listings";
import { getTranslate } from "@/features/site";

type PageProps = { params: Promise<{ id: string }> };

// The account layout already says the page is never indexed.
export async function generateMetadata(): Promise<Metadata> {
  const translate = await getTranslate();
  return { title: translate("postProperty.metaTitle") };
}

/**
 * Continue a draft (S6-T02, FR-ACC-08). An address that is not a listing id, a listing that is not the
 * signed-in person's, and one that does not exist all look the same: not found. A listing that is no longer a
 * draft (sent for review, live, sold) leads to My listings; editing those is a later task (S6-T05).
 */
export default async function ContinueDraftPage({ params }: PageProps) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const draft = await getMyDraft(id.toLowerCase());
  if (!draft) notFound();
  if (draft.status !== "draft") redirect(MY_LISTINGS_HREF);
  return <PostPropertyScreen draft={draft} />;
}

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getMyDraft, isSignedIn, MY_LISTINGS_HREF, PostPropertyScreen } from "@/features/listings";
import { getTranslate } from "@/features/site";

type PageProps = { params: Promise<{ id: string }> };

// The account layout already says the page is never indexed.
export async function generateMetadata(): Promise<Metadata> {
  const translate = await getTranslate();
  return { title: translate("postProperty.metaTitle") };
}

/**
 * Continue a draft, or edit a listing that is already sent (S6-T02, S6-T05, FR-ACC-08, FR-ACC-09). An address
 * that is not a listing id, a listing that is not the signed-in person's, and one that does not exist all look
 * the same: not found. A draft is continued; a listing in review, Live or not approved opens the wizard to edit
 * it; a sold or rented listing is final and leads to My listings.
 */
export default async function ContinueDraftPage({ params }: PageProps) {
  const { id } = await params;
  // Nobody signed in: the layout's gate is already sending them to sign in.
  if (!(await isSignedIn())) return null;
  if (!z.uuid().safeParse(id).success) notFound();
  const draft = await getMyDraft(id.toLowerCase());
  if (!draft) notFound();
  if (draft.status === "sold" || draft.status === "rented") redirect(MY_LISTINGS_HREF);
  return <PostPropertyScreen draft={draft} />;
}

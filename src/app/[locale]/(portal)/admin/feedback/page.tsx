import type { Metadata } from "next";
import {
  FeedbackBoard,
  feedbackFilterSchema,
  getFeedbackCounts,
  getFeedbackPage,
  setFeedbackReviewed,
} from "@/features/feedback";
import { getTranslate } from "@/features/site";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// The portal layout already says the page is never indexed.
export async function generateMetadata(): Promise<Metadata> {
  const translate = await getTranslate();
  return { title: translate("admin.feedback.metaTitle") };
}

/**
 * The admin's feedback page: the messages builders and agents sent, newest first, with a reviewed flag on each. The
 * address names the filter and the page (`?state=reviewed&page=2`); a value that is not valid is dropped. Read as the
 * signed-in admin (the database functions return nothing to anyone else); the role gate in the layout has already sent
 * anyone else away.
 */
export default async function FeedbackPage({ searchParams }: PageProps) {
  const filters = feedbackFilterSchema.parse(await searchParams);
  const [page, counts] = await Promise.all([getFeedbackPage(filters), getFeedbackCounts()]);
  return (
    <FeedbackBoard page={page} counts={counts} actions={{ setReviewed: setFeedbackReviewed }} />
  );
}

import type { Metadata } from "next";
import { FeedbackForm, sendFeedback } from "@/features/feedback";
import { getTranslate } from "@/features/site";

// The portal layout already says the page is never indexed.
export async function generateMetadata(): Promise<Metadata> {
  const translate = await getTranslate();
  return { title: translate("builderPortal.feedback.metaTitle") };
}

/** The builder's feedback page: one message box. The role gate in the layout has already sent anyone else away. */
export default function BuilderFeedbackPage() {
  return <FeedbackForm actions={{ send: sendFeedback }} />;
}

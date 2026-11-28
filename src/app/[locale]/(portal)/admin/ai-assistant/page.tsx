import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import {
  AiAssistantForm,
  estimateSpendUsd,
  getAiAssistantOverview,
  saveAiAssistant,
  WebAnswersTable,
} from "@/features/ai-assistant";
import { getTranslate } from "@/features/site";

// The portal layout already says the page is never indexed.
export async function generateMetadata(): Promise<Metadata> {
  const translate = await getTranslate();
  return { title: translate("admin.aiAssistant.metaTitle") };
}

/**
 * The super admin's AI assistant page (ADR-218, piece 7): this month's estimated spend, the credit bought and the estimated credit left, then the questions most often answered from the web. Read as the
 * signed-in admin and never cached; the role gate in the layout has already sent anyone else away, and the database
 * function refuses anyone else too.
 */
export default async function AiAssistantPage() {
  const [overview, translate, locale] = await Promise.all([
    getAiAssistantOverview(),
    getTranslate(),
    getLocale(),
  ]);
  const initial = {
    creditBoughtUsd: overview.creditBoughtUsd === null ? "" : overview.creditBoughtUsd.toFixed(2),
  };
  return (
    <div className="flex flex-col gap-10">
      <AiAssistantForm
        key={JSON.stringify(initial)}
        initial={initial}
        spendUsd={estimateSpendUsd(overview.month)}
        locale={locale}
        save={saveAiAssistant}
      />
      <WebAnswersTable rows={overview.answers} translate={translate} locale={locale} />
    </div>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import {
  getBuilderResearchPanel,
  readBuilderPagesAgain,
  ResearchPagesPanel,
  saveBuilderResearchPages,
} from "@/features/builder-research";
import { getTranslate } from "@/features/site";
import { Heading } from "@/components/ui/heading";
import { Link } from "@/components/ui/link";

type PageProps = { params: Promise<{ id: string }> };

const builderIdSchema = z.uuid();

// The portal layout already says the page is never indexed.
export async function generateMetadata(): Promise<Metadata> {
  const translate = await getTranslate();
  return { title: translate("builderResearch.admin.metaTitle") };
}

/**
 * The admin's page for one builder's pages for the AI assistant (AI search Phase 4): the same panel the builder has on
 * the profile, with what could not be read and when. An address that is not a builder id, or a builder that does not
 * exist, is "not found". Read as the signed-in admin; the role gate in the layout has already sent anyone else away.
 */
export default async function BuilderAiPagesPage({ params }: PageProps) {
  const { id } = await params;
  const parsed = builderIdSchema.safeParse(id);
  if (!parsed.success) notFound();
  const [panel, translate] = await Promise.all([
    getBuilderResearchPanel(parsed.data.toLowerCase()),
    getTranslate(),
  ]);
  if (!panel) notFound();
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href="/admin/builders">{translate("builderResearch.admin.back")}</Link>
        <Heading as="h1" size="1">
          {translate("builderResearch.admin.title", { name: panel.name })}
        </Heading>
      </div>
      <ResearchPagesPanel
        panel={panel}
        actions={{ save: saveBuilderResearchPages, readAgain: readBuilderPagesAgain }}
      />
    </div>
  );
}

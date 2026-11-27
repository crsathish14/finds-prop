import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getMyResearchPanel,
  readMyPagesAgain,
  ResearchPagesPanel,
  saveMyResearchPages,
} from "@/features/builder-research";
import { BuilderProfile, getMyProfile, updateMyProfile } from "@/features/builders";
import { getTranslate } from "@/features/site";

// The portal layout already says the page is never indexed.
export async function generateMetadata(): Promise<Metadata> {
  const translate = await getTranslate();
  return { title: translate("builderPortal.profile.metaTitle") };
}

/**
 * The builder's profile page (S7-T03, FR-BLD-05): their company's details, which they can change without approval,
 * and the card buyers see. It is read as the signed-in builder (`my_builder()` answers only for their own record);
 * the role gate in the layout has already sent anyone else away. Below it, the pages the AI assistant may read about
 * the builder (AI search Phase 4).
 */
export default async function BuilderProfilePage() {
  const [profile, research] = await Promise.all([getMyProfile(), getMyResearchPanel()]);
  if (!profile) notFound();
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <BuilderProfile profile={profile} actions={{ save: updateMyProfile }} />
      {research ? (
        <ResearchPagesPanel
          panel={research}
          actions={{ save: saveMyResearchPages, readAgain: readMyPagesAgain }}
        />
      ) : null}
    </div>
  );
}

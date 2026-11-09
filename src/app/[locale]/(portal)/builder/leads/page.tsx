import type { Metadata } from "next";
import {
  BuilderLeadsBoard,
  getLeadsPage,
  leadFilterSchema,
  loadMoreMyLeads,
  setMyLeadStatus,
} from "@/features/leads";
import { getTranslate } from "@/features/site";

// The portal layout already says the page is never indexed.
export async function generateMetadata(): Promise<Metadata> {
  const translate = await getTranslate();
  return { title: translate("builderPortal.leads.metaTitle") };
}

/**
 * The builder's leads page (S7-T03, FR-BLD-04): the leads of the builder's own projects, with the one thing that can
 * be changed, a lead's state. The leads are read as the signed-in builder, so the database returns only the leads of
 * their own projects; the role gate in the layout has already sent anyone else away.
 */
export default async function BuilderLeadsPage() {
  const leads = await getLeadsPage(leadFilterSchema.parse({}));
  return (
    <BuilderLeadsBoard
      page={leads}
      actions={{ setStatus: setMyLeadStatus, loadMore: loadMoreMyLeads }}
    />
  );
}

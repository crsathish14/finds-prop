import type { Metadata } from "next";
import {
  BuildersBoard,
  getBuilderOverview,
  inviteBuilder,
  resendInvitation,
  setBuilderActive,
  updateBuilder,
} from "@/features/builders";
import { getTranslate } from "@/features/site";

// The portal layout already says the page is never indexed.
export async function generateMetadata(): Promise<Metadata> {
  const translate = await getTranslate();
  return { title: translate("admin.builders.metaTitle") };
}

/**
 * The admin's builders page (S7-T05, FR-ADM-04): every builder and agent with their state, and the invite, edit,
 * resend and activate or deactivate actions. The list is read as the signed-in admin (the database function checks
 * that itself); the role gate in the layout has already sent anyone else away.
 */
export default async function BuildersPage() {
  const { builders, now } = await getBuilderOverview();
  return (
    <BuildersBoard
      builders={builders}
      now={now}
      actions={{
        invite: inviteBuilder,
        resend: resendInvitation,
        setActive: setBuilderActive,
        update: updateBuilder,
      }}
    />
  );
}

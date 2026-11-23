import type { Metadata } from "next";
import { LegalPage, getLegalDocument, legalMetadata } from "@/features/legal";
import { getTranslate } from "@/features/site";

export async function generateMetadata(): Promise<Metadata> {
  const [translate, document] = await Promise.all([getTranslate(), getLegalDocument("terms")]);
  return legalMetadata("terms", translate, document);
}

/**
 * The terms page (S5-T06, ADR-053, ADR-151): the shared legal reading layout with the text the admin published, or the
 * text in code until there is one.
 */
export default async function Page() {
  const document = await getLegalDocument("terms");
  return (
    <main id="main" className="flex-1">
      <LegalPage kind="terms" document={document} />
    </main>
  );
}

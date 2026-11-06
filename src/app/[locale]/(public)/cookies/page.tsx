import type { Metadata } from "next";
import { LegalPage, legalMetadata } from "@/features/legal";
import { getTranslate } from "@/features/site";

export async function generateMetadata(): Promise<Metadata> {
  return legalMetadata("cookies", await getTranslate());
}

/** The cookies page (S5-T06, ADR-053): the shared legal reading layout with its own text. */
export default function Page() {
  return (
    <main id="main" className="flex-1">
      <LegalPage kind="cookies" />
    </main>
  );
}

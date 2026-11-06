"use client";

import { LegalPage } from "@/features/legal/legal-page";
import { Specimen } from "../frame";

const FRAME = "w-full rounded-xl border border-line bg-canvas";

/**
 * The three legal pages in the shared reading layout, as placeholders: Privacy Policy (with its data
 * table), Terms of Use, and Cookie information (with the list of what the site stores in the browser),
 * plus the phone's "On this page" list open. Nothing here navigates.
 */
export function LegalPagesDemo() {
  return (
    <div className="flex flex-col gap-14">
      <Specimen
        label="Privacy Policy: the draft notice, the contents beside the text, the data table"
        className="w-full"
      >
        <div className={FRAME}>
          <LegalPage kind="privacy" titleAs="h2" titleId="lab-legal-privacy" />
        </div>
      </Specimen>
      <Specimen label="Terms of Use" className="w-full">
        <div className={FRAME}>
          <LegalPage kind="terms" titleAs="h2" titleId="lab-legal-terms" />
        </div>
      </Specimen>
      <Specimen label="Cookie information: what the site stores in the browser" className="w-full">
        <div className={FRAME}>
          <LegalPage kind="cookies" titleAs="h2" titleId="lab-legal-cookies" />
        </div>
      </Specimen>
      <Specimen
        label="On a phone the contents is a list that opens (shown open here)"
        className="w-full"
      >
        <div className={FRAME}>
          <LegalPage kind="privacy" contentsOpen titleAs="h2" titleId="lab-legal-open" />
        </div>
      </Specimen>
    </div>
  );
}

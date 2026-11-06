"use client";

import { DynamicForm, type DynamicFormField } from "@/components/domain/dynamic-form";
import { EnquiryCard } from "@/components/domain/enquiry-card";
import { SessionEndedAlert } from "@/components/domain/session-ended-alert";
import {
  ProjectFormCard,
  ProjectFormConsent,
  ProjectFormTitle,
} from "@/features/projects/project-form-card";
import { ProjectLeadCard } from "@/features/projects/project-lead-card.client";
import { Specimen } from "../frame";

const NOTHING = () => undefined;
const SESSION_ENDED = { href: "#", onSignIn: NOTHING };

const WINDOW = { visitDateMin: "2026-11-06", visitDateMax: "2027-11-06" };

/** A project's own form, as the form builder could store it (the real ones are the content team's data). */
const OWN_FORM_FIELDS: DynamicFormField[] = [
  { label: "Your name", key: "name", type: "text", required: true },
  { label: "Mobile", key: "mobile", type: "text", required: true },
  { label: "Preferred visit day", key: "visit_date", type: "date", required: true },
  { label: "Message", key: "message", type: "textarea", max: 300, required: false },
];

/**
 * The warning a form shows when the visitor's session ended before they could send it (S5-T07): on its own,
 * and inside the enquiry card, the phone's enquiry sheet, the project's enquiry card and a project's own form. What was typed is
 * still in the form. Nothing here signs in or navigates. The words are not approved yet.
 */
export function SessionEndedDemo() {
  return (
    <div className="flex flex-col gap-14">
      <Specimen
        label="The warning on its own: the session has ended, what was typed is kept, and a link to sign in again"
        className="w-full max-w-md"
      >
        <div className="w-full">
          <SessionEndedAlert href="#" />
        </div>
      </Specimen>
      <Specimen
        label="Property enquiry card: the session ended while the form was filled in; the name, phone and message are still there"
        className="w-full max-w-md"
      >
        <EnquiryCard
          state="form"
          values={{
            name: "Priya Raman",
            phone: "919840012345",
            message: "Is the flat still available this month?",
          }}
          sessionEnded={SESSION_ENDED}
          className="w-full"
        />
      </Specimen>
      <Specimen
        label="The phone's enquiry sheet: the same warning above the form"
        className="w-full max-w-md"
      >
        <EnquiryCard
          state="form"
          variant="sheet"
          values={{ name: "Priya Raman", phone: "919840012345" }}
          sessionEnded={SESSION_ENDED}
          className="w-full"
        />
      </Specimen>
      <Specimen
        label="Project enquiry card: the session ended while a site visit was being asked for"
        className="w-full max-w-md"
      >
        <ProjectLeadCard
          state="form"
          phone="+91 98••• ••345"
          {...WINDOW}
          defaultKind="site_visit"
          values={{ name: "Priya Raman", visitDate: "2026-11-20" }}
          sessionEnded={SESSION_ENDED}
          className="w-full"
        />
      </Specimen>
      <Specimen
        label="The project's own form: the session ended while it was filled in; the typed answers are still there and the phone stays locked"
        className="w-full max-w-md"
      >
        <ProjectFormCard className="w-full">
          <ProjectFormTitle />
          <SessionEndedAlert href="#" className="mb-4" />
          <DynamicForm
            fields={OWN_FORM_FIELDS}
            buttonText="Book a visit"
            compact
            values={{ name: "Priya Raman", visit_date: "2026-11-20", message: "Morning please" }}
            locked={{
              mobile: { value: "+91 98••• ••345", hint: "The number you signed in with." },
            }}
            consent={<ProjectFormConsent developerName="Kadal Homes" />}
            onSubmit={NOTHING}
          />
        </ProjectFormCard>
      </Specimen>
    </div>
  );
}

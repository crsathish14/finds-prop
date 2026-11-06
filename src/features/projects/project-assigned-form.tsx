import { useTranslations } from "next-intl";
import { ConnectedForm, type FormDefinition, type SubmitProjectFormAction } from "@/features/forms";
import {
  ProjectFormCard,
  ProjectFormConsent,
  ProjectFormSent,
  ProjectFormTitle,
} from "./project-form-card";

/**
 * A project's assigned form (S5-T05, change 4, BR-49) for a visitor signed in with a verified phone: the
 * connected renderer inside the enquiry card. The account's phone is shown, masked and locked, in the
 * form's `mobile` field when it has one; the number stored is read from the account on the server, never
 * from what the browser sends. The action is handed in by the slot, so the Design Lab and tests can draw
 * the card without the server.
 */
export function ProjectAssignedForm({
  form,
  slug,
  developerName,
  phone,
  send,
}: {
  form: FormDefinition;
  slug: string;
  developerName: string;
  /** The account's phone as it is shown (masked). */
  phone: string;
  send: SubmitProjectFormAction;
}) {
  const translate = useTranslations("projects.page.lead");
  const hasMobile = form.fields.some((field) => field.key === "mobile");
  return (
    <ProjectFormCard>
      <ConnectedForm
        form={form}
        sendProject={send}
        projectSlug={slug}
        compact
        intro={<ProjectFormTitle />}
        consent={<ProjectFormConsent developerName={developerName} />}
        sent={<ProjectFormSent message={form.successMessage} />}
        {...(hasMobile
          ? { locked: { mobile: { value: phone, hint: translate("phoneHint") } } }
          : {})}
      />
    </ProjectFormCard>
  );
}

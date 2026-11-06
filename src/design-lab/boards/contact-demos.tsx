"use client";

import { DynamicForm, type DynamicFormField } from "@/components/domain/dynamic-form";
import { Button } from "@/components/ui/button";
import { CONTACT_FORM } from "@/features/forms/contact-form";
import { ContactConsent, ContactScreen, type ReachLine } from "@/features/forms/contact-screen";
import { ContactSkeleton } from "@/features/forms/contact-skeleton";
import { ContactLoadFailed, ContactSent } from "@/features/forms/contact-states";
import { Specimen } from "../frame";

const FRAME = "w-full rounded-xl border border-line bg-canvas";
const FRAME_PADDED = "w-full rounded-xl border border-line bg-canvas p-6";
const NOTHING = () => undefined;

/** Sample details for the "Reach us directly" column (the real ones come from the footer settings). */
const REACH: ReachLine[] = [
  { kind: "phone", text: "+91 90000 00000", href: "tel:+919000000000" },
  { kind: "email", text: "hello@findprop.example", href: "mailto:hello@findprop.example" },
  { kind: "address", text: "Chennai, Tamil Nadu" },
];

const FILLED = {
  name: "Priya Raman",
  mobile: "98400 12345",
  email: "priya@example.com",
  interest: "A home to buy",
  message: "I would like to know more about the 3 BHK homes in Velachery.",
};

/** One of every kind of field a form can have (a file field draws nothing until uploads are built). */
const EVERY_FIELD: DynamicFormField[] = [
  {
    label: "Text",
    key: "text_answer",
    type: "text",
    placeholder: "A short answer",
    required: true,
  },
  { label: "Number", key: "number_answer", type: "number", min: 1, max: 9, required: false },
  {
    label: "Email",
    key: "email_answer",
    type: "email",
    placeholder: "you@example.com",
    required: false,
  },
  {
    label: "Dropdown",
    key: "dropdown_answer",
    type: "dropdown",
    options: ["First", "Second"],
    required: false,
  },
  { label: "Date", key: "date_answer", type: "date", required: false },
  {
    label: "Radio buttons",
    key: "radio_answer",
    type: "radio",
    options: ["Buy", "Rent", "Either"],
    required: true,
  },
  {
    label: "Checkboxes",
    key: "checkbox_answer",
    type: "checkbox",
    options: ["Parking", "Gym", "Garden"],
    required: false,
  },
  { label: "I agree to be contacted", key: "single_answer", type: "checkbox", required: true },
  { label: "Message", key: "textarea_answer", type: "textarea", max: 300, required: false },
];

function Page({
  id,
  contacts = REACH,
  children,
}: {
  id: string;
  contacts?: ReachLine[];
  children: React.ReactNode;
}) {
  return (
    <div className={FRAME}>
      <ContactScreen contacts={contacts} titleAs="h2" titleId={id}>
        {children}
      </ContactScreen>
    </div>
  );
}

function ContactForm(props: Partial<React.ComponentProps<typeof DynamicForm>>) {
  return (
    <DynamicForm
      fields={CONTACT_FORM.fields}
      buttonText={CONTACT_FORM.buttonText}
      consent={<ContactConsent />}
      onSubmit={NOTHING}
      {...props}
    />
  );
}

/**
 * The contact page in its states, and the form renderer with one of every kind of field. The form is the
 * default contact form; the words in the page are not approved yet. Nothing here sends or navigates.
 */
export function ContactPageDemo() {
  return (
    <div className="flex flex-col gap-14">
      <Specimen
        label="The contact page: the form (name and mobile needed, the rest optional) with the consent line, and the details to reach Find Prop directly"
        className="w-full"
      >
        <Page id="contact-default">
          <ContactForm />
        </Page>
      </Specimen>
      <Specimen
        label="A wrong mobile and no name: each message beside its field, what was typed kept"
        className="w-full"
      >
        <Page id="contact-errors">
          <ContactForm
            values={{ ...FILLED, name: "", mobile: "98x" }}
            errors={{
              name: "This field is required.",
              mobile: "Enter a 10-digit mobile number that starts with 6, 7, 8 or 9.",
            }}
          />
        </Page>
      </Specimen>
      <Specimen label="Too many messages this hour" className="w-full">
        <Page id="contact-limit">
          <ContactForm values={FILLED} rateLimited />
        </Page>
      </Specimen>
      <Specimen
        label="The message could not be sent (the details are kept), and sending"
        className="w-full"
      >
        <div className="flex flex-col gap-6">
          <Page id="contact-failed">
            <ContactForm values={FILLED} failed />
          </Page>
          <Page id="contact-sending">
            <ContactForm values={FILLED} submitting />
          </Page>
        </div>
      </Specimen>
      <Specimen label="Sent" className="w-full">
        <Page id="contact-sent">
          <ContactSent />
        </Page>
      </Specimen>
      <Specimen
        label="The form could not be loaded: the notice points to the details beside it, with Refresh"
        className="w-full"
      >
        <Page id="contact-load-failed">
          <ContactLoadFailed
            hasContacts
            action={
              <Button variant="secondary" size="sm">
                Refresh
              </Button>
            }
          />
        </Page>
      </Specimen>
      <Specimen
        label="No contact details set in the footer settings: the column is left out and the form keeps a reading width"
        className="w-full"
      >
        <Page id="contact-alone" contacts={[]}>
          <ContactForm />
        </Page>
      </Specimen>
      <Specimen
        label="Form renderer: one of every kind of field (text, number, email, dropdown, date, radio buttons, checkboxes, a single checkbox, a long answer); a file field draws nothing until uploads are built"
        className="w-full"
      >
        <div className={FRAME_PADDED}>
          <DynamicForm fields={EVERY_FIELD} buttonText="Send" onSubmit={NOTHING} />
        </div>
      </Specimen>
      <Specimen label="Loading" className="w-full">
        <div className={FRAME}>
          <ContactSkeleton />
        </div>
      </Specimen>
    </div>
  );
}

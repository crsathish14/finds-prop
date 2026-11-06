import type { Metadata } from "next";
import {
  ConnectedForm,
  ContactConsent,
  ContactLoadFailed,
  ContactScreen,
  ContactSent,
  RefreshButton,
  contactMetadata,
  getContactForm,
  submitForm,
} from "@/features/forms";
import { buildFooterContacts, getSiteSettings, getTranslate } from "@/features/site";

export async function generateMetadata(): Promise<Metadata> {
  return contactMetadata(await getTranslate());
}

/**
 * The contact page (S5-T05, P-07): the active form placed on the contact page, drawn by the same renderer
 * as every stored form, and "Reach us directly" from the footer settings beside it (left out when none is
 * set). When the form cannot be read the page says so and offers Refresh. Open to visitors: no sign-in.
 */
export default async function Page() {
  const [form, settings] = await Promise.all([getContactForm(), getSiteSettings()]);
  const contacts = buildFooterContacts(settings.footer);

  return (
    <main id="main" className="flex-1">
      <ContactScreen contacts={contacts}>
        {form ? (
          <ConnectedForm
            form={form}
            send={submitForm}
            source="/contact"
            consent={<ContactConsent />}
            sent={<ContactSent message={form.successMessage} />}
          />
        ) : (
          <ContactLoadFailed hasContacts={contacts.length > 0} action={<RefreshButton />} />
        )}
      </ContactScreen>
    </main>
  );
}

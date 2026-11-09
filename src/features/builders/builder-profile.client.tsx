"use client";

import { Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  BuilderForm,
  type BuilderFormField,
  type BuilderFormValues,
  type BuilderFormWords,
} from "@/components/domain/builder-form";
import { DeveloperCard } from "@/components/domain/developer-card";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { failureText, fieldErrorText, type Translator } from "@/i18n/failure-text";
import { notify } from "@/lib/notify";
import type { ActionResult } from "@/types/action";
import { isFormField, valuesOf } from "./form";
import type { MyProfileView } from "./view";

type Failure = Extract<ActionResult<unknown>, { ok: false }>;
type FormErrors = Partial<Record<BuilderFormField, string>>;

export type BuilderProfileActions = {
  save: (input: Omit<BuilderFormValues, "email" | "kind">) => Promise<ActionResult<unknown>>;
};

const PANEL = "rounded-xl border border-line bg-surface p-6 shadow-card";

/**
 * The builder's Company profile page (S7-T03, FR-BLD-05): the details form on one side, and on the other the card
 * buyers see in the developer showcase, which follows what is typed. The login email is shown but cannot be
 * changed. A profile change needs no approval. It calls the one action it is given; after a save the page is read
 * again so it shows what the server holds.
 */
export function BuilderProfile({
  profile,
  actions,
}: {
  profile: MyProfileView;
  actions: BuilderProfileActions;
}) {
  const translate = useTranslations("builderPortal.profile");
  const form = useTranslations("admin.builders.form");
  const everything = useTranslations() as unknown as Translator;
  const router = useRouter();

  const [values, setValues] = useState<BuilderFormValues>(valuesOf(profile));
  const [errors, setErrors] = useState<FormErrors>({});
  const [sending, setSending] = useState(false);

  const words: BuilderFormWords = {
    name: form("name"),
    email: form("email"),
    emailHint: form("emailHint"),
    emailLockedHint: translate("emailLockedHint"),
    kind: form("kind"),
    kindBuilder: everything("admin.builders.kindBuilder"),
    kindAgent: everything("admin.builders.kindAgent"),
    contactPerson: form("contactPerson"),
    phone: form("phone"),
    logoUrl: form("logoUrl"),
    website: form("website"),
    description: form("description"),
    optional: form("optional"),
  };

  const change = (field: BuilderFormField, value: string) => {
    setValues((previous) => ({ ...previous, [field]: value }) as BuilderFormValues);
    setErrors((previous) => ({ ...previous, [field]: undefined }));
  };

  /** Puts a failure's field messages on their boxes; true when at least one box got one. */
  const showFieldErrors = (failure: Failure): boolean => {
    const next: FormErrors = {};
    for (const [field, problems] of Object.entries(failure.fieldErrors ?? {})) {
      const first = problems[0];
      if (first && isFormField(field)) next[field] = fieldErrorText(everything, first);
    }
    setErrors(next);
    return Object.keys(next).length > 0;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    try {
      const result = await actions.save({
        name: values.name,
        contactPerson: values.contactPerson,
        phone: values.phone,
        logoUrl: values.logoUrl,
        website: values.website,
        description: values.description,
      });
      if (!result.ok) {
        if (!showFieldErrors(result)) {
          notify.error(failureText(everything, result));
          router.refresh();
        }
        return;
      }
      setErrors({});
      notify.success(translate("toast.title"));
      router.refresh();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Heading as="h1" size="1">
          {translate("title")}
        </Heading>
        <Text tone="muted">{translate("intro")}</Text>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="profile-details" className={PANEL}>
          <Heading as="h2" size="3" id="profile-details" className="mb-4">
            {translate("details")}
          </Heading>
          <form noValidate onSubmit={submit} className="flex flex-col gap-5">
            <BuilderForm
              mode="edit"
              showKind={false}
              values={values}
              errors={errors}
              onChange={change}
              disabled={sending}
              words={words}
            />
            <div className="flex flex-wrap items-center gap-4">
              <Button type="submit" variant="primary" loading={sending}>
                {translate(sending ? "saving" : "save")}
              </Button>
              <Text variant="small" tone="muted">
                {translate("note")}
              </Text>
            </div>
          </form>
        </section>
        <section aria-label={translate("preview.label")} className={PANEL}>
          <Text variant="overline">{translate("preview.label")}</Text>
          <div className="mt-3">
            <DeveloperCard
              developer={{
                name: values.name.trim() || profile.name,
                projectCount: profile.liveProjects,
                about: values.description.trim(),
              }}
            />
          </div>
          <p className="mt-4 flex items-start gap-2 text-small text-muted">
            <Icon icon={Info} size="sm" className="mt-1" />
            <span>{translate("preview.note")}</span>
          </p>
        </section>
      </div>
    </div>
  );
}

"use client";

import { Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type FormEvent } from "react";
import {
  BuilderForm,
  type BuilderFormField,
  type BuilderFormValues,
  type BuilderFormWords,
} from "@/components/domain/builder-form";
import { BuilderLogoField } from "@/components/domain/builder-logo-field";
import { DeveloperCard } from "@/components/domain/developer-card";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { failureText, fieldErrorText, type Translator } from "@/i18n/failure-text";
import { notify } from "@/lib/notify";
import { publicEnv } from "@/lib/public-env";
import { publicStorageUrl } from "@/lib/storage-url";
import type { ActionResult } from "@/types/action";
import { BUILDER_LOGO_BUCKET, BUILDER_LOGO_BYTES_MAX, BUILDER_LOGO_TYPES } from "./constants";
import { initialsOf, isFormField, valuesOf } from "./form";
import { createLogoStorage, logoPathFor, type LogoStorage } from "./logo-storage";
import type { MyProfileView } from "./view";

type Failure = Extract<ActionResult<unknown>, { ok: false }>;
type FormErrors = Partial<Record<BuilderFormField, string>>;

export type BuilderProfileActions = {
  save: (
    input: Omit<BuilderFormValues, "email" | "kind"> & { logoPath: string },
  ) => Promise<ActionResult<unknown>>;
};

const PANEL = "rounded-xl border border-line bg-surface p-6 shadow-card";

/**
 * The builder's Company profile page (S7-T03, FR-BLD-05): the details form on one side, and on the other the card
 * buyers see in the developer showcase, which follows what is typed. The login email is shown but cannot be
 * changed. A profile change needs no approval. It calls the one action it is given; after a save the page is read
 * again so it shows what the server holds. The logo (ADR-179) is uploaded to the builder's own folder as soon as it is
 * chosen and kept by the save; a logo chosen and then replaced or removed before saving, and the old logo after a
 * save, are taken out of the bucket.
 */
export function BuilderProfile({
  profile,
  actions,
  logoStorage,
}: {
  profile: MyProfileView;
  actions: BuilderProfileActions;
  /** The tests give their own; the page uses the real bucket. */
  logoStorage?: LogoStorage;
}) {
  const translate = useTranslations("builderPortal.profile");
  const form = useTranslations("admin.builders.form");
  const everything = useTranslations() as unknown as Translator;
  const router = useRouter();

  const [values, setValues] = useState<BuilderFormValues>(valuesOf(profile));
  const [errors, setErrors] = useState<FormErrors>({});
  const [sending, setSending] = useState(false);
  const storage = useMemo(() => logoStorage ?? createLogoStorage(), [logoStorage]);
  const [logoPath, setLogoPath] = useState<string | null>(profile.logoPath);
  const [uploading, setUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | undefined>(undefined);
  /** Logos uploaded on this page and not saved yet: taken away again if they are replaced or removed. */
  const unsaved = useRef(new Set<string>());

  const dropIfUnsaved = (path: string | null) => {
    if (path && unsaved.current.has(path)) {
      unsaved.current.delete(path);
      void storage.remove([path]);
    }
  };

  const chooseLogo = async (file: File) => {
    setLogoError(undefined);
    if (!(BUILDER_LOGO_TYPES as readonly string[]).includes(file.type)) {
      setLogoError(translate("logo.wrongType"));
      return;
    }
    if (file.size > BUILDER_LOGO_BYTES_MAX) {
      setLogoError(translate("logo.tooHeavy"));
      return;
    }
    setUploading(true);
    try {
      const path = logoPathFor(profile.id, file, crypto.randomUUID());
      if (!(await storage.upload(path, file))) {
        setLogoError(translate("logo.failed"));
        return;
      }
      dropIfUnsaved(logoPath);
      unsaved.current.add(path);
      setLogoPath(path);
    } finally {
      setUploading(false);
    }
  };

  const removeLogo = () => {
    setLogoError(undefined);
    dropIfUnsaved(logoPath);
    setLogoPath(null);
  };

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
    spotlight: form("spotlight"),
    spotlightHint: form("spotlightHint"),
    tagline: form("tagline"),
    taglineHint: form("taglineHint"),
    establishedYear: form("establishedYear"),
    projectsDelivered: form("projectsDelivered"),
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
        tagline: values.tagline,
        establishedYear: values.establishedYear,
        projectsDelivered: values.projectsDelivered,
        logoPath: logoPath ?? "",
      });
      if (!result.ok) {
        if (!showFieldErrors(result)) {
          notify.error(failureText(everything, result));
          router.refresh();
        }
        return;
      }
      setErrors({});
      // The saved logo is now the one on record: the one it replaced is no longer used by anything.
      if (profile.logoPath && profile.logoPath !== logoPath)
        void storage.remove([profile.logoPath]);
      unsaved.current.clear();
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
            <BuilderLogoField
              initials={initialsOf(values.name.trim() || profile.name)}
              src={
                logoPath
                  ? publicStorageUrl(
                      publicEnv.NEXT_PUBLIC_SUPABASE_URL,
                      BUILDER_LOGO_BUCKET,
                      logoPath,
                    )
                  : null
              }
              state={uploading ? "uploading" : "idle"}
              error={logoError}
              disabled={sending}
              words={{
                title: translate("logo.title"),
                hint: translate("logo.hint"),
                choose: translate("logo.choose"),
                replace: translate("logo.replace"),
                remove: translate("logo.remove"),
                uploading: translate("logo.uploading"),
                alt: translate("logo.alt"),
              }}
              onFile={(file) => void chooseLogo(file)}
              onRemove={removeLogo}
            />
            <BuilderForm
              mode="edit"
              showKind={false}
              showLogoUrl={false}
              values={values}
              errors={errors}
              onChange={change}
              disabled={sending}
              words={words}
            />
            <div className="flex flex-wrap items-center gap-4">
              <Button type="submit" variant="primary" loading={sending} disabled={uploading}>
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

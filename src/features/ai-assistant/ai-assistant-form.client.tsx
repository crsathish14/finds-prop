"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ProjectSaveBar } from "@/components/domain/project-save-bar";
import { Alert } from "@/components/patterns/alert";
import { FormField } from "@/components/patterns/form-field";
import { StatTile } from "@/components/patterns/stat-tile";
import { Heading } from "@/components/ui/heading";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { failureText, fieldErrorText, type Translator } from "@/i18n/failure-text";
import { formatUsd } from "@/lib/format";
import { notify } from "@/lib/notify";
import type { ActionResult } from "@/types/action";
import { estimateCreditLeftUsd } from "./estimate";
import { CREDIT_BOUGHT_MAX_USD } from "./schemas";

export type AiAssistantFormValues = {
  webSearch: boolean;
  /** The credit bought as typed: US dollars as text, empty when none is set. */
  creditBoughtUsd: string;
};

export type AiAssistantFormProps = {
  /** Where the form starts: what is saved now. */
  initial: AiAssistantFormValues;
  /** This month's estimated spend in US dollars, from our own records. */
  spendUsd: number;
  locale: string;
  save: (input: Record<string, unknown>) => Promise<ActionResult<unknown>>;
};

type Problems = Record<string, string>;
const NO_PROBLEMS: Problems = {};

/** The typed credit as dollars, or null when the box is empty or not a plain amount (the server says why on save). */
function typedCredit(typed: string): number | null {
  const plain = typed.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(plain)) return null;
  const dollars = Number(plain);
  return dollars <= CREDIT_BOUGHT_MAX_USD ? dollars : null;
}

/**
 * The super admin's AI assistant page (ADR-218, piece 7, the approved layout): the Web search switch, the estimated
 * spend this month, the credit bought and the estimated credit left, the note that these are estimates, and one Save.
 * The credit left follows what is typed. The server checks the values; a problem shows on its box, and Discard puts
 * back what was loaded.
 */
export function AiAssistantForm({ initial, spendUsd, locale, save }: AiAssistantFormProps) {
  const translate = useTranslations("admin.aiAssistant");
  const shared = useTranslations("admin.siteContent");
  const everything = useTranslations() as unknown as Translator;
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<AiAssistantFormValues>(initial);
  const [problems, setProblems] = useState<Problems>(NO_PROBLEMS);
  const alertAt = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (Object.keys(problems).length > 0) alertAt.current?.scrollIntoView?.({ block: "start" });
  }, [problems]);

  // As the Site content pages save: a problem pinned to a box shows on it, any other failure is a toast, and the page
  // is read again so it shows what is really saved.
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const result = await save({ ...values });
      if (result.ok) {
        notify.success(translate("saved.title"), { description: translate("saved.text") });
        setProblems(NO_PROBLEMS);
        router.refresh();
        return;
      }
      const found: Problems = {};
      for (const [path, list] of Object.entries(result.fieldErrors ?? {})) {
        const first = list[0];
        if (first && found[path] === undefined) found[path] = fieldErrorText(everything, first);
      }
      if (Object.keys(found).length > 0) {
        setProblems(found);
        return;
      }
      notify.error(failureText(everything, result));
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const count = Object.keys(problems).length;
  const left = estimateCreditLeftUsd(typedCredit(values.creditBoughtUsd), spendUsd);

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <Heading as="h1" size="2">
        {translate("title")}
      </Heading>

      {count > 0 ? (
        <div ref={alertAt} tabIndex={-1}>
          <Alert tone="danger" title={shared("problems.title", { count })}>
            {shared("problems.text")}
          </Alert>
        </div>
      ) : null}

      <div className="flex max-w-3xl flex-col gap-6">
        <div className="flex items-start justify-between gap-4 rounded-xl border border-line bg-surface px-5 py-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="ai-web-search">{translate("webSearch.label")}</Label>
            <p id="ai-web-search-hint" className="text-small text-muted">
              {translate("webSearch.hint")}
            </p>
          </div>
          <Switch
            id="ai-web-search"
            aria-describedby="ai-web-search-hint"
            checked={values.webSearch}
            disabled={saving}
            onCheckedChange={(webSearch) => setValues({ ...values, webSearch })}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <StatTile label={translate("spend")} value={formatUsd(locale, spendUsd)} />
          <FormField
            label={translate("credit")}
            optionalLabel={shared("optional")}
            {...(problems["creditBoughtUsd"] ? { error: problems["creditBoughtUsd"] } : {})}
          >
            <Input
              name="creditBoughtUsd"
              value={values.creditBoughtUsd}
              disabled={saving}
              inputMode="decimal"
              autoComplete="off"
              onChange={(event) => setValues({ ...values, creditBoughtUsd: event.target.value })}
            />
          </FormField>
          <StatTile
            label={translate("creditLeft")}
            value={left === null ? "–" : formatUsd(locale, left)}
          />
        </div>
        <p className="text-small text-muted">{translate("estimateNote")}</p>
      </div>

      <ProjectSaveBar
        note={translate("saveNote")}
        words={{
          cancel: shared("save.cancel"),
          save: shared("save.save"),
          saving: shared("save.saving"),
        }}
        saving={saving}
        onCancel={() => {
          setValues(initial);
          setProblems(NO_PROBLEMS);
        }}
      />
    </form>
  );
}

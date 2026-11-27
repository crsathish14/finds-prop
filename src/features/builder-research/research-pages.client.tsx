"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/patterns/alert";
import { FormField } from "@/components/patterns/form-field";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Text } from "@/components/ui/text";
import { failureText, fieldErrorText, type Translator } from "@/i18n/failure-text";
import { formatDate } from "@/lib/format";
import { notify } from "@/lib/notify";
import type { ActionResult } from "@/types/action";
import type { ResearchPanelView } from "./panel-service";
import { PROBLEM_KEYS } from "./problems";
import { RESEARCH_LINKS_MAX } from "./schemas";
import { PAGE_TOPICS, type PageTopic } from "./topics";

export type ResearchPagesActions = {
  save: (input: {
    builderId: string;
    links: Array<{ url: string; topic: string }>;
  }) => Promise<ActionResult<{ websiteReadable: boolean | null }>>;
  readAgain: (input: { builderId: string }) => Promise<ActionResult<unknown>>;
};

type Row = { url: string; topic: PageTopic | "" };

const PANEL = "rounded-xl border border-line bg-surface p-6 shadow-card";

const TOPIC_KEYS = {
  about_company: "topics.aboutCompany",
  projects: "topics.projects",
  delivery_record: "topics.deliveryRecord",
  awards_approvals: "topics.awardsApprovals",
  contact: "topics.contact",
  other: "topics.other",
} as const satisfies Readonly<Record<PageTopic, string>>;

function rowsOf(panel: ResearchPanelView): Row[] {
  return Array.from({ length: RESEARCH_LINKS_MAX }, (_, index) => {
    const link = panel.links[index];
    return link === undefined ? { url: "", topic: "" } : { url: link.url, topic: link.topic };
  });
}

/**
 * "Pages for the AI assistant" (AI search Phase 4, wording approved by the owner on 27 Nov 2026): up to three pages of
 * the builder's own website, each with what it is about, that the assistant may read to answer buyers' questions. The
 * same panel is on the builder's profile and on the admin's page for one builder; each gives its own actions. A page
 * that cannot be read is not saved and the reason is said under its box; a page that later could not be read says so
 * with the date. "Read again" forgets the saved copies, so the assistant reads the pages fresh next time.
 */
export function ResearchPagesPanel({
  panel,
  actions,
}: {
  panel: ResearchPanelView;
  actions: ResearchPagesActions;
}) {
  const translate = useTranslations("builderResearch");
  const everything = useTranslations() as unknown as Translator;
  const locale = useLocale();
  const router = useRouter();

  const [rows, setRows] = useState<Row[]>(() => rowsOf(panel));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | undefined>(undefined);
  const [websiteUnreadable, setWebsiteUnreadable] = useState(false);
  const [sending, setSending] = useState<"save" | "again" | null>(null);

  const reason = (problem: keyof typeof PROBLEM_KEYS) =>
    everything(`builderResearch.problem.${PROBLEM_KEYS[problem]}`, { site: panel.site ?? "" });

  const change = (index: number, patch: Partial<Row>) => {
    setRows((previous) =>
      previous.map((row, place) => (place === index ? { ...row, ...patch } : row)),
    );
    setErrors((previous) =>
      Object.fromEntries(
        Object.entries(previous).filter(([field]) => !field.startsWith(`links.${index}.`)),
      ),
    );
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (sending) return;
    setSending("save");
    setFormError(undefined);
    try {
      const result = await actions.save({
        builderId: panel.builderId,
        links: rows.map((row) => ({ url: row.url, topic: row.topic })),
      });
      if (!result.ok) {
        const next: Record<string, string> = {};
        let form: string | undefined;
        for (const [field, problems] of Object.entries(result.fieldErrors ?? {})) {
          const first = problems[0];
          if (first === undefined) continue;
          if (field.startsWith("links.")) next[field] = fieldErrorText(everything, first);
          else form = fieldErrorText(everything, first);
        }
        setErrors(next);
        setFormError(form);
        if (Object.keys(next).length === 0 && form === undefined) {
          notify.error(failureText(everything, result));
        }
        return;
      }
      setErrors({});
      setWebsiteUnreadable(result.data.websiteReadable === false);
      notify.success(translate("toast.saved"));
      router.refresh();
    } finally {
      setSending(null);
    }
  };

  const readAgain = async () => {
    if (sending) return;
    setSending("again");
    try {
      const result = await actions.readAgain({ builderId: panel.builderId });
      if (!result.ok) {
        notify.error(failureText(everything, result));
        return;
      }
      notify.success(translate("toast.readAgain"));
      router.refresh();
    } finally {
      setSending(null);
    }
  };

  const laterProblem = (url: string) => panel.problems.find((problem) => problem.url === url);

  return (
    <section aria-labelledby="research-pages" className={PANEL}>
      <Heading as="h2" size="3" id="research-pages" className="mb-2">
        {translate("title")}
      </Heading>
      <Text tone="muted" className="mb-4">
        {translate("hint")}
      </Text>

      {panel.website === null ? (
        <Alert tone="info" className="mb-4">
          {translate("noWebsite")}
        </Alert>
      ) : null}
      {panel.website !== null && (websiteUnreadable || panel.websiteProblem !== null) ? (
        <Alert tone="warning" className="mb-4">
          {translate("websiteWarning")}
        </Alert>
      ) : null}

      <form noValidate onSubmit={save} className="flex flex-col gap-5">
        {rows.map((row, index) => {
          const later = row.url === "" ? undefined : laterProblem(row.url);
          const saved = panel.links[index]?.url === row.url && row.url !== "";
          return (
            <fieldset key={index} className="grid min-w-0 gap-3 md:grid-cols-[2fr_1fr]">
              <legend className="sr-only">{translate("link", { number: index + 1 })}</legend>
              <FormField
                label={translate("link", { number: index + 1 })}
                {...(errors[`links.${index}.url`] === undefined
                  ? {}
                  : { error: errors[`links.${index}.url`] })}
                {...(saved && later === undefined && errors[`links.${index}.url`] === undefined
                  ? { hint: translate("readable") }
                  : {})}
              >
                <Input
                  type="url"
                  inputMode="url"
                  autoComplete="url"
                  value={row.url}
                  disabled={sending !== null || panel.website === null}
                  onChange={(event) => change(index, { url: event.target.value })}
                />
              </FormField>
              <FormField
                label={translate("topic")}
                {...(errors[`links.${index}.topic`] === undefined
                  ? {}
                  : { error: errors[`links.${index}.topic`] })}
              >
                <Select
                  value={row.topic}
                  disabled={sending !== null || panel.website === null}
                  onChange={(event) => change(index, { topic: event.target.value as PageTopic })}
                >
                  <option value="">{translate("topicPlaceholder")}</option>
                  {PAGE_TOPICS.map((topic) => (
                    <option key={topic} value={topic}>
                      {translate(TOPIC_KEYS[topic])}
                    </option>
                  ))}
                </Select>
              </FormField>
              {saved && later !== undefined ? (
                <Alert tone="warning" className="md:col-span-2">
                  {translate("later", {
                    date: formatDate(locale, later.at),
                    reason: reason(later.problem),
                  })}
                </Alert>
              ) : null}
            </fieldset>
          );
        })}

        {formError === undefined ? null : <Alert tone="danger">{formError}</Alert>}

        <Text variant="small" tone="muted">
          {translate("terms")}
        </Text>

        <div className="flex flex-wrap items-center gap-4">
          <Button
            type="submit"
            variant="primary"
            loading={sending === "save"}
            disabled={panel.website === null || sending !== null}
          >
            {translate(sending === "save" ? "saving" : "save")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            loading={sending === "again"}
            disabled={panel.website === null || sending !== null}
            onClick={() => void readAgain()}
          >
            {translate("readAgain")}
          </Button>
          <Text variant="small" tone="muted">
            {translate("readAgainHint")}
          </Text>
        </div>
      </form>
    </section>
  );
}

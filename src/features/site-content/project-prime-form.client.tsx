"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { ProjectSaveBar } from "@/components/domain/project-save-bar";
import { Alert } from "@/components/patterns/alert";
import { FormField } from "@/components/patterns/form-field";
import { Heading } from "@/components/ui/heading";
import { Input } from "@/components/ui/input";
import { PROJECT_PRIME_RULES, type ProjectPrimeRule } from "@/lib/project-prime";
import type { Problems } from "./form";
import {
  useSaveFlow,
  useScrollToProblems,
  useSiteContentFrame,
  type SaveContent,
} from "./save-flow.client";

/** The four amounts as typed: whole rupees as text, empty where no amount is set. */
export type ProjectPrimeFormValues = Record<ProjectPrimeRule, string>;

export type ProjectPrimeFormProps = {
  /** Where the boxes start: the amounts in use today, empty where none is set. */
  initial: ProjectPrimeFormValues;
  /** The save action. */
  save: SaveContent;
};

const NO_PROBLEMS: Problems = {};

/** The words of each box, written out so the message check finds every key. */
const BOX_WORDS = {
  ratePerSqft: { label: "fields.ratePerSqft.label", hint: "fields.ratePerSqft.hint" },
  totalPrice: { label: "fields.totalPrice.label", hint: "fields.totalPrice.hint" },
  rentPerMonth: { label: "fields.rentPerMonth.label", hint: "fields.rentPerMonth.hint" },
  rentPerSqftMonth: {
    label: "fields.rentPerSqftMonth.label",
    hint: "fields.rentPerSqftMonth.hint",
  },
} as const satisfies Record<ProjectPrimeRule, { label: string; hint: string }>;

/**
 * The super admin's Prime projects page (ADR-208): one amount for each kind of project price. A project is Prime when
 * its price is at or above the amount for its price type, worked out whenever a project is read, so a saved change
 * applies to every project at once. An empty box means no project priced that way is Prime. The boxes keep what is
 * typed; the server checks it, its problems show on their boxes, and Discard puts back what was loaded.
 */
export function ProjectPrimeForm({ initial, save }: ProjectPrimeFormProps) {
  const translate = useTranslations("admin.projectPrime");
  const shared = useTranslations("admin.siteContent");
  const frame = useSiteContentFrame("project_prime");
  const flow = useSaveFlow(save, {
    title: translate("saved.title"),
    text: translate("saved.text"),
  });
  const [values, setValues] = useState<ProjectPrimeFormValues>(initial);
  const [problems, setProblems] = useState<Problems>(NO_PROBLEMS);
  const alertAt = useScrollToProblems(problems);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (flow.saving) return;
    setProblems(await flow.submit({ ...values }));
  };

  const count = Object.keys(problems).length;

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Heading as="h1" size="2">
          {translate("title")}
        </Heading>
        <p className="text-body text-muted">{translate("description")}</p>
      </div>

      {count > 0 ? (
        <div ref={alertAt} tabIndex={-1}>
          <Alert tone="danger" title={shared("problems.title", { count })}>
            {shared("problems.text")}
          </Alert>
        </div>
      ) : null}

      <div className="flex max-w-xl flex-col gap-5">
        {PROJECT_PRIME_RULES.map((rule) => (
          <FormField
            key={rule}
            label={translate(BOX_WORDS[rule].label)}
            optionalLabel={frame.optional}
            hint={translate(BOX_WORDS[rule].hint)}
            {...(problems[rule] ? { error: problems[rule] } : {})}
          >
            <Input
              name={rule}
              value={values[rule]}
              disabled={flow.saving}
              inputMode="numeric"
              autoComplete="off"
              onChange={(event) => setValues({ ...values, [rule]: event.target.value })}
            />
          </FormField>
        ))}
      </div>

      <ProjectSaveBar
        note={frame.saveNote}
        words={frame.saveWords}
        saving={flow.saving}
        onCancel={() => {
          setValues(initial);
          setProblems(NO_PROBLEMS);
        }}
      />
    </form>
  );
}

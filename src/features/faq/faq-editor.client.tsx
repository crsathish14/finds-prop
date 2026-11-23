"use client";

import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  FaqFormFields,
  type FaqFormErrors,
  type FaqFormValues,
  type FaqFormWords,
} from "@/components/domain/faq-form-fields";
import { ProjectSaveBar } from "@/components/domain/project-save-bar";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/components/ui/link";
import { failureText, fieldErrorText, type Translator } from "@/i18n/failure-text";
import { notify } from "@/lib/notify";
import type { ActionResult } from "@/types/action";
import { FAQ_ANSWER_MAX, FAQ_QUESTION_MAX } from "./constants";
import type { FaqDone } from "./faq-service";
import { ADMIN_FAQ_PATH } from "./page-params";
import type { FaqAdminView } from "./view";

export type FaqEditorActions = {
  create: (input: FaqFormValues) => Promise<ActionResult<FaqDone>>;
  update: (input: FaqFormValues & { faqId: string }) => Promise<ActionResult<FaqDone>>;
};

type FaqEditorProps = {
  /** The question being edited, or null for a new one. */
  faq: FaqAdminView | null;
  /** The categories of the FAQ list to choose from (hidden ones are offered too, marked as hidden). */
  categories: { value: string; label: string }[];
  /** The category to start a new question in, when the list was narrowed to one. */
  initialCategory?: string;
  actions: FaqEditorActions;
};

function isField(field: string): field is keyof FaqFormErrors {
  return field === "categoryId" || field === "question" || field === "answer";
}

/**
 * The admin's question page (ADR-143, FR-ADM-13): the boxes (FaqFormFields) above the save bar the project form uses,
 * for a new question or one being edited. The values stay typed when a save fails, each problem sits on its box, and a
 * failure with no box to blame is a toast. Saving goes back to the list, which is read again.
 */
export function FaqEditor({ faq, categories, initialCategory = "", actions }: FaqEditorProps) {
  const translate = useTranslations("admin.faq");
  const everything = useTranslations() as unknown as Translator;
  const router = useRouter();

  const [values, setValues] = useState<FaqFormValues>({
    categoryId: faq?.categoryId ?? initialCategory,
    question: faq?.question ?? "",
    answer: faq?.answer ?? "",
    status: faq?.status ?? "draft",
  });
  const [errors, setErrors] = useState<FaqFormErrors>({});
  const [saving, setSaving] = useState(false);

  const words: FaqFormWords = {
    content: {
      title: translate("form.content.title"),
      description: translate("form.content.text"),
    },
    publishing: {
      title: translate("form.publishing.title"),
      description: translate("form.publishing.text"),
    },
    category: translate("form.category"),
    categoryPlaceholder: translate("form.categoryPlaceholder"),
    noCategory: translate("form.noCategory"),
    question: translate("form.question"),
    questionHint: translate("form.questionHint"),
    answer: translate("form.answer"),
    answerHint: translate("form.answerHint"),
    answerCounter: (count, max) => translate("form.answerCounter", { count, max }),
    status: translate("form.status"),
    statusDraft: translate("form.statusDraft"),
    statusPublished: translate("form.statusPublished"),
    statusHint: translate("form.statusHint"),
  };

  const change = (next: FaqFormValues) => {
    setValues(next);
    setErrors({});
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const result = faq
        ? await actions.update({ ...values, faqId: faq.id })
        : await actions.create(values);
      if (!result.ok) {
        const next: FaqFormErrors = {};
        for (const [field, problems] of Object.entries(result.fieldErrors ?? {})) {
          const first = problems[0];
          if (first && isField(field)) next[field] = fieldErrorText(everything, first);
        }
        if (Object.keys(next).length > 0) {
          setErrors(next);
        } else {
          notify.error(
            result.code === "NOT_FOUND" ? translate("gone") : failureText(everything, result),
          );
        }
        return;
      }
      notify.success(translate(faq ? "toast.saved" : "toast.created"));
      router.push(ADMIN_FAQ_PATH);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href={ADMIN_FAQ_PATH}
          variant="nav"
          className="inline-flex items-center gap-2 text-small"
        >
          <Icon icon={ArrowLeft} size="sm" />
          {translate("back")}
        </Link>
        <Heading as="h1" size="1">
          {translate(faq ? "editTitle" : "newTitle")}
        </Heading>
      </div>
      <form
        noValidate
        onSubmit={(event) => void submit(event)}
        className="flex max-w-3xl flex-col gap-6"
      >
        <FaqFormFields
          values={values}
          errors={errors}
          onChange={change}
          categories={categories}
          limits={{ question: FAQ_QUESTION_MAX, answer: FAQ_ANSWER_MAX }}
          disabled={saving}
          words={words}
        />
        <ProjectSaveBar
          note={translate(faq ? "saveNote.edit" : "saveNote.new")}
          words={{
            cancel: translate("form.cancel"),
            save: translate("form.save"),
            saving: translate("form.saving"),
          }}
          saving={saving}
          onCancel={() => router.push(ADMIN_FAQ_PATH)}
          className="rounded-xl border"
        />
      </form>
    </div>
  );
}

"use client";

/**
 * DynamicForm: draws any form the form builder stores, field by field (S5-T05, FR-ADM-08, BR-60).
 * Purpose: the contact page's form now, and a project's own form later. Owner: design system. It is the
 *   screen only: it holds what the visitor has typed and hands the values over; it sends nothing (the
 *   page connects it to the form action, which checks everything again on the server).
 * Props: fields (the stored list: { label, key, type, placeholder, options, min, max, required }),
 *   buttonText (the form's own button words; the default when left out), values (what to start with, by
 *   key), errors (by field key: already-translated messages; a field with one is marked invalid), failed
 *   (draws the "could not send" alert above the fields; what was typed stays), rateLimited (draws the
 *   "limit reached" alert), submitting (the button shows it is working and ignores clicks), consent (the
 *   consent line under the button, already built by the page), onSubmit (called with the values by key),
 *   className.
 * Responsive: one column on a phone; two from 768 px, with the long answers (a message, a group of
 *   choices) across both. The button is as wide as the form.
 * Accessibility: each field has a label and an error tied to it (aria-describedby, aria-invalid, with an
 *   icon, so colour is not the only signal); required fields are marked; a group of radio buttons or
 *   checkboxes is a fieldset with a legend. When errors appear after the form is shown, focus moves to the
 *   first field with one. The alerts say what happened in words.
 * Field types: text, number, email, dropdown, radio, checkbox (a group when it has options, one box when
 *   it has none), textarea, date. A file field draws nothing yet: the upload step comes in its own change
 *   (ADR-054), and the server takes no answer for one in the meantime.
 * States: default, filled, errors, send failed, limit reached, sending. Dependencies: FormField, Input,
 *   Textarea, NativeSelect, Checkbox, RadioGroup, Label, Alert, Button, Icon, next-intl, cn.
 * Tests: dynamic-form.test.tsx; Design Lab "Discovery" (S5-T05).
 * UX reference: contact screen (form-grid two, field, label, select, textarea).
 */
import { CircleAlert, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ComponentProps,
  type ReactNode,
} from "react";
import { Alert } from "@/components/patterns/alert";
import { FormField } from "@/components/patterns/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";

/** What FormField takes as its one control. */
type ControlElement = ComponentProps<typeof FormField>["children"];

type DynamicFormField = {
  label: string;
  key: string;
  type:
    "text" | "number" | "email" | "dropdown" | "radio" | "checkbox" | "textarea" | "date" | "file";
  placeholder?: string | undefined;
  options?: string[] | undefined;
  min?: number | undefined;
  max?: number | undefined;
  required: boolean;
};

/** One answer: text (a number is typed as text too), a single checkbox, or the ticked choices of a group. */
type DynamicFormValue = string | boolean | string[];
type DynamicFormValues = Record<string, DynamicFormValue>;
type DynamicFormErrors = Record<string, string>;

type DynamicFormProps = {
  fields: readonly DynamicFormField[];
  buttonText?: string | null | undefined;
  values?: Partial<DynamicFormValues>;
  errors?: DynamicFormErrors;
  failed?: boolean;
  rateLimited?: boolean;
  submitting?: boolean;
  consent?: ReactNode;
  onSubmit?: (values: DynamicFormValues) => void;
  className?: string;
};

/** The answers a form starts with: the values it was given, else nothing chosen. */
function startingValues(
  fields: readonly DynamicFormField[],
  given: Partial<DynamicFormValues> | undefined,
): DynamicFormValues {
  const start: DynamicFormValues = {};
  for (const field of fields) {
    const known = given?.[field.key];
    if (known !== undefined) start[field.key] = known;
    else if (field.type === "checkbox") start[field.key] = field.options ? [] : false;
    else start[field.key] = "";
  }
  return start;
}

const isGroup = (field: DynamicFormField) =>
  field.type === "radio" || (field.type === "checkbox" && field.options !== undefined);

/** A field with a long answer, or several choices, takes the whole row on a wide screen. */
const isWide = (field: DynamicFormField) => field.type === "textarea" || isGroup(field);

const asText = (value: DynamicFormValue | undefined) => (typeof value === "string" ? value : "");
const asList = (value: DynamicFormValue | undefined) => (Array.isArray(value) ? value : []);

/** The browser hints for a text field, from the key the form builder gave it. */
function textHints(field: DynamicFormField) {
  if (field.key === "name") return { autoComplete: "name" } as const;
  if (field.key === "mobile" || field.key === "phone") {
    return { type: "tel", inputMode: "tel", autoComplete: "tel" } as const;
  }
  return {};
}

function DynamicForm({
  fields,
  buttonText,
  values,
  errors,
  failed = false,
  rateLimited = false,
  submitting = false,
  consent,
  onSubmit,
  className,
}: DynamicFormProps) {
  const translate = useTranslations("domain.dynamicForm");
  const [typed, setTyped] = useState<DynamicFormValues>(() => startingValues(fields, values));
  const form = useRef<HTMLFormElement>(null);
  const shown = useRef(false);
  const base = useId();

  // Errors that arrive after the form is shown take the reader to the first field with one. Errors
  // that are there from the start (the Design Lab shows them) do not steal focus.
  useEffect(() => {
    if (!shown.current) {
      shown.current = true;
      return;
    }
    const first = fields.find((field) => errors?.[field.key]);
    if (!first) return;
    form.current?.querySelectorAll<HTMLElement>("[data-field]").forEach((holder) => {
      if (holder.dataset["field"] !== first.key) return;
      holder.querySelector<HTMLElement>("input, select, textarea, button")?.focus();
    });
  }, [errors, fields]);

  function change(key: string, value: DynamicFormValue) {
    setTyped((current) => ({ ...current, [key]: value }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    onSubmit?.(typed);
  }

  const optional = translate("optional");

  function errorProp(field: DynamicFormField): { error?: string } {
    const message = errors?.[field.key];
    return message ? { error: message } : {};
  }

  function idOf(field: DynamicFormField) {
    return base + "-" + field.key;
  }

  function control(field: DynamicFormField): ControlElement {
    const text = asText(typed[field.key]);
    if (field.type === "textarea") {
      return (
        <Textarea
          name={field.key}
          placeholder={field.placeholder}
          value={text}
          onChange={(event) => change(field.key, event.target.value)}
          {...(field.max !== undefined
            ? {
                maxLength: field.max,
                counter: translate("counter", { count: text.length, max: field.max }),
              }
            : {})}
        />
      );
    }
    if (field.type === "dropdown") {
      return (
        <NativeSelect
          name={field.key}
          value={text}
          onChange={(event) => change(field.key, event.target.value)}
        >
          <option value="">{translate("choose")}</option>
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </NativeSelect>
      );
    }
    if (field.type === "number") {
      return (
        <Input
          name={field.key}
          type="number"
          inputMode="decimal"
          step="any"
          placeholder={field.placeholder}
          value={text}
          onChange={(event) => change(field.key, event.target.value)}
          {...(field.min !== undefined ? { min: field.min } : {})}
          {...(field.max !== undefined ? { max: field.max } : {})}
        />
      );
    }
    if (field.type === "date") {
      return (
        <Input
          name={field.key}
          type="date"
          value={text}
          onChange={(event) => change(field.key, event.target.value)}
        />
      );
    }
    if (field.type === "email") {
      return (
        <Input
          name={field.key}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder={field.placeholder}
          value={text}
          onChange={(event) => change(field.key, event.target.value)}
        />
      );
    }
    return (
      <Input
        name={field.key}
        placeholder={field.placeholder}
        value={text}
        onChange={(event) => change(field.key, event.target.value)}
        {...(field.max !== undefined ? { maxLength: field.max } : {})}
        {...textHints(field)}
      />
    );
  }

  function group(field: DynamicFormField): ReactNode {
    const errorId = idOf(field) + "-error";
    const message = errors?.[field.key];
    const choices = field.options ?? [];
    const ticked = asList(typed[field.key]);
    return (
      <fieldset
        aria-describedby={message ? errorId : undefined}
        className="flex min-w-0 flex-col gap-3"
      >
        <legend className="mb-2 text-small font-semibold text-ink">
          {field.label}
          {field.required ? (
            <span aria-hidden="true" className="ml-1 text-danger">
              *
            </span>
          ) : (
            <span className="ml-1 font-normal text-muted">{optional}</span>
          )}
        </legend>
        {field.type === "radio" ? (
          <RadioGroup
            name={field.key}
            required={field.required}
            aria-invalid={message ? true : undefined}
            value={asText(typed[field.key])}
            onValueChange={(value) => change(field.key, value)}
          >
            {choices.map((choice, index) => {
              const id = idOf(field) + "-" + index;
              return (
                <div key={choice} className="flex items-center gap-3">
                  <RadioGroupItem id={id} value={choice} />
                  <Label htmlFor={id} className="font-normal">
                    {choice}
                  </Label>
                </div>
              );
            })}
          </RadioGroup>
        ) : (
          <div className="grid gap-3">
            {choices.map((choice, index) => {
              const id = idOf(field) + "-" + index;
              return (
                <div key={choice} className="flex items-center gap-3">
                  <Checkbox
                    id={id}
                    name={field.key}
                    value={choice}
                    aria-invalid={message ? true : undefined}
                    checked={ticked.includes(choice)}
                    onCheckedChange={(checked) =>
                      change(
                        field.key,
                        checked === true
                          ? [...ticked, choice]
                          : ticked.filter((other) => other !== choice),
                      )
                    }
                  />
                  <Label htmlFor={id} className="font-normal">
                    {choice}
                  </Label>
                </div>
              );
            })}
          </div>
        )}
        {message ? (
          <p id={errorId} className="flex items-start gap-2 text-caption font-semibold text-danger">
            <Icon icon={CircleAlert} size="sm" className="mt-px" />
            {message}
          </p>
        ) : null}
      </fieldset>
    );
  }

  /** A single checkbox: its label sits beside the box. */
  function tick(field: DynamicFormField): ReactNode {
    const id = idOf(field);
    const errorId = id + "-error";
    const message = errors?.[field.key];
    return (
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex items-center gap-3">
          <Checkbox
            id={id}
            name={field.key}
            required={field.required}
            aria-invalid={message ? true : undefined}
            aria-describedby={message ? errorId : undefined}
            checked={typed[field.key] === true}
            onCheckedChange={(checked) => change(field.key, checked === true)}
          />
          <Label
            htmlFor={id}
            required={field.required}
            optionalLabel={field.required ? undefined : optional}
          >
            {field.label}
          </Label>
        </div>
        {message ? (
          <p id={errorId} className="flex items-start gap-2 text-caption font-semibold text-danger">
            <Icon icon={CircleAlert} size="sm" className="mt-px" />
            {message}
          </p>
        ) : null}
      </div>
    );
  }

  function draw(field: DynamicFormField): ReactNode {
    if (field.type === "file") return null;
    if (isGroup(field)) return group(field);
    if (field.type === "checkbox") return tick(field);
    return (
      <FormField
        label={field.label}
        required={field.required}
        {...(field.required ? {} : { optionalLabel: optional })}
        {...errorProp(field)}
      >
        {control(field)}
      </FormField>
    );
  }

  return (
    <form
      ref={form}
      data-slot="dynamic-form"
      noValidate
      onSubmit={submit}
      className={cn("grid gap-4 md:grid-cols-2", className)}
    >
      {rateLimited ? (
        <Alert tone="warning" title={translate("rateLimit.title")} className="md:col-span-2">
          {translate("rateLimit.body")}
        </Alert>
      ) : null}
      {failed ? (
        <Alert tone="danger" title={translate("failed.title")} className="md:col-span-2">
          {translate("failed.body")}
        </Alert>
      ) : null}
      {fields.map((field) => {
        const drawn = draw(field);
        if (drawn === null) return null;
        return (
          <div
            key={field.key}
            data-field={field.key}
            className={cn("min-w-0", isWide(field) && "md:col-span-2")}
          >
            {drawn}
          </div>
        );
      })}
      <div className="flex flex-col gap-3 md:col-span-2">
        <Button
          type="submit"
          variant="accent"
          size="lg"
          className="w-full md:w-fit"
          loading={submitting}
          iconStart={<Icon icon={Send} />}
        >
          {buttonText ?? translate("send")}
        </Button>
        {consent ? <p className="text-caption text-muted">{consent}</p> : null}
      </div>
    </form>
  );
}

export { DynamicForm };
export type {
  DynamicFormErrors,
  DynamicFormField,
  DynamicFormProps,
  DynamicFormValue,
  DynamicFormValues,
};

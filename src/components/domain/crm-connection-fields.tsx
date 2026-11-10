/**
 * CrmConnectionFields and CrmCredentialField: the Connection box and the Credentials boxes of the CRM editor.
 * Purpose: what the admin sets about one CRM connection (S7-T09, FR-ADM-09, BR-64, BR-65): its name, lead source, base
 *   URL, endpoint, HTTP method, the path of the lead id in the CRM's answer, and whether it is active; and each secret
 *   (API key, API secret, access token) without ever showing it. Owner: design system. They hold no state: the page
 *   keeps the values, the errors and the secrets' modes, and passes the words, already translated. The sections' own
 *   frames (FormSection), the rows editor (CrmRowsEditor) and the save bar (ProjectSaveBar) are separate parts.
 * Props: CrmConnectionFields: values ({ name, leadSource, baseUrl, endpoint, method, leadIdPath, active }, all text but
 *   active), errors (the message of each box with a problem, by box), onChange (box, value), methods ({ value, label }[]),
 *   disabled (while saving), words (the labels, the hint under the base URL, "Active"), className. CrmCredentialField:
 *   label, stored (a secret is saved), mode ("keep" | "replace" | "clear"), value (what is typed while replacing, or
 *   when nothing is saved), onModeChange, onValueChange, error, disabled, words ({ replace, clear, undo, cancel,
 *   notSet (the placeholder of a box with nothing saved), willClear (the line shown after Clear) }).
 * Responsive: one column on a phone; two from 768 px for the Connection box; the credential row wraps its buttons under
 *   the box on a phone. The Active switch line is a 52 px target.
 * Accessibility: every box has a visible label tied to it; required boxes are marked; an error shows an icon and words;
 *   a saved secret is a read-only box of dots with Replace and Clear buttons that name the secret; the words say what
 *   Clear does before saving; a secret that is typed is a password box that does not autofill.
 * States: empty, filled, with errors (an address that is not allowed), saving (all off); a secret that is not saved,
 *   saved and kept, being replaced, and to be cleared.
 * Dependencies: FormField, Input, NativeSelect, Switch, Button, Icon, cn. Tests: crm-parts.test.tsx; Design Lab "CRM"
 *   (S7-T09).
 * UX reference: admin-crm screen, the editor (form-grid two, field, switch, cred, masked).
 */
import { CircleAlert, Undo2 } from "lucide-react";
import { useId } from "react";
import { FormField } from "@/components/patterns/form-field";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { cn } from "@/lib/cn";

type CrmConnectionBox =
  "name" | "leadSource" | "baseUrl" | "endpoint" | "method" | "leadIdPath" | "active";

type CrmConnectionValues = {
  name: string;
  leadSource: string;
  baseUrl: string;
  endpoint: string;
  method: string;
  leadIdPath: string;
  active: boolean;
};

type CrmConnectionWords = {
  name: string;
  leadSource: string;
  baseUrl: string;
  /** Under the base URL while it has no error. */
  baseUrlHint: string;
  endpoint: string;
  method: string;
  leadIdPath: string;
  status: string;
  active: string;
};

type CrmConnectionFieldsProps = {
  values: CrmConnectionValues;
  errors?: Partial<Record<CrmConnectionBox, string>>;
  onChange: (box: CrmConnectionBox, value: string | boolean) => void;
  methods: { value: string; label: string }[];
  disabled?: boolean;
  words: CrmConnectionWords;
  className?: string;
};

function CrmConnectionFields({
  values,
  errors = {},
  onChange,
  methods,
  disabled = false,
  words,
  className,
}: CrmConnectionFieldsProps) {
  const text = (box: Exclude<CrmConnectionBox, "active">) => ({
    value: values[box],
    disabled,
    onChange: (event: { target: { value: string } }) => onChange(box, event.target.value),
  });
  return (
    <div data-slot="crm-connection-fields" className={cn("grid gap-5 md:grid-cols-2", className)}>
      <FormField label={words.name} required {...(errors.name ? { error: errors.name } : {})}>
        <Input {...text("name")} maxLength={120} autoComplete="off" />
      </FormField>
      <FormField
        label={words.leadSource}
        {...(errors.leadSource ? { error: errors.leadSource } : {})}
      >
        <Input {...text("leadSource")} maxLength={80} autoComplete="off" />
      </FormField>
      <FormField
        className="md:col-span-2"
        label={words.baseUrl}
        required
        {...(errors.baseUrl ? { error: errors.baseUrl } : { hint: words.baseUrlHint })}
      >
        <Input
          {...text("baseUrl")}
          type="url"
          inputMode="url"
          maxLength={300}
          autoComplete="off"
          spellCheck={false}
        />
      </FormField>
      <FormField label={words.endpoint} {...(errors.endpoint ? { error: errors.endpoint } : {})}>
        <Input {...text("endpoint")} maxLength={300} autoComplete="off" spellCheck={false} />
      </FormField>
      <FormField label={words.method} {...(errors.method ? { error: errors.method } : {})}>
        <NativeSelect {...text("method")}>
          {methods.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </NativeSelect>
      </FormField>
      <FormField
        label={words.leadIdPath}
        {...(errors.leadIdPath ? { error: errors.leadIdPath } : {})}
      >
        <Input {...text("leadIdPath")} maxLength={120} autoComplete="off" spellCheck={false} />
      </FormField>
      <div className="flex flex-col gap-2">
        <span className="text-small font-semibold text-ink">{words.status}</span>
        <label className="flex min-h-13 items-center gap-3 text-ink">
          <Switch
            checked={values.active}
            onCheckedChange={(checked) => onChange("active", checked)}
            disabled={disabled}
          />
          {words.active}
        </label>
      </div>
    </div>
  );
}

type CrmCredentialMode = "keep" | "replace" | "clear";

type CrmCredentialFieldProps = {
  label: string;
  stored: boolean;
  mode: CrmCredentialMode;
  value: string;
  onModeChange: (mode: CrmCredentialMode) => void;
  onValueChange: (value: string) => void;
  error?: string | undefined;
  disabled?: boolean;
  words: {
    replace: string;
    clear: string;
    undo: string;
    cancel: string;
    notSet: string;
    willClear: string;
  };
  className?: string;
};

/** What a saved secret looks like: dots, the same length whatever the secret is. */
const MASK = "••••••••••••••••";

function CrmCredentialField({
  label,
  stored,
  mode,
  value,
  onModeChange,
  onValueChange,
  error,
  disabled = false,
  words,
  className,
}: CrmCredentialFieldProps) {
  const controlId = useId();
  const errorId = error ? `${controlId}-error` : undefined;
  const typed = !stored || mode === "replace";
  const shared = {
    id: controlId,
    "aria-describedby": errorId,
    invalid: error ? true : undefined,
    disabled,
    className: "min-w-0 flex-1",
  };
  return (
    <div data-slot="crm-credential-field" className={cn("flex min-w-0 flex-col gap-2", className)}>
      <Label htmlFor={controlId}>{label}</Label>
      <div className="flex flex-wrap items-center gap-2">
        {typed ? (
          <>
            <Input
              {...shared}
              type="password"
              value={value}
              placeholder={stored ? "" : words.notSet}
              maxLength={2000}
              autoComplete="new-password"
              spellCheck={false}
              onChange={(event) => onValueChange(event.target.value)}
            />
            {stored ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={disabled}
                onClick={() => onModeChange("keep")}
              >
                {words.cancel}
              </Button>
            ) : null}
          </>
        ) : mode === "clear" ? (
          <>
            <Input {...shared} readOnly value={words.willClear} />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={disabled}
              iconStart={<Icon icon={Undo2} size="sm" />}
              onClick={() => onModeChange("keep")}
            >
              {words.undo}
            </Button>
          </>
        ) : (
          <>
            <Input {...shared} readOnly value={MASK} />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={disabled}
              onClick={() => onModeChange("replace")}
            >
              {words.replace} <VisuallyHidden>{label}</VisuallyHidden>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-danger"
              disabled={disabled}
              onClick={() => onModeChange("clear")}
            >
              {words.clear} <VisuallyHidden>{label}</VisuallyHidden>
            </Button>
          </>
        )}
      </div>
      {error ? (
        <p id={errorId} className="flex items-start gap-2 text-caption font-semibold text-danger">
          <Icon icon={CircleAlert} size="sm" className="mt-px" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

export { CrmConnectionFields, CrmCredentialField };
export type {
  CrmConnectionBox,
  CrmConnectionFieldsProps,
  CrmConnectionValues,
  CrmConnectionWords,
  CrmCredentialFieldProps,
  CrmCredentialMode,
};

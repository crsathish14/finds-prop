"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  CrmConnectionFields,
  CrmCredentialField,
  type CrmConnectionBox,
  type CrmCredentialMode,
} from "@/components/domain/crm-connection-fields";
import { CrmRowsEditor, type CrmRow } from "@/components/domain/crm-rows-editor";
import { ProjectSaveBar } from "@/components/domain/project-save-bar";
import { Alert } from "@/components/patterns/alert";
import { Breadcrumb } from "@/components/patterns/breadcrumb";
import { FormSection } from "@/components/patterns/form-section";
import { Heading } from "@/components/ui/heading";
import { failureText, fieldErrorText, type Translator } from "@/i18n/failure-text";
import { notify } from "@/lib/notify";
import type { ActionResult } from "@/types/action";
import { CRM_METHODS } from "./constants";
import {
  SECRET_NAMES,
  blankDraft,
  countProblems,
  draftOf,
  duplicateRowProblems,
  nextRowId,
  noProblems,
  without,
  payloadOf,
  problemsOf,
  type CrmDraft,
  type EditorProblems,
  type ListName,
  type SecretName,
} from "./editor-draft";
import type { CrmIntegrationView } from "./view";

type CrmEditorProps = {
  /** The connection being changed, or none for a new one. */
  integration: CrmIntegrationView | null;
  /** The projects the project codes can be given for. */
  projects: { id: string; name: string }[];
  /** Makes a connection (no `integrationId`) or saves changes to one. It answers the id and never a secret. */
  save: (input: Record<string, unknown>) => Promise<ActionResult<{ integrationId: string }>>;
};

/**
 * The admin's CRM connection editor (S7-T09, FR-ADM-09, BR-64, BR-65): the Connection box, the Credentials boxes and
 * the Headers and body lists, with the save bar. It keeps what is typed and what the admin chose to do with each secret
 * (keep, replace or clear: a saved secret is never in the page, only whether it is set), sends it to the save action
 * and puts what the server says is wrong on the boxes it belongs to. A name used twice in a list is caught before
 * sending. After a change to a connection that exists the page is read again and the secrets go back to "kept"; a new
 * connection opens on its own page once it is made.
 */
export function CrmEditor({ integration, projects, save }: CrmEditorProps) {
  const translate = useTranslations("admin.crm.editor");
  const everything = useTranslations() as unknown as Translator;
  const router = useRouter();

  const isNew = integration === null;
  const [draft, setDraft] = useState<CrmDraft>(() =>
    integration ? draftOf(integration) : blankDraft(),
  );
  const [problems, setProblems] = useState<EditorProblems>(noProblems);
  const [saving, setSaving] = useState(false);
  const alertAt = useRef<HTMLDivElement>(null);

  const stored: Record<SecretName, boolean> = {
    apiKey: integration?.hasApiKey ?? false,
    apiSecret: integration?.hasApiSecret ?? false,
    accessToken: integration?.hasAccessToken ?? false,
  };

  const total = countProblems(problems);
  useEffect(() => {
    if (total > 0) alertAt.current?.scrollIntoView?.({ block: "start" });
  }, [problems, total]);

  const changeConnection = (box: CrmConnectionBox, value: string | boolean) => {
    setDraft((previous) => ({
      ...previous,
      connection: { ...previous.connection, [box]: box === "active" ? value === true : value },
    }));
    setProblems((previous) =>
      previous.connection[box] === undefined
        ? previous
        : { ...previous, connection: without(previous.connection, box) },
    );
  };

  const changeSecret = (name: SecretName, change: { mode?: CrmCredentialMode; value?: string }) => {
    setDraft((previous) => {
      const own = previous.secrets[name];
      // Changing what is done with a saved secret starts from nothing typed: Replace is an empty box, Cancel and Clear drop the text.
      const value = change.mode !== undefined && stored[name] ? "" : (change.value ?? own.value);
      return {
        ...previous,
        secrets: { ...previous.secrets, [name]: { mode: change.mode ?? own.mode, value } },
      };
    });
    setProblems((previous) =>
      previous.secrets[name] === undefined
        ? previous
        : { ...previous, secrets: without(previous.secrets, name) },
    );
  };

  const changeRow = (list: ListName, id: string, side: "first" | "second", value: string) => {
    setDraft((previous) => ({
      ...previous,
      [list]: previous[list].map((row) => (row.id === id ? { ...row, [side]: value } : row)),
    }));
    setProblems((previous) => {
      const own = previous[list][id];
      if (own === undefined || own[side] === undefined) return previous;
      return { ...previous, [list]: { ...previous[list], [id]: without(own, side) } };
    });
  };

  const addRow = (list: ListName) =>
    setDraft((previous) => ({
      ...previous,
      [list]: [...previous[list], { id: nextRowId(list, previous[list]), first: "", second: "" }],
    }));

  const removeRow = (list: ListName, id: string) => {
    setDraft((previous) => ({
      ...previous,
      [list]: previous[list].filter((row) => row.id !== id),
    }));
    setProblems((previous) =>
      previous[list][id] === undefined
        ? previous
        : { ...previous, [list]: without(previous[list], id) },
    );
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;

    const twice = duplicateRowProblems(draft, everything("validation.localityLabelTaken"));
    if (countProblems(twice) > 0) {
      setProblems(twice);
      return;
    }

    setSaving(true);
    try {
      const { payload, sent } = payloadOf(draft, stored);
      const result = await save(isNew ? payload : { integrationId: integration.id, ...payload });
      if (result.ok) {
        setProblems(noProblems());
        notify.success(translate("saved"));
        if (isNew) {
          router.push(`/admin/crm/${result.data.integrationId}`);
          return;
        }
        // A secret is sent once: the page is read again and every secret goes back to "kept".
        setDraft((previous) => ({
          ...previous,
          secrets: {
            apiKey: { mode: "keep", value: "" },
            apiSecret: { mode: "keep", value: "" },
            accessToken: { mode: "keep", value: "" },
          },
        }));
        router.refresh();
        return;
      }
      const byPath: Record<string, string> = {};
      for (const [path, list] of Object.entries(result.fieldErrors ?? {})) {
        const first = list[0];
        if (first && byPath[path] === undefined) byPath[path] = fieldErrorText(everything, first);
      }
      const found = problemsOf(byPath, sent);
      if (countProblems(found) > 0) {
        setProblems(found);
        return;
      }
      notify.error(failureText(everything, result));
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const projectChoices = projects.map((project) => ({ value: project.id, label: project.name }));
  const projectName = (id: string) => projects.find((project) => project.id === id)?.name ?? "";

  const removeWord = (list: ListName, name: string): string => {
    if (list === "headers") {
      return name
        ? translate("headersBody.headers.remove", { name })
        : translate("headersBody.headers.removeBlank");
    }
    if (list === "mapping") {
      return name
        ? translate("headersBody.mapping.remove", { name })
        : translate("headersBody.mapping.removeBlank");
    }
    return name
      ? translate("headersBody.codes.remove", { name })
      : translate("headersBody.codes.removeBlank");
  };

  const rowsOf = (list: ListName): CrmRow[] =>
    draft[list].map((row) => {
      const own = problems[list][row.id];
      return {
        id: row.id,
        first: row.first,
        second: row.second,
        firstError: own?.first,
        secondError: own?.second,
        removeLabel: removeWord(list, list === "codes" ? projectName(row.first) : row.first.trim()),
      };
    });

  const secretLabels: Record<SecretName, string> = {
    apiKey: translate("credentials.apiKey"),
    apiSecret: translate("credentials.apiSecret"),
    accessToken: translate("credentials.accessToken"),
  };

  const title = isNew ? translate("newTitle") : (integration?.name ?? translate("newTitle"));
  const rowHandlers = (list: ListName) => ({
    onChange: (id: string, side: "first" | "second", value: string) =>
      changeRow(list, id, side, value),
    onAdd: () => addRow(list),
    onRemove: (id: string) => removeRow(list, id),
    disabled: saving,
  });

  return (
    <form onSubmit={submit} noValidate className="flex min-w-0 flex-col gap-6">
      <header className="flex flex-col gap-3">
        <Breadcrumb
          navLabel={translate("crumb.nav")}
          backLabel={translate("crumb.back")}
          items={[{ label: translate("crumb.crm"), href: "/admin/crm" }, { label: title }]}
        />
        <Heading as="h1" size="1">
          {title}
        </Heading>
      </header>
      {total > 0 ? (
        <div ref={alertAt} tabIndex={-1}>
          <Alert tone="danger" title={translate("problems.title", { count: total })}>
            {translate("problems.text")}
            {problems.form.length > 0 ? (
              <ul className="mt-2 list-disc ps-5">
                {problems.form.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : null}
          </Alert>
        </div>
      ) : null}
      <div className="flex max-w-3xl min-w-0 flex-col gap-6">
        <FormSection id="connection" title={translate("connection.title")}>
          <CrmConnectionFields
            values={draft.connection}
            errors={problems.connection}
            onChange={changeConnection}
            methods={CRM_METHODS.map((method) => ({ value: method, label: method }))}
            disabled={saving}
            words={{
              name: translate("connection.name"),
              leadSource: translate("connection.leadSource"),
              baseUrl: translate("connection.baseUrl"),
              baseUrlHint: translate("connection.baseUrlHint"),
              endpoint: translate("connection.endpoint"),
              method: translate("connection.method"),
              leadIdPath: translate("connection.leadIdPath"),
              status: translate("connection.status"),
              active: translate("connection.active"),
            }}
          />
        </FormSection>
        <FormSection
          id="credentials"
          title={translate("credentials.title")}
          description={translate("credentials.description")}
        >
          <div className="flex flex-col gap-4">
            {SECRET_NAMES.map((name) => (
              <CrmCredentialField
                key={name}
                label={secretLabels[name]}
                stored={stored[name]}
                mode={draft.secrets[name].mode}
                value={draft.secrets[name].value}
                onModeChange={(mode) => changeSecret(name, { mode })}
                onValueChange={(value) => changeSecret(name, { value })}
                error={problems.secrets[name]}
                disabled={saving}
                words={{
                  replace: translate("credentials.replace"),
                  clear: translate("credentials.clear"),
                  undo: translate("credentials.undo"),
                  cancel: translate("credentials.cancel"),
                  notSet: translate("credentials.notSet"),
                  willClear: translate("credentials.willClear"),
                }}
              />
            ))}
          </div>
        </FormSection>
        <FormSection id="headers-body" title={translate("headersBody.title")}>
          <div className="flex flex-col gap-6">
            <CrmRowsEditor
              heading={translate("headersBody.headers.heading")}
              rows={rowsOf("headers")}
              firstLabel={translate("headersBody.headers.name")}
              secondLabel={translate("headersBody.headers.value")}
              addLabel={translate("headersBody.headers.add")}
              empty={translate("headersBody.headers.empty")}
              {...rowHandlers("headers")}
            />
            <CrmRowsEditor
              heading={translate("headersBody.mapping.heading")}
              note={translate("headersBody.mapping.note", { token: "{{field_key}}" })}
              rows={rowsOf("mapping")}
              firstLabel={translate("headersBody.mapping.name")}
              secondLabel={translate("headersBody.mapping.value")}
              addLabel={translate("headersBody.mapping.add")}
              empty={translate("headersBody.mapping.empty")}
              {...rowHandlers("mapping")}
            />
            <CrmRowsEditor
              heading={translate("headersBody.codes.heading")}
              rows={rowsOf("codes")}
              firstLabel={translate("headersBody.codes.name")}
              secondLabel={translate("headersBody.codes.value")}
              firstChoices={projectChoices}
              choose={translate("headersBody.codes.choose")}
              addLabel={translate("headersBody.codes.add")}
              empty={translate("headersBody.codes.empty")}
              {...rowHandlers("codes")}
            />
          </div>
        </FormSection>
      </div>
      <ProjectSaveBar
        note={translate("save.note")}
        words={{
          cancel: translate("save.cancel"),
          save: translate("save.save"),
          saving: translate("save.saving"),
        }}
        saving={saving}
        onCancel={() => router.push("/admin/crm")}
      />
    </form>
  );
}

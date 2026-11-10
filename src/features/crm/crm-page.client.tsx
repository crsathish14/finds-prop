"use client";

import { Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CrmConnectionCards, CrmPageHeader } from "@/components/domain/crm-connections";
import type { CrmConnectionView } from "@/components/domain/crm-connections";
import { CrmLogsTable, type CrmLogRow } from "@/components/domain/crm-logs-table";
import { Alert } from "@/components/patterns/alert";
import { ConfirmDialog } from "@/components/patterns/confirm-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/patterns/tabs";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { failureText, type Translator } from "@/i18n/failure-text";
import { formatDate, formatTime } from "@/lib/format";
import { notify } from "@/lib/notify";
import type { ActionResult } from "@/types/action";
import { joinUrl } from "./address";
import { CRM_LOGS_LIMIT, MAX_ATTEMPTS, RETRY_MINUTES } from "./constants";
import type { CrmTestResult } from "./integration-service";
import type { CrmLogView, CrmLogsPage } from "./logs-view";
import type { CrmIntegrationView } from "./view";

export type AdminCrmTab = "connections" | "logs";

export type AdminCrmActions = {
  test: (input: { integrationId: string }) => Promise<ActionResult<CrmTestResult>>;
  remove: (input: { integrationId: string }) => Promise<ActionResult<unknown>>;
  retry: (input: {
    submissionId: string;
  }) => Promise<ActionResult<{ submissionId: string; ok: boolean; status: number | null }>>;
};

type AdminCrmProps = {
  tab: AdminCrmTab;
  connections: CrmIntegrationView[];
  logs: CrmLogsPage;
  actions: AdminCrmActions;
};

/** The start of an answer shown in the table; the log keeps up to 500 characters, the table shows the start. */
const RESPONSE_SHOWN = 140;

const cutAnswer = (text: string): string =>
  text.length > RESPONSE_SHOWN ? `${text.slice(0, RESPONSE_SHOWN)}…` : text;

/**
 * The admin's CRM page (S7-T09, FR-ADM-09): the heading and two tabs, "Connections" (a card for each connection, with
 * Test API, Edit and Delete) and "API logs" (what was sent to the CRMs, with Retry on a delivery that is still
 * failed). The tab is in the address (`?tab=logs`). It calls the three actions it is given and reads the page again
 * after a change so it shows what the server holds. A test shows its result above the cards; Delete asks first;
 * only one call to a CRM or one delete runs at a time. No secret is ever on this page: the cards say only "Set" or
 * "Not set" (BR-64).
 */
export function AdminCrm({ tab, connections, logs, actions }: AdminCrmProps) {
  const translate = useTranslations("admin.crm");
  const everything = useTranslations() as unknown as Translator;
  const locale = useLocale();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [tested, setTested] = useState<CrmTestResult | null>(null);
  const [deleting, setDeleting] = useState<CrmIntegrationView | null>(null);
  const dash = translate("dash");

  const reportFailure = (
    failure: Extract<ActionResult<unknown>, { ok: false }>,
    changedText: string,
  ) => {
    if (failure.code === "CONFLICT" || failure.code === "NOT_FOUND") {
      notify.error(changedText);
      router.refresh();
      return;
    }
    notify.error(failureText(everything, failure));
  };

  const runTest = async (connection: CrmIntegrationView) => {
    if (busy) return;
    setBusy(`${connection.id}:test`);
    setTested(null);
    try {
      const result = await actions.test({ integrationId: connection.id });
      if (!result.ok) {
        reportFailure(result, translate("conflict"));
        return;
      }
      setTested(result.data);
    } finally {
      setBusy(null);
    }
  };

  const remove = async (connection: CrmIntegrationView) => {
    if (busy) return;
    setBusy(`${connection.id}:delete`);
    try {
      const result = await actions.remove({ integrationId: connection.id });
      setDeleting(null);
      if (!result.ok) {
        reportFailure(result, translate("conflict"));
        return;
      }
      setTested(null);
      notify.success(translate("toast.deleted", { name: connection.name }));
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  const retry = async (log: CrmLogView) => {
    if (busy || !log.submissionId) return;
    setBusy(`${log.id}:retry`);
    try {
      const result = await actions.retry({ submissionId: log.submissionId });
      if (!result.ok) {
        reportFailure(result, translate("toast.retryConflict"));
        return;
      }
      if (result.data.ok) {
        notify.success(translate("toast.retried"), {
          description: translate("toast.retriedText"),
        });
      } else {
        notify.error(translate("toast.retryFailed"), {
          description:
            result.data.status === null
              ? translate("toast.retryFailedNoAnswer")
              : translate("toast.retryFailedHttp", { status: result.data.status }),
        });
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  const cards: CrmConnectionView[] = connections.map((connection) => {
    const testing = busy === `${connection.id}:test`;
    return {
      id: connection.id,
      name: connection.name,
      state: {
        label: translate(connection.active ? "cards.active" : "cards.inactive"),
        active: connection.active,
      },
      endpoint: `${connection.method} ${joinUrl(connection.baseUrl, connection.endpoint)}`,
      secrets: [
        { label: translate("cards.apiKey"), set: connection.hasApiKey },
        { label: translate("cards.apiSecret"), set: connection.hasApiSecret },
        { label: translate("cards.accessToken"), set: connection.hasAccessToken },
      ],
      test: {
        label: translate("cards.test"),
        onClick: () => void runTest(connection),
        pending: testing,
        disabled: !connection.active || (busy !== null && !testing),
      },
      edit: {
        href: `/admin/crm/${connection.id}`,
        label: translate("cards.edit"),
        forName: connection.name,
      },
      remove: {
        label: translate("cards.deleteFor", { name: connection.name }),
        onClick: () => setDeleting(connection),
      },
    };
  });

  const notice = tested ? (
    tested.ok ? (
      <Alert tone="success" title={translate("test.succeededTitle")}>
        {translate("test.succeeded", {
          name: tested.integrationName,
          status: tested.status ?? 0,
          ms: tested.durationMs,
        })}
      </Alert>
    ) : (
      <Alert tone="danger" title={translate("test.failedTitle")}>
        {tested.status === null
          ? translate("test.noAnswer", { name: tested.integrationName })
          : translate("test.failed", { name: tested.integrationName, status: tested.status })}
      </Alert>
    )
  ) : null;

  const timeText = (iso: string) =>
    `${formatDate(locale, iso, "medium")}, ${formatTime(locale, iso)}`;

  const rows: CrmLogRow[] = logs.logs.map((log) => {
    const time = timeText(log.createdAt);
    const statusWord = everything(`admin.crm.logs.status.${log.outcome}`);
    return {
      id: log.id,
      time,
      crm: log.integrationName,
      form: log.formName ?? dash,
      status: (
        <Badge dot tone={log.outcome === "success" ? "success" : "danger"}>
          {statusWord}
        </Badge>
      ),
      http: log.httpStatus === null ? dash : String(log.httpStatus),
      attempt: String(log.attempt),
      response: log.snippet ? cutAnswer(log.snippet) : dash,
      retry: log.retryable
        ? {
            label: translate("logs.retry"),
            forName: `${log.integrationName}, ${time}`,
            onClick: () => void retry(log),
            pending: busy === `${log.id}:retry`,
          }
        : undefined,
    };
  });

  const schedule = new Intl.ListFormat(locale === "en" ? "en-IN" : locale, {
    style: "long",
    type: "conjunction",
  }).format(RETRY_MINUTES.map(String));

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <CrmPageHeader
        title={translate("title")}
        intro={translate("intro")}
        {...(tab === "connections"
          ? { action: { label: translate("new"), href: "/admin/crm/new" } }
          : {})}
      />
      <Tabs
        value={tab}
        onValueChange={(value) =>
          router.push(value === "logs" ? "/admin/crm?tab=logs" : "/admin/crm")
        }
      >
        <TabsList aria-label={translate("tabs.label")}>
          <TabsTrigger value="connections" count={connections.length}>
            {translate("tabs.connections")}
          </TabsTrigger>
          <TabsTrigger
            value="logs"
            {...(logs.failedSubmissions > 0
              ? {
                  count: translate("tabs.failed", { count: logs.failedSubmissions }),
                  countTone: "new" as const,
                }
              : {})}
          >
            {translate("tabs.logs")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="flex flex-col gap-4 pt-4">
          {tab === "connections" ? (
            <CrmConnectionCards
              connections={cards}
              words={{
                endpoint: translate("cards.endpoint"),
                secretSet: translate("cards.secretSet"),
                secretNotSet: translate("cards.secretNotSet"),
                secretsNote: translate("cards.secretsNote"),
              }}
              notice={notice}
              empty={{
                title: translate("cards.empty.title"),
                text: translate("cards.empty.text"),
                action: { label: translate("new"), href: "/admin/crm/new" },
              }}
            />
          ) : (
            <CrmLogsTable
              caption={translate("logs.caption")}
              columns={{
                time: translate("logs.columns.time"),
                crm: translate("logs.columns.crm"),
                form: translate("logs.columns.form"),
                status: translate("logs.columns.status"),
                http: translate("logs.columns.http"),
                attempt: translate("logs.columns.attempt"),
                response: translate("logs.columns.response"),
                actions: translate("logs.columns.actions"),
              }}
              rows={rows}
              countText={
                rows.length >= CRM_LOGS_LIMIT
                  ? translate("logs.countLatest", { count: rows.length })
                  : translate("logs.count", { count: rows.length })
              }
              note={translate("logs.note", { minutes: schedule, attempts: MAX_ATTEMPTS })}
              empty={{ title: translate("logs.empty.title"), text: translate("logs.empty.text") }}
            />
          )}
        </TabsContent>
      </Tabs>
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => (open ? undefined : setDeleting(null))}
        tone="danger"
        icon={<Icon icon={Trash2} size="lg" />}
        title={translate("deleteDialog.title", { name: deleting?.name ?? "" })}
        description={translate("deleteDialog.text")}
        confirmLabel={translate("deleteDialog.confirm")}
        cancelLabel={translate("cancel")}
        loading={busy !== null && deleting !== null && busy === `${deleting.id}:delete`}
        onConfirm={() => (deleting ? void remove(deleting) : undefined)}
      />
    </div>
  );
}

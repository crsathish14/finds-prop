/**
 * CrmPageHeader and CrmConnectionCards: the heading and the connection cards of the admin's CRM page.
 * Purpose: the first tab of the CRM page (S7-T09, FR-ADM-09): what the page is for, the New connection button, and a
 *   card for each CRM connection with its name and state (Active or Inactive), where it sends (the method and the
 *   address), whether each secret is set, and Test API, Edit and Delete. Owner: design system. They hold no state: the
 *   page passes the cards, already translated, and what each button does. The tabs above the cards, the test result
 *   (an Alert in `notice`) and the delete question (a ConfirmDialog) belong to the page.
 * Props: CrmPageHeader: title, headingLevel ("h1" default | "h2", for the Design Lab), intro, action ({ label, href },
 *   the New connection button; leave it out on the tab that has none), className. CrmConnectionCards: connections ({ id,
 *   name, state ({ label, active }), endpoint (the method and address as one line), secrets ({ label, set }[], empty
 *   for a connection that has none to show), test ({ label, onClick, pending, disabled }), edit ({ href, label,
 *   forName }), remove ({ label (names the connection), onClick }) or none }), words ({ endpoint, secretSet,
 *   secretNotSet, secretsNote }), notice (anything above the cards), empty ({ title, text, action { label, href } }),
 *   className.
 * Responsive: the cards stack; the buttons wrap under the name on a phone; a long name wraps and a long address breaks
 *   anywhere.
 * Accessibility: each card is an article named by its heading; the state and each secret are words as well as a colour;
 *   each button says which connection it is for (the visible word is followed by hidden text, the delete icon has the
 *   connection in its label); a test that is running is marked busy.
 * States: any number of connections; active and inactive (Test API is off for an inactive one, as the screen draws it);
 *   secrets set and not set; a test running; nothing yet (the empty state with New connection).
 * Dependencies: Badge, Button, IconButton, Icon, Heading, Text, EmptyState, VisuallyHidden, cn. Tests: crm-parts.test.tsx;
 *   Design Lab "CRM" (S7-T09).
 * UX reference: admin-crm screen, the Connections tab (crm-card, kvlist, mini-note).
 */
import { Check, Pencil, Plug, Plus, Trash2, Lock, X } from "lucide-react";
import NextLink from "next/link";
import { useId, type ReactNode } from "react";
import { EmptyState } from "@/components/patterns/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { cn } from "@/lib/cn";

type CrmAction = { label: string; href: string };

type CrmPageHeaderProps = {
  title: string;
  headingLevel?: "h1" | "h2";
  intro: string;
  action?: CrmAction;
  className?: string;
};

function CrmPageHeader({
  title,
  headingLevel = "h1",
  intro,
  action,
  className,
}: CrmPageHeaderProps) {
  return (
    <div
      data-slot="crm-page-header"
      className={cn("flex flex-wrap items-start justify-between gap-4", className)}
    >
      <div className="flex flex-col gap-2">
        <Heading as={headingLevel} size="1">
          {title}
        </Heading>
        <Text tone="muted">{intro}</Text>
      </div>
      {action ? (
        <Button asChild variant="primary">
          <NextLink href={action.href}>
            <Icon icon={Plus} size="sm" />
            {action.label}
          </NextLink>
        </Button>
      ) : null}
    </div>
  );
}

type CrmConnectionView = {
  id: string;
  name: string;
  state: { label: string; active: boolean };
  /** The method and the address as one line, such as "POST https://api.crm.example/v2/leads". */
  endpoint: string;
  secrets: { label: string; set: boolean }[];
  test: { label: string; onClick: () => void; pending?: boolean; disabled?: boolean };
  edit: { href: string; label: string; forName: string };
  remove?: { label: string; onClick: () => void } | undefined;
};

type CrmConnectionCardsProps = {
  connections: CrmConnectionView[];
  words: { endpoint: string; secretSet: string; secretNotSet: string; secretsNote: string };
  notice?: ReactNode;
  empty: { title: string; text: string; action: CrmAction };
  className?: string;
};

const row = "flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2";

function CrmConnectionCards({
  connections,
  words,
  notice,
  empty,
  className,
}: CrmConnectionCardsProps) {
  return (
    <div data-slot="crm-connection-cards" className={cn("flex min-w-0 flex-col gap-4", className)}>
      {notice}
      {connections.length === 0 ? (
        <EmptyState title={empty.title} description={empty.text}>
          <Button asChild variant="primary">
            <NextLink href={empty.action.href}>
              <Icon icon={Plus} size="sm" />
              {empty.action.label}
            </NextLink>
          </Button>
        </EmptyState>
      ) : (
        connections.map((connection) => (
          <ConnectionCard key={connection.id} connection={connection} words={words} />
        ))
      )}
    </div>
  );
}

function ConnectionCard({
  connection,
  words,
}: {
  connection: CrmConnectionView;
  words: CrmConnectionCardsProps["words"];
}) {
  const titleId = useId();
  return (
    <article
      aria-labelledby={titleId}
      className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 md:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <h2 id={titleId} className="text-title font-bold text-ink [overflow-wrap:anywhere]">
            {connection.name}
          </h2>
          <Badge dot tone={connection.state.active ? "success" : "neutral"}>
            {connection.state.label}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            loading={connection.test.pending ?? false}
            disabled={connection.test.disabled ?? false}
            iconStart={<Icon icon={Plug} size="sm" />}
            onClick={connection.test.onClick}
          >
            {connection.test.label} <VisuallyHidden>{connection.name}</VisuallyHidden>
          </Button>
          <Button asChild size="sm" variant="secondary">
            <NextLink href={connection.edit.href}>
              <Icon icon={Pencil} size="sm" />
              {connection.edit.label} <VisuallyHidden>{connection.edit.forName}</VisuallyHidden>
            </NextLink>
          </Button>
          {connection.remove ? (
            <IconButton
              aria-label={connection.remove.label}
              className="text-danger"
              onClick={connection.remove.onClick}
            >
              <Icon icon={Trash2} />
            </IconButton>
          ) : null}
        </div>
      </div>
      <dl className="flex flex-col divide-y divide-line">
        <div className={row}>
          <dt className="text-small text-muted">{words.endpoint}</dt>
          <dd>
            <code className="font-mono text-small font-bold text-ink [overflow-wrap:anywhere]">
              {connection.endpoint}
            </code>
          </dd>
        </div>
        {connection.secrets.map((secret) => (
          <div key={secret.label} className={row}>
            <dt className="text-small text-muted">{secret.label}</dt>
            <dd>
              <Badge tone={secret.set ? "success" : "neutral"}>
                <Icon icon={secret.set ? Check : X} size="sm" />
                {secret.set ? words.secretSet : words.secretNotSet}
              </Badge>
            </dd>
          </div>
        ))}
      </dl>
      {connection.secrets.length > 0 ? (
        <p className="flex items-center gap-2 text-small text-muted">
          <Icon icon={Lock} size="sm" />
          <span>{words.secretsNote}</span>
        </p>
      ) : null}
    </article>
  );
}

export { CrmConnectionCards, CrmPageHeader };
export type { CrmAction, CrmConnectionCardsProps, CrmConnectionView, CrmPageHeaderProps };

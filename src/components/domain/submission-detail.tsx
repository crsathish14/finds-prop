/**
 * SubmissionDetail: everything one form submission holds, for the drawer that opens from the list.
 * Purpose: read a whole submission (S7-T07, FR-ADM-06): when it came, who, how to reach them, the form and project, the
 *   answers with the form's own questions, and how the CRM stands, with the reason when the delivery failed. Owner:
 *   design system. It holds no state: it fills a ManagerDrawer, whose footer closes it. Under a failed delivery it can
 *   show "Retry delivery now" (S7-T09), which the page turns on only when the submission can be sent again.
 * Props: details (what the submission holds: { created, name, mobile { text, href } or none, email, form, project,
 *   source }, each already formatted, a dash where there is nothing), answers ({ id, label, value }[], the value
 *   already formatted), crm ({ badge (a StatusBadge), leadId (the CRM's own id once delivered) }), failure ({ title,
 *   text }, only for a failed delivery: "CRM delivery failed" and its reason), retry ({ label, onClick, pending }, the
 *   button under the failure; leave it out when the delivery cannot be retried), words ({ created, name, mobile, email,
 *   form, project, source, answers, crm, crmId }, the labels; `answers` is the heading over the answers), className.
 * Responsive: one column of label and value pairs; a long value breaks anywhere.
 * Accessibility: a description list (a term, then its value), the answers under their own heading; the CRM state is
 *   a word; the failure is an Alert that is read at once; the retry button is a real button and is marked busy while it
 *   works.
 * States: delivered, retrying, not sent, failed (with its reason, with and without Retry delivery now, and while it
 *   retries); no answers; a long answer; a list of answers.
 * Dependencies: Alert, Button, Icon, Heading. Tests: submissions-parts.test.tsx; Design Lab "Admin" (S7-T07).
 * UX reference: admin-leads screen, "Submission details" drawer (kv, alert).
 */
import { RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { Alert } from "@/components/patterns/alert";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

type SubmissionDetailAnswer = { id: string; label: string; value: string };

type SubmissionDetailProps = {
  details: {
    created: string;
    name: string;
    mobile?: { text: string; href: string } | null;
    email: string;
    form: string;
    project: string;
    source: string;
  };
  /** Shown for a mobile number that was not given: a dash, already formatted. */
  noMobile: string;
  answers: SubmissionDetailAnswer[];
  crm: { badge: ReactNode; leadId?: string | null };
  failure?: { title: string; text: string };
  /** Under the failure: send the submission again now. Left out when it cannot be sent again. */
  retry?: { label: string; onClick: () => void; pending?: boolean };
  words: {
    created: string;
    name: string;
    mobile: string;
    email: string;
    form: string;
    project: string;
    source: string;
    answers: string;
    crm: string;
    crmId: string;
  };
  className?: string;
};

const term = "text-caption font-semibold text-muted";
const value = "text-body text-ink [overflow-wrap:anywhere]";

function SubmissionDetail({
  details,
  noMobile,
  answers,
  crm,
  failure,
  retry,
  words,
  className,
}: SubmissionDetailProps) {
  return (
    <div data-slot="submission-detail" className={cn("flex flex-col gap-5", className)}>
      <dl className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <dt className={term}>{words.created}</dt>
          <dd className={value}>{details.created}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className={term}>{words.name}</dt>
          <dd className={value}>{details.name}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className={term}>{words.mobile}</dt>
          <dd className={value}>
            {details.mobile ? (
              <a
                href={details.mobile.href}
                className="rounded-xs font-semibold text-primary underline decoration-line-strong underline-offset-4 hover:decoration-primary"
              >
                {details.mobile.text}
              </a>
            ) : (
              noMobile
            )}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className={term}>{words.email}</dt>
          <dd className={value}>{details.email}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className={term}>{words.form}</dt>
          <dd className={value}>{details.form}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className={term}>{words.project}</dt>
          <dd className={value}>{details.project}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className={term}>{words.source}</dt>
          <dd className={value}>{details.source}</dd>
        </div>
      </dl>
      {answers.length > 0 ? (
        <section aria-label={words.answers} className="flex flex-col gap-3">
          <Heading as="h3" size="3">
            {words.answers}
          </Heading>
          <dl className="flex flex-col gap-3">
            {answers.map((answer) => (
              <div key={answer.id} className="flex flex-col gap-1">
                <dt className={term}>{answer.label}</dt>
                <dd className={cn(value, "font-medium")}>{answer.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
      <section aria-label={words.crm} className="flex flex-col gap-3">
        <Heading as="h3" size="3">
          {words.crm}
        </Heading>
        <div className="flex flex-wrap items-center gap-2">
          {crm.badge}
          {crm.leadId ? (
            <span className="text-small text-muted">
              {words.crmId} {crm.leadId}
            </span>
          ) : null}
        </div>
        {failure ? (
          <Alert tone="danger" title={failure.title}>
            {failure.text}
          </Alert>
        ) : null}
        {failure && retry ? (
          <div>
            <Button
              type="button"
              variant="primary"
              loading={retry.pending ?? false}
              iconStart={<Icon icon={RefreshCw} size="sm" />}
              onClick={retry.onClick}
            >
              {retry.label}
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

export { SubmissionDetail };
export type { SubmissionDetailAnswer, SubmissionDetailProps };

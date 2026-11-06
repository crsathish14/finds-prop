"use client";

import { useState } from "react";
import { DashboardScreen } from "@/features/account/dashboard-screen";
import { DashboardSkeleton } from "@/features/account/dashboard-skeleton";
import { EmailPromptView, type EmailPromptViewProps } from "@/features/account/email-prompt.client";
import type { DashboardTab } from "@/features/account/schemas";
import { TabEmpty } from "@/features/account/tab-empty";
import { Specimen } from "../frame";

const FRAME = "w-full rounded-xl border border-line bg-canvas";
const NOTHING = () => undefined;

/** The prompt's props with nothing typed, nothing in flight and nothing wrong. */
const PROMPT: EmailPromptViewProps = {
  mode: "prompt",
  value: "",
  onValueChange: NOTHING,
  sentTo: "",
  problem: null,
  failure: null,
  busy: false,
  waitSeconds: 0,
  resent: false,
  onSubmit: NOTHING,
  onLater: NOTHING,
  onResend: NOTHING,
};

function Screen({
  id,
  tab = "saved",
  name = "Priya Raman",
  notice,
  emailPending = false,
}: {
  id: string;
  tab?: DashboardTab;
  name?: string | null;
  notice?: EmailPromptViewProps;
  emailPending?: boolean;
}) {
  return (
    <div className={FRAME}>
      <DashboardScreen
        name={name}
        active={tab}
        postHref="#post"
        titleAs="h2"
        titleId={id}
        emailPending={emailPending}
        onSelect={NOTHING}
        notice={notice ? <EmailPromptView {...notice} /> : null}
      >
        <TabEmpty tab={tab} browseHref="#homes" postHref="#post" />
      </DashboardScreen>
    </div>
  );
}

/** The one screen whose tabs can be chosen, to show the active mark and the keys. */
function ChoosableScreen() {
  const [tab, setTab] = useState<DashboardTab>("saved");
  return (
    <div className={FRAME}>
      <DashboardScreen
        name="Priya Raman"
        active={tab}
        postHref="#post"
        titleAs="h2"
        titleId="dashboard-choose"
        onSelect={setTab}
      >
        <TabEmpty tab={tab} browseHref="#homes" postHref="#post" />
      </DashboardScreen>
    </div>
  );
}

/**
 * The dashboard in its states: the tabs (choose one), each tab with nothing to list, the line without a
 * name, the email prompt (ready, a wrong address, an address that cannot be used, a failure, sending) and
 * its reminder (waiting, ready to send again, a failure), and loading. Nothing here navigates.
 */
export function DashboardPageDemo() {
  return (
    <div className="flex flex-col gap-14">
      <Specimen label="Saved: the tabs can be chosen, with the arrow keys too" className="w-full">
        <ChoosableScreen />
      </Specimen>
      <Specimen label="My listings: nothing to list yet" className="w-full">
        <Screen id="dashboard-listings" tab="listings" />
      </Specimen>
      <Specimen label="Enquiries received: nothing to list yet" className="w-full">
        <Screen id="dashboard-received" tab="received" />
      </Specimen>
      <Specimen label="My enquiries: nothing to list yet" className="w-full">
        <Screen id="dashboard-sent" tab="sent" />
      </Specimen>
      <Specimen label="No name given at sign-in: the line leaves the name out" className="w-full">
        <Screen id="dashboard-no-name" name={null} />
      </Specimen>
      <Specimen
        label="Email prompt: no address yet. It never blocks browsing, saving or enquiring"
        className="w-full"
      >
        <Screen id="dashboard-prompt" notice={PROMPT} />
      </Specimen>
      <Specimen label="Email prompt: the address typed is not one" className="w-full">
        <Screen
          id="dashboard-prompt-invalid"
          notice={{ ...PROMPT, value: "priya@example", problem: "invalid" }}
        />
      </Specimen>
      <Specimen
        label="Email prompt: the address cannot be used (no reason given)"
        className="w-full"
      >
        <Screen
          id="dashboard-prompt-taken"
          notice={{ ...PROMPT, value: "priya@example.com", problem: "taken" }}
        />
      </Specimen>
      <Specimen label="Email prompt: sending" className="w-full">
        <Screen
          id="dashboard-prompt-sending"
          notice={{ ...PROMPT, value: "priya@example.com", busy: true }}
        />
      </Specimen>
      <Specimen label="Email prompt: the link could not be sent" className="w-full">
        <Screen
          id="dashboard-prompt-failed"
          notice={{
            ...PROMPT,
            value: "priya@example.com",
            failure: "A service we rely on isn't responding. Please try again.",
          }}
        />
      </Specimen>
      <Specimen
        label="Reminder: a link was sent and is not used yet. Send again is on a wait"
        className="w-full"
      >
        <Screen
          id="dashboard-reminder"
          emailPending
          notice={{
            ...PROMPT,
            mode: "pending",
            sentTo: "priya.raman@example.com",
            waitSeconds: 45,
          }}
        />
      </Specimen>
      <Specimen label="Reminder: the link can be sent again" className="w-full">
        <Screen
          id="dashboard-reminder-ready"
          emailPending
          notice={{ ...PROMPT, mode: "pending", sentTo: "priya.raman@example.com" }}
        />
      </Specimen>
      <Specimen label="Reminder: sending the link again failed" className="w-full">
        <Screen
          id="dashboard-reminder-failed"
          emailPending
          notice={{
            ...PROMPT,
            mode: "pending",
            sentTo: "priya.raman@example.com",
            failure: "Too many attempts. Please try again in 10 minutes.",
            waitSeconds: 600,
          }}
        />
      </Specimen>
      <Specimen label="Loading" className="w-full">
        <div className={FRAME}>
          <DashboardSkeleton />
        </div>
      </Specimen>
    </div>
  );
}

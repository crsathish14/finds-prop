"use client";

import { Trash2, TriangleAlert } from "lucide-react";
import { useState, type ReactNode } from "react";
import { MyListingRow, MyListingsList } from "@/components/domain/my-listing-row";
import type { QueueAction } from "@/components/domain/listing-queue";
import {
  ReceivedEnquiriesList,
  ReceivedEnquiryRow,
} from "@/components/domain/received-enquiry-row";
import { Alert } from "@/components/patterns/alert";
import { ConfirmDialog } from "@/components/patterns/confirm-dialog";
import { StatusBadge } from "@/components/patterns/status-badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/components/ui/link";
import { DashboardScreen } from "@/features/account/dashboard-screen";
import type { DashboardTab, TabCounts } from "@/features/account/schemas";
import { Specimen } from "../frame";

/**
 * The owner's two tabs of the dashboard in their states (S6-T03): "My listings" with every state a listing can
 * be in and the buttons of each, and "Enquiries received" with the three states of an enquiry. Plain English text
 * and drawn pictures; nothing here goes anywhere.
 */

const FRAME = "w-full rounded-xl border border-line bg-canvas";
const NOTHING = () => undefined;
const PICTURES = "/design-lab/listings";
const ART = { alt: "Drawn placeholder: a house with a pitched roof" } as const;

const COUNTS: TabCounts = {
  saved: { value: 3 },
  listings: { value: 5 },
  received: { value: "1 new", tone: "new" },
  sent: { value: 2 },
};

function Screen({
  id,
  tab,
  children,
  counts = COUNTS,
}: {
  id: string;
  tab: DashboardTab;
  children: ReactNode;
  counts?: TabCounts;
}) {
  return (
    <div className={FRAME}>
      <DashboardScreen
        name="Priya Raman"
        active={tab}
        postHref="#post"
        titleAs="h2"
        titleId={id}
        counts={counts}
        onSelect={NOTHING}
      >
        {children}
      </DashboardScreen>
    </div>
  );
}

const act = (
  id: string,
  label: string,
  forName: string,
  tone: QueueAction["tone"],
  extra: Partial<QueueAction> = {},
): QueueAction => ({ id, label, forName, tone, onClick: NOTHING, ...extra });

const VILLA = "Independent villa with private garden and terrace";
const TOWER = "3 BHK apartment with clubhouse and covered parking";
const FLAT = "3 BHK semi-furnished flat with east-facing balcony";
const HOUSE = "2 BHK independent house near the beach";
const GUINDY = "Spacious 2 BHK for rent with covered parking";
const LONG =
  "Spacious luxury duplex penthouse with private terrace pool, double-height living room, home theatre, servant quarters and four covered car parks";

function Live({ title, kind }: { title: string; kind: "sale" | "rent" }) {
  return (
    <MyListingRow
      title={title}
      href="#home"
      cover={{ src: `${PICTURES}/home-c.svg`, ...ART }}
      price={kind === "sale" ? "₹1.25 Cr" : "₹48,000/mo"}
      place="Velachery"
      posted="Posted 2 days ago"
      kind={kind === "sale" ? "For sale" : "For rent"}
      status={<StatusBadge kind="listing" status="live" />}
      actions={[
        act("close", kind === "sale" ? "Mark as sold" : "Mark as rented", title, "secondary", {
          icon: "check",
        }),
        act("delete", "Delete", title, "danger-outline"),
      ]}
    />
  );
}

function Closed({ title, rented }: { title: string; rented?: boolean }) {
  return (
    <MyListingRow
      title={title}
      cover={{ src: `${PICTURES}/home-b.svg`, ...ART }}
      price={rented ? "₹26,000/mo" : "₹1.65 Cr"}
      place={rented ? "Guindy" : "Besant Nagar"}
      posted={rented ? "Posted 2 months ago" : "Posted 3 weeks ago"}
      kind={rented ? "For rent" : "For sale"}
      status={<StatusBadge kind="listing" status={rented ? "rentedOut" : "sold"} />}
      actions={[act("delete", "Delete", title, "danger-outline")]}
    />
  );
}

const FOOTNOTE =
  "Only approved listings can be marked as sold or rented. A sold or rented home is removed from search.";

/** The first screen: every state of the UX list, with the numbers on the tabs. */
function ListingsFull() {
  return (
    <MyListingsList label="Your listings" footnote={FOOTNOTE}>
      <Live title={TOWER} kind="sale" />
      <Live title={FLAT} kind="rent" />
      <MyListingRow
        title={VILLA}
        cover={{ src: `${PICTURES}/home-a.svg`, ...ART }}
        price="₹2.85 Cr"
        place="OMR Sholinganallur"
        posted="Posted today"
        kind="For sale"
        status={<StatusBadge kind="listing" status="pendingReview" />}
        note={{
          tone: "waiting",
          text: "Waiting for review. It will appear on Find Prop once it is approved.",
        }}
        actions={[act("delete", "Delete", VILLA, "danger-outline")]}
      />
      <Closed title={HOUSE} />
      <Closed title={GUINDY} rented />
    </MyListingsList>
  );
}

/** The second: not approved with its reason, a long title, no picture or price, and a button working. */
function ListingsOther() {
  return (
    <MyListingsList label="Your listings">
      <MyListingRow
        title={VILLA}
        price="₹2.85 Cr"
        place="OMR Sholinganallur"
        posted="Posted 5 days ago"
        kind="For sale"
        status={<StatusBadge kind="listing" status="notApproved" />}
        note={{
          tone: "rejected",
          text: "Reason: Add a photo of the home itself, not of the street.",
        }}
        actions={[act("delete", "Delete", VILLA, "danger-outline")]}
      />
      <MyListingRow
        title={LONG}
        href="#home"
        cover={{ src: `${PICTURES}/home-a.svg`, ...ART }}
        price="₹9.5 Cr"
        place="Besant Nagar"
        posted="Posted yesterday"
        kind="For sale"
        status={<StatusBadge kind="listing" status="live" />}
        actions={[
          act("close", "Mark as sold", LONG, "secondary", { icon: "check", pending: true }),
          act("delete", "Delete", LONG, "danger-outline"),
        ]}
      />
      <MyListingRow
        title="Untitled listing"
        price="Not provided"
        posted="Posted today"
        status={<StatusBadge kind="listing" status="pendingReview" />}
        note={{
          tone: "waiting",
          text: "Waiting for review. It will appear on Find Prop once it is approved.",
        }}
        actions={[act("delete", "Delete", "Untitled listing", "danger-outline", { pending: true })]}
      />
    </MyListingsList>
  );
}

/** The failed line of the UX: nothing was changed, with Try again. */
function FailedLine() {
  return (
    <Alert
      tone="danger"
      title="We couldn't update that listing"
      action={
        <Button type="button" variant="danger-outline" size="sm">
          Try again
        </Button>
      }
    >
      Nothing was changed. Check your connection and try again.
    </Alert>
  );
}

/** The three confirmations, opened by buttons so each can be tried (Escape and Cancel close them). */
function ConfirmDialogs() {
  const [open, setOpen] = useState<"sold" | "rented" | "delete" | null>(null);
  const close = (next: boolean) => {
    if (!next) setOpen(null);
  };
  return (
    <div className="flex flex-wrap gap-3">
      <Button type="button" variant="secondary" onClick={() => setOpen("sold")}>
        Open: mark as sold
      </Button>
      <Button type="button" variant="secondary" onClick={() => setOpen("rented")}>
        Open: mark as rented
      </Button>
      <Button type="button" variant="danger-outline" onClick={() => setOpen("delete")}>
        Open: delete
      </Button>
      <ConfirmDialog
        open={open === "sold"}
        onOpenChange={close}
        tone="warning"
        icon={<Icon icon={TriangleAlert} size="lg" />}
        title="Mark this home as sold?"
        description={`"${TOWER}" will be removed from search results. You can't undo this.`}
        confirmLabel="Mark as sold"
        cancelLabel="Keep it live"
        onConfirm={() => setOpen(null)}
      />
      <ConfirmDialog
        open={open === "rented"}
        onOpenChange={close}
        tone="warning"
        icon={<Icon icon={TriangleAlert} size="lg" />}
        title="Mark this home as rented?"
        description={`"${FLAT}" will be removed from search results. You can't undo this.`}
        confirmLabel="Mark as rented"
        cancelLabel="Keep it live"
        onConfirm={() => setOpen(null)}
      />
      <ConfirmDialog
        open={open === "delete"}
        onOpenChange={close}
        icon={<Icon icon={Trash2} size="lg" />}
        title="Delete this listing?"
        description={`"${VILLA}" will be permanently deleted, along with any enquiries on it. This can't be undone.`}
        confirmLabel="Delete listing"
        cancelLabel="Cancel"
        onConfirm={() => setOpen(null)}
      />
    </div>
  );
}

export function MyListingsDemo() {
  return (
    <div className="flex flex-col gap-14">
      <Specimen
        label="My listings: Live (sale and rent), Pending review with its note, Sold and Rented out. The tabs carry their numbers"
        className="w-full"
      >
        <Screen id="owner-listings" tab="listings">
          <ListingsFull />
        </Screen>
      </Specimen>
      <Specimen
        label="Not approved with the admin's reason, a very long title, a button that is working, no picture, no price"
        className="w-full"
      >
        <Screen id="owner-listings-other" tab="listings">
          <ListingsOther />
        </Screen>
      </Specimen>
      <Specimen label="When an update fails: nothing was changed, and Try again" className="w-full">
        <Screen id="owner-listings-failed" tab="listings">
          <div className="flex flex-col gap-4">
            <FailedLine />
            <ListingsFull />
          </div>
        </Screen>
      </Specimen>
      <Specimen label="The confirmations (try them: Escape or Cancel closes them)">
        <ConfirmDialogs />
      </Specimen>
    </div>
  );
}

const WHEN = (when: string, home: string, live = true): ReactNode => (
  <>
    About {live ? <Link href="#home">{home}</Link> : <span>{home}</span>} · {when}
  </>
);

const contact = (digits: string, text: string) => ({ text, href: `tel:${digits}` });
const mail = (address: string) => ({ text: address, href: `mailto:${address}` });

function ReceivedFull() {
  return (
    <ReceivedEnquiriesList label="Enquiries received">
      <ReceivedEnquiryRow
        name="Arjun Menon"
        phone={contact("9841055512", "98410 55512")}
        email={mail("arjun.menon@example.com")}
        status={<StatusBadge kind="enquiry" status="new" />}
        about={WHEN("2 hours ago", TOWER)}
        message="Is the apartment still available? I can visit this weekend."
        actions={[
          act("contacted", "Mark contacted", "Arjun Menon", "primary"),
          act("closed", "Close enquiry", "Arjun Menon", "secondary"),
        ]}
      />
      <ReceivedEnquiryRow
        name="Divya Krishnan"
        phone={contact("9884021098", "98840 21098")}
        status={<StatusBadge kind="enquiry" status="contacted" />}
        about={WHEN("Yesterday", FLAT)}
        message="Could you share the maintenance charges?"
        actions={[act("closed", "Close enquiry", "Divya Krishnan", "secondary")]}
      />
      <ReceivedEnquiryRow
        name="Karthik S"
        phone={contact("9789044120", "97890 44120")}
        email={mail("karthik@example.com")}
        status={<StatusBadge kind="enquiry" status="closed" />}
        about={WHEN("2 weeks ago", HOUSE)}
        message="Interested. Please call me."
        actions={[]}
      />
    </ReceivedEnquiriesList>
  );
}

function ReceivedOther() {
  return (
    <ReceivedEnquiriesList label="Enquiries received">
      <ReceivedEnquiryRow
        name="Mohammed Abdul Rahman Ansari"
        phone={contact("9840012345", "98400 12345")}
        email={mail("mohammed.abdul.rahman.ansari.properties@example.com")}
        status={<StatusBadge kind="enquiry" status="new" />}
        about={WHEN("Just now", LONG)}
        message={
          "Hello, I saw your listing and I am interested.\nCould you tell me the exact maintenance charges, whether the car parks are covered and when I can visit with my family? We are free on Saturday and Sunday this week."
        }
        actions={[
          act("contacted", "Mark contacted", "Mohammed", "primary", { pending: true }),
          act("closed", "Close enquiry", "Mohammed", "secondary"),
        ]}
      />
      <ReceivedEnquiryRow
        name="Anitha Raman"
        phone={contact("9840098400", "98400 98400")}
        status={<StatusBadge kind="enquiry" status="new" />}
        about={WHEN("3 days ago", "A home that is no longer listed", false)}
        actions={[
          act("contacted", "Mark contacted", "Anitha Raman", "primary"),
          act("closed", "Close enquiry", "Anitha Raman", "secondary"),
        ]}
      />
    </ReceivedEnquiriesList>
  );
}

export function ReceivedEnquiriesDemo() {
  return (
    <div className="flex flex-col gap-14">
      <Specimen
        label="Enquiries received: New (both buttons), Contacted (Close only) and Closed (no buttons); the phone and email are links"
        className="w-full"
      >
        <Screen id="owner-received" tab="received">
          <ReceivedFull />
        </Screen>
      </Specimen>
      <Specimen
        label="A long name, email and message with line breaks, a button working, no email, no message, and a home that is no longer listed"
        className="w-full"
      >
        <Screen id="owner-received-other" tab="received">
          <ReceivedOther />
        </Screen>
      </Specimen>
      <Specimen label="When an update fails: the same line as on My listings" className="w-full">
        <Screen id="owner-received-failed" tab="received">
          <div className="flex flex-col gap-4">
            <Alert
              tone="danger"
              title="We couldn't update that enquiry"
              action={
                <Button type="button" variant="danger-outline" size="sm">
                  Try again
                </Button>
              }
            >
              Nothing was changed. Check your connection and try again.
            </Alert>
            <ReceivedFull />
          </div>
        </Screen>
      </Specimen>
    </div>
  );
}

"use client";

import { CircleX, Star } from "lucide-react";
import { useState, type ReactNode } from "react";
import { ListingQueue, type QueueAction, type QueueRow } from "@/components/domain/listing-queue";
import { ListingReview, ReviewFacts } from "@/components/domain/listing-review";
import { RejectListingDialog } from "@/components/domain/reject-listing-dialog";
import { EmptyState } from "@/components/patterns/empty-state";
import { StatusBadge } from "@/components/patterns/status-badge";
import { ShowMore } from "@/components/patterns/show-more";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/patterns/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { NativeSelect } from "@/components/ui/native-select";

/**
 * The sample content of the Admin board (S6-T04): the rows, the drawer and the dialog as the listings page
 * will fill them, with plain English text and drawn pictures. The demos and the whole-page previews share it.
 */

const PICTURES = "/design-lab/listings";
const NOTHING = () => undefined;

const COLUMNS = {
  listing: "Listing",
  owner: "Owner",
  price: "Price",
  submitted: "Submitted",
  status: "Status",
  actions: "Actions",
};

const act = (
  id: string,
  label: string,
  forName: string,
  tone: QueueAction["tone"],
  icon?: QueueAction["icon"],
  pending = false,
): QueueAction => ({
  id,
  label,
  forName,
  tone,
  ...(icon ? { icon } : {}),
  onClick: NOTHING,
  pending,
});

const decide = (forName: string, working?: "approve" | "reject"): QueueAction[] => [
  act("review", "Review", forName, "secondary"),
  act("approve", "Approve", forName, "primary", "check", working === "approve"),
  act("reject", "Reject", forName, "danger-outline", "cross", working === "reject"),
];

const FEATURED = (
  <Badge tone="featured">
    <Icon icon={Star} size="sm" />
    Featured
  </Badge>
);

export const VILLA = "Independent villa with private garden and terrace";
export const FLAT = "3 BHK semi-furnished flat with east-facing balcony";
export const PLOT = "Residential plot, corner site, east-facing";
export const TOWER = "3 BHK apartment with clubhouse and covered parking";
export const LONG_TITLE =
  "Spacious luxury duplex penthouse with private terrace pool, double-height living room, home theatre, servant quarters and four covered car parks";

export const PENDING_ROWS: QueueRow[] = [
  {
    id: "villa",
    title: VILLA,
    meta: "OMR Sholinganallur · Villa · For sale",
    cover: { src: `${PICTURES}/home-a.svg`, alt: "Drawn placeholder: a house with a pitched roof" },
    ownerName: "Priya Raman",
    ownerEmail: "priya.raman@example.com",
    price: "₹2.85 Cr",
    submitted: "Today, 10:12",
    status: <StatusBadge kind="listing" status="pendingReview" />,
    actions: decide(VILLA),
  },
  {
    id: "flat",
    title: FLAT,
    meta: "Velachery · Apartment · For rent",
    cover: { src: `${PICTURES}/home-b.svg`, alt: "Drawn placeholder: a house with a pitched roof" },
    ownerName: "Divya Krishnan",
    ownerEmail: "divya.k@example.com",
    price: "₹48,000/mo",
    submitted: "Yesterday",
    status: <StatusBadge kind="listing" status="pendingReview" />,
    actions: decide(FLAT),
  },
  {
    id: "plot",
    title: PLOT,
    meta: "Medavakkam · Plot · For sale",
    cover: null,
    ownerName: "Karthik S",
    price: "₹46 L",
    submitted: "2 days ago",
    status: <StatusBadge kind="listing" status="pendingReview" />,
    actions: decide(PLOT),
  },
];

/** Rows in the other states: featured, not featured, rejected with its reason, sold, a long title, a working button. */
export const MIXED_ROWS: QueueRow[] = [
  {
    id: "tower-featured",
    title: TOWER,
    meta: "Velachery · Apartment · For sale",
    cover: { src: `${PICTURES}/home-c.svg`, alt: "Drawn placeholder: a house with a pitched roof" },
    ownerName: "Priya Raman",
    ownerEmail: "priya.raman@example.com",
    price: "₹1.25 Cr",
    submitted: "3 days ago",
    status: (
      <>
        <StatusBadge kind="listing" status="live" />
        {FEATURED}
      </>
    ),
    actions: [act("unfeature", "Remove from featured", TOWER, "secondary")],
  },
  {
    id: "villa-approved",
    title: VILLA,
    meta: "OMR Sholinganallur · Villa · For sale",
    cover: { src: `${PICTURES}/home-a.svg`, alt: "Drawn placeholder: a house with a pitched roof" },
    ownerName: "Priya Raman",
    ownerEmail: "priya.raman@example.com",
    price: "₹2.85 Cr",
    submitted: "4 days ago",
    status: <StatusBadge kind="listing" status="live" />,
    actions: [act("feature", "Feature", VILLA, "secondary", "star")],
  },
  {
    id: "flat-rejected",
    title: FLAT,
    meta: "Velachery · Apartment · For rent",
    cover: null,
    ownerName: "Divya Krishnan",
    ownerEmail: "divya.k@example.com",
    price: "₹48,000/mo",
    submitted: "5 days ago",
    status: <StatusBadge kind="listing" status="notApproved" />,
    note: <>Reason: Add a photo of the home itself, not of the street.</>,
    actions: [act("review", "Review", FLAT, "secondary")],
  },
  {
    id: "plot-sold",
    title: PLOT,
    meta: "Medavakkam · Plot · For sale",
    cover: { src: `${PICTURES}/home-b.svg`, alt: "Drawn placeholder: a house with a pitched roof" },
    ownerName: "Karthik S",
    ownerEmail: "karthik@example.com",
    price: "₹46 L",
    submitted: "2 weeks ago",
    status: <StatusBadge kind="listing" status="sold" />,
    actions: [act("review", "Review", PLOT, "secondary")],
  },
  {
    id: "long",
    title: LONG_TITLE,
    meta: "Besant Nagar · Apartment · For sale",
    cover: { src: `${PICTURES}/home-c.svg`, alt: "Drawn placeholder: a house with a pitched roof" },
    ownerName: "Mohammed Abdul Rahman Ansari",
    ownerEmail: "mohammed.abdul.rahman.ansari.properties@example.com",
    price: "₹9.5 Cr",
    submitted: "Today, 09:40",
    status: <StatusBadge kind="listing" status="pendingReview" />,
    actions: decide(LONG_TITLE, "approve"),
  },
];

export function SampleQueue({
  rows: given = PENDING_ROWS,
  tab = "pending",
  footer: wantsFooter = true,
  compact = false,
}: {
  rows?: QueueRow[];
  tab?: string;
  footer?: boolean;
  /** One row and no Show more: a page that fits one screen, for a preview with an overlay open. */
  compact?: boolean;
}) {
  const rows = compact ? given.slice(0, 1) : given;
  const footer = compact ? false : wantsFooter;
  return (
    <Tabs value={tab} onValueChange={NOTHING}>
      <TabsList aria-label="Filter by status">
        <TabsTrigger value="pending" count={14} countTone="new">
          Pending
        </TabsTrigger>
        <TabsTrigger value="approved" count={196}>
          Approved
        </TabsTrigger>
        <TabsTrigger value="rejected" count={9}>
          Rejected
        </TabsTrigger>
        <TabsTrigger value="closed" count={29}>
          Sold or rented
        </TabsTrigger>
        <TabsTrigger value="all" count={248}>
          All
        </TabsTrigger>
      </TabsList>
      <div className="flex flex-col gap-3 py-4 md:flex-row">
        <div className="md:w-60">
          <NativeSelect aria-label="Locality" defaultValue="">
            <option value="">All localities</option>
            <option value="adyar">Adyar</option>
          </NativeSelect>
        </div>
        <div className="md:w-60">
          <NativeSelect aria-label="Type" defaultValue="">
            <option value="">For sale and rent</option>
            <option value="sale">For sale</option>
          </NativeSelect>
        </div>
      </div>
      <TabsContent value={tab} className="flex flex-col gap-4 pt-0">
        <ListingQueue caption="Listings to review" columns={COLUMNS} rows={rows} />
        {footer ? (
          <ShowMore
            shown={rows.length}
            total={14}
            progressLabel={`Showing ${rows.length} of 14`}
            buttonLabel="Show more listings"
            onShowMore={NOTHING}
          />
        ) : null}
      </TabsContent>
    </Tabs>
  );
}

export function SampleEmpty() {
  return (
    <EmptyState
      title="Nothing is waiting for review"
      description="New listings from owners will show up here."
    />
  );
}

const SPECS = [
  { id: "bedrooms", label: "Bedrooms", value: "4 BHK" },
  { id: "area", label: "Area", value: "3,200 sq.ft" },
  { id: "locality", label: "Locality", value: "OMR Sholinganallur" },
  { id: "furnishing", label: "Furnishing", value: "Semi-furnished" },
];

export function SampleReview({
  open,
  onOpenChange = NOTHING,
  state = "pending",
  photos = 3,
}: {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  state?: "pending" | "rejected";
  photos?: number;
}) {
  const pictures = [
    { src: `${PICTURES}/home-a.svg`, alt: "Drawn placeholder: a house with a pitched roof" },
    {
      src: `${PICTURES}/home-b.svg`,
      alt: "Drawn placeholder: a house with a pitched roof, second photo",
    },
    {
      src: `${PICTURES}/home-c.svg`,
      alt: "Drawn placeholder: a house with a pitched roof, third photo",
    },
  ].slice(0, photos);
  const rejected = state === "rejected";
  return (
    <ListingReview
      open={open}
      onOpenChange={onOpenChange}
      title="Review listing"
      closeLabel="Close"
      photosHeading={`Photos (${photos})`}
      photos={pictures}
      noPhotosText="This listing has no photos"
      badges={
        <>
          <Badge tone="outline">For sale</Badge>
          <StatusBadge kind="listing" status={rejected ? "notApproved" : "pendingReview"} />
        </>
      }
      heading={VILLA}
      price="₹2.85 Cr"
      specs={SPECS}
      sections={[
        ...(rejected
          ? [
              {
                id: "reason",
                heading: "Reason it was not approved",
                body: "Add a photo of the home itself, not of the street.",
              },
            ]
          : []),
        {
          id: "description",
          heading: "Description",
          body: "A spacious villa with a private garden and a terrace, in a gated lane close to the IT corridor.",
        },
        {
          id: "address",
          heading: "Address",
          body: "14, Second Cross Street, OMR Sholinganallur, Chennai 600119",
        },
        {
          id: "owner",
          heading: "Owner",
          body: (
            <ReviewFacts
              rows={[
                { id: "name", name: "Name", value: "Priya Raman" },
                { id: "email", name: "Email", value: "priya.raman@example.com" },
                { id: "posted", name: "Posted", value: "Today, 10:12" },
              ]}
            />
          ),
        },
      ]}
      actions={
        rejected
          ? []
          : [
              act("reject", "Reject", VILLA, "danger-outline", "cross"),
              act("approve", "Approve", VILLA, "primary", "check"),
            ]
      }
    />
  );
}

/** The reject dialog, open or closed, with the reason it is given and the error it shows. */
export function SampleReject({
  initiallyOpen = false,
  reason = "",
  error,
  loading = false,
  trigger,
}: {
  initiallyOpen?: boolean;
  reason?: string;
  error?: string;
  loading?: boolean;
  trigger?: string;
}): ReactNode {
  const [open, setOpen] = useState(initiallyOpen);
  const [value, setValue] = useState(reason);
  return (
    <>
      {trigger ? (
        <Button type="button" variant="danger-outline" onClick={() => setOpen(true)}>
          {trigger}
        </Button>
      ) : null}
      <RejectListingDialog
        open={open}
        onOpenChange={setOpen}
        title="Reject this listing?"
        description={`"${VILLA}" stays off Find Prop and the owner will see it as not approved, with the reason you give.`}
        icon={<Icon icon={CircleX} size="lg" />}
        reasonLabel="Reason for the owner"
        reasonHint="The owner reads this, so say what to fix."
        value={value}
        onValueChange={setValue}
        counter={`${value.length} / 500`}
        {...(error ? { error } : {})}
        confirmLabel="Reject listing"
        cancelLabel="Cancel"
        onConfirm={NOTHING}
        loading={loading}
      />
    </>
  );
}

/** The review drawer, opened by a button, for the Lab. */
export function ReviewOpener({ state = "pending" }: { state?: "pending" | "rejected" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        {state === "rejected" ? "Open a rejected listing" : "Open the review drawer"}
      </Button>
      <SampleReview open={open} onOpenChange={setOpen} state={state} />
    </>
  );
}

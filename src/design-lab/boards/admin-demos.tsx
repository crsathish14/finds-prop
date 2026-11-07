import { DeviceFrame, Specimen, Stage } from "../frame";
import { MIXED_ROWS, ReviewOpener, SampleEmpty, SampleQueue, SampleReject } from "./admin-parts";

export function ListingQueueDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Specimen
        label="Pending tab: the tabs with their counts, the two filters, the rows and Show more"
        className="w-full"
      >
        <Stage tone="canvas" className="w-full">
          <SampleQueue />
        </Stage>
      </Specimen>
      <Specimen
        label="All tab: featured and not featured, a rejection with its reason, sold, a very long title with a long owner, and a button that is working"
        className="w-full"
      >
        <Stage tone="canvas" className="w-full">
          <SampleQueue rows={MIXED_ROWS} tab="all" footer={false} />
        </Stage>
      </Specimen>
      <Specimen label="Nothing to review" className="w-full">
        <Stage tone="canvas" className="w-full">
          <SampleEmpty />
        </Stage>
      </Specimen>
      <Specimen
        label="In the admin portal at the two widths that matter (whole-page previews): cards on a phone, a table on a desktop"
        className="w-full"
      >
        <div className="flex w-full flex-wrap items-start gap-6">
          <DeviceFrame preview="admin-listings" size="phone" height="h-200" />
          <DeviceFrame preview="admin-listings" size="desktop" height="h-200" />
        </div>
      </Specimen>
    </div>
  );
}

export function ListingReviewDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Specimen label="Opens from a row's Review button; try it (Escape closes it)">
        <div className="flex flex-wrap gap-3">
          <ReviewOpener />
          <ReviewOpener state="rejected" />
        </div>
      </Specimen>
      <Specimen
        label="Open, on a phone and on a desktop (whole-page previews): the decisions stay in the footer"
        className="w-full"
      >
        <div className="flex w-full flex-wrap items-start gap-6">
          <DeviceFrame preview="admin-review" size="phone" height="h-200" />
          <DeviceFrame preview="admin-review" size="desktop" height="h-200" />
        </div>
      </Specimen>
    </div>
  );
}

export function RejectDialogDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Specimen label="Opens from a row's Reject button; type a reason (the count follows)">
        <div className="flex flex-wrap gap-3">
          <SampleReject trigger="Open the reject dialog" />
          <SampleReject
            trigger="Open with a reason that is too long"
            reason={"a".repeat(512)}
            error="Use at most 500 characters."
          />
          <SampleReject
            trigger="Open while rejecting"
            reason="Add a photo of the home itself."
            loading
          />
        </div>
      </Specimen>
      <Specimen
        label="Open with the reason missing, on a phone (whole-page preview)"
        className="w-full"
      >
        <div className="flex w-full flex-wrap items-start gap-6">
          <DeviceFrame preview="admin-reject" size="phone" height="h-200" />
        </div>
      </Specimen>
    </div>
  );
}

"use client";

import { Info, Trash2 } from "lucide-react";
import { useState } from "react";
import { Alert } from "@/components/patterns/alert";
import { ConfirmDialog } from "@/components/patterns/confirm-dialog";
import { EmptyState } from "@/components/patterns/empty-state";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/patterns/popover";
import { Sheet, SheetContent, SheetTrigger } from "@/components/patterns/sheet";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/components/ui/link";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { notify } from "@/lib/notify";
import { Column, Row, Specimen, Stage } from "../frame";

export function AlertsDemo() {
  return (
    <Column className="max-w-2xl">
      <Alert tone="info" title="Photos are processing">
        They will appear on your listing in a few minutes.
      </Alert>
      <Alert tone="success" title="Listing submitted">
        We will review it and let you know.
      </Alert>
      <Alert
        tone="warning"
        title="Please wait a little"
        action={<Link href="#alerts">Try again</Link>}
      >
        You have sent a few enquiries just now.
      </Alert>
      <Alert tone="danger" title="We could not save your changes">
        Check your connection and try again. Your answers are kept.
      </Alert>
      <Alert tone="neutral">A plain note without a title.</Alert>
    </Column>
  );
}

export function ToastDemo() {
  return (
    <>
      <Row className="items-center">
        <Button variant="secondary" onClick={() => notify.success("Saved to your list")}>
          Success toast
        </Button>
        <Button
          variant="secondary"
          onClick={() => notify.error("Could not save", { description: "Check your connection." })}
        >
          Error toast
        </Button>
        <Button variant="secondary" onClick={() => notify.info("Photos are processing")}>
          Info toast
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            notify.undo("Removed from saved", {
              actionLabel: "Undo",
              onUndo: () => notify.success("Restored"),
            })
          }
        >
          Toast with Undo
        </Button>
      </Row>
    </>
  );
}

export function DialogDemo() {
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState(false);
  return (
    <Row className="items-center">
      <ConfirmDialog
        trigger={<Button variant="danger-outline">Delete listing</Button>}
        icon={<Icon icon={Trash2} size="lg" />}
        title="Delete this listing?"
        description="It will be removed from search at once. You cannot undo this."
        confirmLabel="Delete listing"
        cancelLabel="Keep listing"
        onConfirm={() => notify.success("Listing deleted")}
      />
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        tone="info"
        icon={<Icon icon={Info} size="lg" />}
        title="Mark as sold?"
        description="The listing leaves search at once. You cannot undo this yourself."
        confirmLabel="Mark as sold"
        cancelLabel="Not yet"
        loading={working}
        onConfirm={() => {
          setWorking(true);
          setTimeout(() => {
            setWorking(false);
            setOpen(false);
          }, 800);
        }}
        trigger={<Button variant="secondary">Mark as sold (waits 0.8 s)</Button>}
      />
    </Row>
  );
}

export function SheetDemo() {
  return (
    <Row className="items-center">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="secondary">Bottom sheet</Button>
        </SheetTrigger>
        <SheetContent
          title="Filters"
          closeLabel="Close filters"
          description="Narrow the homes you see"
          footer={<Button>Show 24 homes</Button>}
        >
          <Text>Filter controls go here.</Text>
        </SheetContent>
      </Sheet>
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="secondary">Side drawer</Button>
        </SheetTrigger>
        <SheetContent
          side="right"
          title="Enquire about this home"
          closeLabel="Close enquiry form"
          footer={<Button>Send enquiry</Button>}
        >
          <Text>The enquiry form goes here.</Text>
        </SheetContent>
      </Sheet>
    </Row>
  );
}

export function PopoverTooltipDemo() {
  return (
    <Row className="items-center">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="secondary">Why this price?</Button>
        </PopoverTrigger>
        <PopoverContent>
          <p className="font-bold">About this price</p>
          <p className="mt-1 text-muted">
            The price is entered by the owner and checked before the listing goes live.
          </p>
        </PopoverContent>
      </Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost">Hover or focus me</Button>
        </TooltipTrigger>
        <TooltipContent>
          Tooltips are hints, never the only place information appears.
        </TooltipContent>
      </Tooltip>
    </Row>
  );
}

export function EmptyDemo() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <EmptyState title="No saved homes yet" description="Tap the heart on a home to keep it here.">
        <Button asChild variant="primary">
          <Link href="#empty">Browse homes</Link>
        </Button>
      </EmptyState>
      <EmptyState
        as="h3"
        title="No enquiries yet"
        description="When someone asks about your listing, it shows up here."
      />
    </div>
  );
}

export function LoadingDemo() {
  return (
    <div className="flex flex-col gap-8">
      <Row className="items-center">
        <Specimen label="Spinner sm, md, lg">
          <div className="flex items-center gap-4 text-primary">
            <Spinner label="Loading small" />
            <Spinner size="md" label="Loading medium" />
            <Spinner size="lg" label="Loading large" />
          </div>
        </Specimen>
      </Row>
      <Stage>
        <div className="grid gap-6 md:grid-cols-3" aria-busy="true">
          <div className="flex flex-col gap-3">
            <Skeleton shape="image" />
            <Skeleton shape="title" />
            <Skeleton shape="text" />
            <Skeleton shape="text" className="w-4/5" />
          </div>
          <div className="flex flex-col gap-3">
            <Skeleton shape="row" />
            <Skeleton shape="row" />
            <Skeleton shape="row" />
          </div>
          <div className="flex items-center gap-4">
            <Skeleton shape="circle" className="size-14" />
            <div className="flex flex-1 flex-col gap-3">
              <Skeleton shape="title" />
              <Skeleton shape="text" />
            </div>
          </div>
        </div>
      </Stage>
    </div>
  );
}

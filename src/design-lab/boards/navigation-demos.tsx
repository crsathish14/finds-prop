"use client";

import { LayoutDashboard, LogOut, Settings } from "lucide-react";
import { useState } from "react";
import { ErrorScreen } from "@/components/layout/error-screen";
import { Breadcrumb } from "@/components/patterns/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/patterns/dropdown-menu";
import { Stepper, type Step } from "@/components/patterns/stepper";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/patterns/tabs";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { DeviceFrame, Row, Specimen, Stage } from "../frame";

export function HeaderDemo() {
  return (
    <div className="flex flex-col gap-8">
      <Text tone="muted">
        Signed out: the Post property pill appears from 768 px and the full navigation from 1024 px;
        below that the menu button opens the drawer.
      </Text>
      <Row>
        <DeviceFrame preview="header-signed-out" size="phone" />
        <DeviceFrame preview="header-signed-out" size="tablet" />
      </Row>
      <DeviceFrame preview="header-signed-out" size="desktop" />
      <Text tone="muted">
        Signed in: the saved and notification buttons and the account menu join the right side.
      </Text>
      <Row>
        <DeviceFrame preview="header-signed-in" size="phone" />
        <DeviceFrame preview="header-signed-in" size="tablet" />
      </Row>
      <DeviceFrame preview="header-signed-in" size="desktop" />
    </div>
  );
}

export function BottomBarDemo() {
  return (
    <Row>
      <DeviceFrame preview="bottom-bar" size="phone" />
      <DeviceFrame preview="bottom-bar" size="tablet" />
    </Row>
  );
}

export function FooterDemo() {
  return (
    <div className="flex flex-col gap-8">
      <Row>
        <DeviceFrame preview="footer" size="phone" height="h-200" />
        <DeviceFrame preview="footer" size="tablet" height="h-200" />
      </Row>
      <DeviceFrame preview="footer" size="desktop" height="h-200" />
    </div>
  );
}

export function PortalDemo() {
  return (
    <div className="flex flex-col gap-8">
      <Row>
        <DeviceFrame preview="portal-admin" size="phone" />
        <DeviceFrame preview="portal-admin" size="tablet" />
      </Row>
      <DeviceFrame preview="portal-admin" size="desktop" />
    </div>
  );
}

export function TabsDemo() {
  const [tab, setTab] = useState("listings");
  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList aria-label="Dashboard sections">
        <TabsTrigger value="listings" count={14}>
          Listings
        </TabsTrigger>
        <TabsTrigger value="enquiries" count={3} countTone="new">
          Enquiries
        </TabsTrigger>
        <TabsTrigger value="saved">Saved</TabsTrigger>
        <TabsTrigger value="drafts" disabled>
          Drafts
        </TabsTrigger>
      </TabsList>
      <TabsContent value="listings">Your listings appear here.</TabsContent>
      <TabsContent value="enquiries">Your enquiries appear here.</TabsContent>
      <TabsContent value="saved">Your saved homes appear here.</TabsContent>
    </Tabs>
  );
}

export function MenuDemo() {
  return (
    <Row className="items-start">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary">Row actions</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>Listing</DropdownMenuLabel>
          <DropdownMenuItem icon={<Icon icon={LayoutDashboard} />} meta={3} metaTone="new">
            View enquiries
          </DropdownMenuItem>
          <DropdownMenuItem icon={<Icon icon={Settings} />}>Edit listing</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive icon={<Icon icon={LogOut} />}>
            Mark as sold
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </Row>
  );
}

export function BreadcrumbDemo() {
  return (
    <div className="flex flex-col gap-6">
      <Specimen label="From 1024 px the full trail; below that a single back link">
        <Breadcrumb
          navLabel="Breadcrumb"
          backLabel="Back to Properties"
          items={[
            { label: "Home", href: "#home" },
            { label: "Properties", href: "#properties" },
            { label: "Velachery" },
          ]}
        />
      </Specimen>
    </div>
  );
}

const STEPS: Step[] = [
  { label: "Basics", description: "Type and location", state: "done", stateLabel: "Done" },
  { label: "Details", description: "Rooms and area", state: "current", stateLabel: "Current step" },
  { label: "Photos", description: "At least three", state: "error", stateLabel: "Needs attention" },
  { label: "Price", state: "upcoming" },
  { label: "Review", state: "upcoming" },
];

export function StepperDemo() {
  return (
    <Stage>
      <Stepper steps={STEPS} progressLabel="Step 2 of 5: Details" className="max-w-md" />
    </Stage>
  );
}

export function ErrorScreenDemo() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Specimen label="Not found" className="w-full">
        <Stage tone="canvas" className="w-full">
          <ErrorScreen
            as="div"
            titleAs="h3"
            className="min-h-0 py-6"
            code="Error 404"
            title="This page isn't here"
            emphasis="here"
            description="The link may be old or mistyped. Let's get you back to finding a home."
            actions={<Button>Go home</Button>}
          />
        </Stage>
      </Specimen>
      <Specimen label="Something went wrong, with technical details" className="w-full">
        <Stage tone="canvas" className="w-full">
          <ErrorScreen
            as="div"
            titleAs="h3"
            className="min-h-0 py-6"
            code="Something went wrong"
            title="We couldn't load this page"
            emphasis="this page"
            description="It's on our side, not yours. Try again, or go back home."
            actions={
              <>
                <Button>Try again</Button>
                <Button variant="secondary">Go home</Button>
              </>
            }
            details={{ summary: "Technical details", text: "Reference: 1234567890" }}
          />
        </Stage>
      </Specimen>
    </div>
  );
}

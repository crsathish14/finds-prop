"use client";

import {
  Building2,
  CalendarDays,
  CircleCheck,
  Download,
  Eye,
  Heart,
  Inbox,
  Layers,
  MessageSquare,
  Phone,
  Scale,
  Tag,
  Users,
} from "lucide-react";
import { useState } from "react";
import {
  InsightsPanel,
  type InsightsGroup,
  type InsightsTile,
} from "@/components/domain/insights-panel";
import { Alert } from "@/components/patterns/alert";
import { Icon } from "@/components/ui/icon";
import { Specimen, Stage } from "../frame";

/**
 * The numbers of the builder's Dashboard and Insights pages (S7-T01, part 3), as the admin and the builder will see
 * them. Plain English text and made-up numbers; nothing here goes anywhere. The words come from the approved
 * builder-dashboard and builder-insights screens; the few that do not are listed in ADR-080 for the owner to confirm.
 */

const tile = (
  id: string,
  label: string,
  value: string,
  icon: typeof Eye,
  extra: Partial<InsightsTile> = {},
): InsightsTile => ({
  id,
  label,
  value,
  icon: <Icon icon={icon} size="sm" />,
  ...extra,
});

const PORTFOLIO: InsightsGroup = {
  id: "portfolio",
  label: "Portfolio",
  tiles: [
    tile("projects", "Projects", "4", Building2),
    tile("active", "Active projects", "3", CircleCheck, { note: "Approved and published" }),
    tile("units", "Total units", "520", Layers),
    tile("available", "Available units", "301", Tag, { note: "164 sold" }),
  ],
};

const ACTIVITY: InsightsGroup = {
  id: "activity",
  label: "Activity this month",
  tiles: [
    tile("views", "Project views", "6,420", Eye),
    tile("visitors", "Unique visitors", "3,918", Users),
    tile("enquiries", "Enquiries", "128", MessageSquare, { iconTone: "info" }),
    tile("leads", "Leads", "186", Inbox, { iconTone: "copper" }),
    tile("shortlists", "Shortlists", "342", Heart),
  ],
};

const ACTIONS: InsightsGroup = {
  id: "actions",
  label: "Actions",
  tiles: [
    tile("comparisons", "Comparisons", "97", Scale),
    tile("brochures", "Brochure downloads", "211", Download),
    tile("calls", "Calls", "74", Phone),
    tile("whatsapp", "WhatsApp clicks", "63", MessageSquare),
    tile("visits", "Site visit requests", "29", CalendarDays),
  ],
};

const FULL_ACTIVITY: InsightsGroup = {
  id: "activity",
  label: "Activity",
  tiles: ACTIVITY.tiles,
};

const RANGES = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "month", label: "This month" },
  { value: "custom", label: "Custom" },
];

function Panel({
  groups,
  full = false,
  startRange = "30",
  notice,
  headingLevel = "h2",
  title = "Insights",
  intro = "How visitors find and respond to your projects.",
}: {
  groups: InsightsGroup[];
  full?: boolean;
  startRange?: string;
  notice?: boolean;
  headingLevel?: "h1" | "h2";
  title?: string;
  intro?: string;
}) {
  const [range, setRange] = useState(startRange);
  const [from, setFrom] = useState("2026-10-01");
  const [to, setTo] = useState("2026-10-28");
  const [project, setProject] = useState("");
  return (
    <InsightsPanel
      headingLevel={headingLevel}
      title={title}
      intro={intro}
      range={{ label: "Date range", options: RANGES, value: range, onChange: setRange }}
      customRange={{
        fromLabel: "From",
        toLabel: "To",
        from,
        to,
        onFromChange: setFrom,
        onToChange: setTo,
      }}
      {...(full
        ? {
            project: {
              label: "Project",
              allLabel: "All projects",
              options: [
                { value: "vista", label: "Kadal Vista" },
                { value: "courts", label: "Kadal Courts" },
              ],
              value: project,
              onChange: setProject,
            },
          }
        : {})}
      {...(notice
        ? {
            notice: (
              <Alert tone="warning" title="1 project is waiting for approval">
                Nila Grove was edited and is hidden from the public site until it is approved.
              </Alert>
            ),
          }
        : {})}
      groups={groups}
    />
  );
}

export function InsightsPanelDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Specimen
        label="The builder's Dashboard: three groups of numbers, with a notice above them (try the date choice; Custom shows two dates)"
        className="w-full"
      >
        <Stage tone="canvas" className="w-full">
          <Panel
            title="Dashboard"
            intro="A quick look at how your projects are doing."
            groups={[PORTFOLIO, ACTIVITY, ACTIONS]}
            notice
          />
        </Stage>
      </Specimen>
      <Specimen
        label="The Insights page: the choice of project, and the activity and action numbers (the charts come later)"
        className="w-full"
      >
        <Stage tone="canvas" className="w-full">
          <Panel full groups={[FULL_ACTIVITY, { ...ACTIONS, label: "Actions" }]} />
        </Stage>
      </Specimen>
      <Specimen
        label="With a custom range chosen, and very large numbers and a long note"
        className="w-full"
      >
        <Stage tone="canvas" className="w-full">
          <Panel
            full
            startRange="custom"
            groups={[
              {
                id: "big",
                label: "Activity",
                tiles: [
                  tile("a", "Project views", "1,284,560", Eye),
                  tile("b", "Unique visitors", "912,044", Users),
                  tile("c", "Enquiries", "12,805", MessageSquare, {
                    iconTone: "info",
                    note: "Up from 9,310 in the same period last year, across every project",
                  }),
                  tile("d", "Leads", "18,600", Inbox, { iconTone: "copper" }),
                ],
              },
            ]}
          />
        </Stage>
      </Specimen>
    </div>
  );
}

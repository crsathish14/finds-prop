/**
 * InsightsPanel: how the projects are doing, as groups of numbers, for the admin and for a builder.
 * Purpose: the top of the builder's Dashboard and Insights pages and of the admin's overview (S7-T01, FR-BLD-05,
 *   FR-BLD-06): a choice of dates, an optional choice of project, and the numbers in groups (Portfolio, Activity,
 *   Actions). Owner: design system. It holds no state: the page passes the groups of tiles, already translated and
 *   formatted, and what is chosen. Charts are not part of it: they come with the chart spike (S7-SPK-01, S7-T06) and
 *   go in `children`, under the numbers.
 * Props: title, intro, headingLevel ("h1" default | "h2"), notice (anything above the numbers, such as "1 project is
 *   waiting for approval"), range ({ label (names the group), options: { value, label }[], value, onChange }),
 *   customRange ({ fromLabel, toLabel, from, to, onFromChange, onToChange }, shown while the chosen range is
 *   "custom"), project (the full page only: { label, allLabel, options, value, onChange }), groups ({ id, label,
 *   tiles: { id, label, value, icon, iconTone, note }[] }), children (charts), className.
 * Responsive: it asks its own width: two tiles to a line on a phone, three from 768 px of room, and four or five
 *   (as many as the group has) from 1024 px. A number of seven or more characters is set smaller in a narrow area so it stays
 *   inside its tile, and a tile whose name and icon do not fit side by side puts the icon on a second line. The date choice and the project box wrap under each other on a phone; the date choice is set
 *   tighter in a narrow area so its four buttons fit, and scrolls sideways if they still do not.
 * Accessibility: each group is a labelled region with its own heading, one level under the title; the date choice is a radio group named by
 *   its label; the project box has its name; a tile reads as its label then its value; nothing is said by colour
 *   alone.
 * States: dashboard (three groups, no project box), full page (two groups and a project box), a custom range, a
 *   notice above, a tile with a note, a very large number.
 * Dependencies: StatTile, SegmentedControl, NativeSelect, FormField, Input, Heading, Text.
 *   Tests: insights-panel.test.tsx; Design Lab "Admin" (S7-T01).
 * UX reference: builder-insights and builder-dashboard screens (fp-insightspage, kpi-group, date-row).
 */
import type { ReactNode } from "react";
import { FormField } from "@/components/patterns/form-field";
import { StatTile } from "@/components/patterns/stat-tile";
import { Heading } from "@/components/ui/heading";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

type InsightsTile = {
  id: string;
  label: string;
  value: string;
  icon?: ReactNode;
  iconTone?: "primary" | "copper" | "info" | "warning";
  note?: string;
};

type InsightsGroup = {
  id: string;
  label: string;
  tiles: InsightsTile[];
};

type InsightsPanelProps = {
  title: string;
  intro: string;
  headingLevel?: "h1" | "h2";
  notice?: ReactNode;
  range: {
    label: string;
    options: { value: string; label: string }[];
    value: string;
    onChange: (value: string) => void;
  };
  customRange?: {
    fromLabel: string;
    toLabel: string;
    from: string;
    to: string;
    onFromChange: (value: string) => void;
    onToChange: (value: string) => void;
  };
  project?: {
    label: string;
    allLabel: string;
    options: { value: string; label: string }[];
    value: string;
    onChange: (value: string) => void;
  };
  groups: InsightsGroup[];
  children?: ReactNode;
  className?: string;
};

/** The id that ties a group to its heading. */
function headingId(group: string) {
  return ["insights", group].join("-");
}

function columnsOf(tiles: number) {
  return tiles >= 5 ? "@5xl:grid-cols-5" : "@5xl:grid-cols-4";
}

function InsightsPanel({
  title,
  intro,
  headingLevel = "h1",
  notice,
  range,
  customRange,
  project,
  groups,
  children,
  className,
}: InsightsPanelProps) {
  // The groups sit one level under the title.
  const GroupHeading = headingLevel === "h1" ? "h2" : "h3";
  return (
    <div
      data-slot="insights-panel"
      className={cn("@container flex min-w-0 flex-col gap-5", className)}
    >
      <div className="flex flex-col gap-2">
        <Heading as={headingLevel} size="1">
          {title}
        </Heading>
        <Text tone="muted">{intro}</Text>
      </div>
      {notice}
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
        <div className="max-w-full min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <SegmentedControl
            size="sm"
            className="@max-md:[&>button]:px-2"
            aria-label={range.label}
            options={range.options}
            value={range.value}
            onValueChange={range.onChange}
          />
        </div>
        {customRange && range.value === "custom" ? (
          <div className="flex flex-wrap gap-3">
            <FormField label={customRange.fromLabel}>
              <Input
                type="date"
                value={customRange.from}
                onChange={(event) => customRange.onFromChange(event.target.value)}
              />
            </FormField>
            <FormField label={customRange.toLabel}>
              <Input
                type="date"
                value={customRange.to}
                onChange={(event) => customRange.onToChange(event.target.value)}
              />
            </FormField>
          </div>
        ) : null}
        {project ? (
          <div className="md:w-60">
            <NativeSelect
              aria-label={project.label}
              value={project.value}
              onChange={(event) => project.onChange(event.target.value)}
            >
              <option value="">{project.allLabel}</option>
              {project.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          </div>
        ) : null}
      </div>
      {groups.map((group) => (
        <section
          key={group.id}
          aria-labelledby={headingId(group.id)}
          className="flex flex-col gap-3"
        >
          <GroupHeading id={headingId(group.id)} className="text-overline text-muted">
            {group.label}
          </GroupHeading>
          <div
            className={cn(
              "grid grid-cols-2 gap-3 @3xl:grid-cols-3 [&_[data-slot=stat-tile]>div:first-child]:flex-wrap",
              columnsOf(group.tiles.length),
            )}
          >
            {group.tiles.map((tile) => (
              <StatTile
                key={tile.id}
                label={tile.label}
                value={
                  <span className={cn(tile.value.length > 6 && "@max-md:text-title")}>
                    {tile.value}
                  </span>
                }
                {...(tile.icon ? { icon: tile.icon } : {})}
                {...(tile.iconTone ? { iconTone: tile.iconTone } : {})}
                {...(tile.note ? { note: tile.note } : {})}
              />
            ))}
          </div>
        </section>
      ))}
      {children}
    </div>
  );
}

export { InsightsPanel };
export type { InsightsGroup, InsightsPanelProps, InsightsTile };

/**
 * ProjectsManager: the projects list of the admin and of a builder, in one component with a `mode`.
 * Purpose: the whole of the "Projects" page above its data (S7-T01, FR-ADM-03, FR-BLD-02): the heading and Add
 *   project, the status tabs with their counts, the search box, a table that becomes cards on a phone, a menu on
 *   each row and the line under the list. Owner: design system. It holds no state: the page passes the rows,
 *   already translated, what each button does, and which tab and search are chosen. Rejecting and deleting ask
 *   first in a ConfirmDialog that the page owns, because only the page knows the project.
 * Props: mode ("admin" shows the Builder column and a filter for builders, and the moderation buttons the page
 *   gives each row; "builder" shows a warning that an edit goes back for approval), title, intro, addLabel and
 *   addHref, headingLevel ("h1" default | "h2"), tabs ({ value, label, count, countTone }), tab and onTabChange,
 *   tabsLabel, search ({ value, onChange, label, placeholder }), builderFilter (admin only: { label, allLabel,
 *   options, value, onChange }), columns ({ project, builder, priceRange, status, actions }, the heading words),
 *   caption, rows (see ProjectRow), countText ("6 projects"), reapproval ({ title, text }, builder mode), notice
 *   (anything the page wants above the tabs, such as "This project can't be deleted"), empty ({ title, text }),
 *   className. A row is { id, name, place, cover { src, alt }, builder, priceRange, status (StatusBadge and other
 *   badges), actions (visible buttons: { id, label, forName, tone, icon, onClick or href, pending }), menu (the
 *   "more" menu: { id, label, icon, destructive, disabled, onSelect or href }), moreLabel (the menu button's
 *   name, such as "More actions for Kadal Vista") }.
 * Responsive: the list asks its own width: a table from 1024 px of room, cards below that (the project and its
 *   place, then Builder, Price range and Status with their words, then the buttons). The tabs scroll sideways on
 *   a phone; the search box and the builder filter stack.
 * Accessibility: tabs with counts; a real table with its roles kept in the card layout; every button has a visible
 *   word followed by hidden text naming the project, because several buttons share a word; the menu button has its own name; a
 *   disabled menu item says why in its own words ("Delete (has 128 leads)"); the status is a word, never colour
 *   alone.
 * States: any number of rows; pending, approved (published or not), featured, rejected, draft; a button that is
 *   working; no picture (a drawn tile); a long name; admin and builder mode; nothing yet.
 * Dependencies: ResponsiveTable, Tabs, DropdownMenu, EmptyState, Alert, Button, Input, NativeSelect, CardCover.
 *   Tests: projects-manager.test.tsx; Design Lab "Admin" (S7-T01).
 * UX reference: admin-projects and builder-projects screens (fp-projectspage).
 */
import {
  Check,
  Ellipsis,
  ExternalLink,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import NextLink from "next/link";
import type { ReactNode } from "react";
import { Alert } from "@/components/patterns/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/patterns/dropdown-menu";
import { EmptyState } from "@/components/patterns/empty-state";
import {
  ResponsiveTable,
  type ResponsiveTableColumn,
  type ResponsiveTableRow,
} from "@/components/patterns/responsive-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/patterns/tabs";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Text } from "@/components/ui/text";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { cn } from "@/lib/cn";
import { CardCover } from "./property-card-controls.client";

const ACTION_ICONS = {
  check: Check,
  cross: X,
  upload: Upload,
  edit: Pencil,
  external: ExternalLink,
} as const;

const MENU_ICONS = { edit: Pencil, star: Star, external: ExternalLink, trash: Trash2 } as const;

type ProjectRowAction = {
  id: string;
  /** The visible word, such as "Approve". */
  label: string;
  /** What it acts on, heard after the visible word, such as the project's name. */
  forName: string;
  tone: "primary" | "secondary" | "danger-outline" | "ghost";
  icon?: keyof typeof ACTION_ICONS;
  onClick?: () => void;
  /** A button that goes to another page (Edit, View live) gives an address instead of onClick. */
  href?: string;
  pending?: boolean;
};

type ProjectMenuItem = {
  id: string;
  label: string;
  icon?: keyof typeof MENU_ICONS;
  destructive?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
  href?: string;
};

type ProjectRow = {
  id: string;
  name: string;
  /** Under the name, such as "OMR Navalur". */
  place: string;
  cover?: { src: string; alt: string } | null;
  /** The builder's name: admin mode only. */
  builder?: string;
  priceRange: string;
  status: ReactNode;
  actions: ProjectRowAction[];
  menu?: ProjectMenuItem[];
  moreLabel?: string;
};

type ProjectTab = {
  value: string;
  label: string;
  count: number;
  countTone?: "default" | "new";
};

type ProjectsManagerProps = {
  mode: "admin" | "builder";
  title: string;
  intro: string;
  addLabel: string;
  addHref: string;
  headingLevel?: "h1" | "h2";
  tabs: ProjectTab[];
  tab: string;
  onTabChange: (value: string) => void;
  tabsLabel: string;
  search: {
    value: string;
    onChange: (value: string) => void;
    label: string;
    placeholder: string;
  };
  builderFilter?: {
    label: string;
    allLabel: string;
    options: { value: string; label: string }[];
    value: string;
    onChange: (value: string) => void;
  };
  columns: {
    project: string;
    builder: string;
    priceRange: string;
    status: string;
    actions: string;
  };
  caption: string;
  rows: ProjectRow[];
  countText: string;
  reapproval?: { title: string; text: string };
  notice?: ReactNode;
  empty: { title: string; text: string };
  className?: string;
};

function RowButtons({ row }: { row: ProjectRow }) {
  return (
    <>
      {row.actions.map((action) => {
        const icon = action.icon ? <Icon icon={ACTION_ICONS[action.icon]} size="sm" /> : undefined;
        const words = (
          <>
            {action.label} <VisuallyHidden>{action.forName}</VisuallyHidden>
          </>
        );
        if (action.href) {
          return (
            <Button key={action.id} asChild size="sm" variant={action.tone}>
              <NextLink href={action.href}>
                {icon}
                {words}
              </NextLink>
            </Button>
          );
        }
        return (
          <Button
            key={action.id}
            type="button"
            size="sm"
            variant={action.tone}
            loading={action.pending ?? false}
            {...(action.onClick ? { onClick: action.onClick } : {})}
            {...(icon ? { iconStart: icon } : {})}
          >
            {words}
          </Button>
        );
      })}
      {row.menu && row.menu.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton aria-label={row.moreLabel ?? row.name}>
              <Icon icon={Ellipsis} />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {row.menu.map((item) => {
              const icon = item.icon ? <Icon icon={MENU_ICONS[item.icon]} size="sm" /> : undefined;
              return (
                <MenuEntry key={item.id} item={item} icon={icon} separated={item.destructive} />
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </>
  );
}

function MenuEntry({
  item,
  icon,
  separated,
}: {
  item: ProjectMenuItem;
  icon: ReactNode;
  separated: boolean | undefined;
}) {
  const props = {
    ...(icon ? { icon } : {}),
    ...(item.destructive ? { destructive: true } : {}),
    ...(item.disabled ? { disabled: true } : {}),
  };
  return (
    <>
      {separated ? <DropdownMenuSeparator /> : null}
      {item.href ? (
        <DropdownMenuItem asChild {...props}>
          <NextLink href={item.href}>{item.label}</NextLink>
        </DropdownMenuItem>
      ) : (
        <DropdownMenuItem {...props} {...(item.onSelect ? { onSelect: item.onSelect } : {})}>
          {item.label}
        </DropdownMenuItem>
      )}
    </>
  );
}

function ProjectsManager({
  mode,
  title,
  intro,
  addLabel,
  addHref,
  headingLevel = "h1",
  tabs,
  tab,
  onTabChange,
  tabsLabel,
  search,
  builderFilter,
  columns,
  caption,
  rows,
  countText,
  reapproval,
  notice,
  empty,
  className,
}: ProjectsManagerProps) {
  const admin = mode === "admin";
  const tableColumns: ResponsiveTableColumn[] = [
    { id: "project", heading: columns.project, role: "main", width: admin ? 30 : 38 },
    ...(admin
      ? [{ id: "builder", heading: columns.builder, width: 16 } satisfies ResponsiveTableColumn]
      : []),
    { id: "priceRange", heading: columns.priceRange, align: "end", width: 14, nowrap: true },
    { id: "status", heading: columns.status, width: admin ? 18 : 24 },
    { id: "actions", heading: columns.actions, role: "actions", width: admin ? 22 : 24 },
  ];
  const tableRows: ResponsiveTableRow[] = rows.map((row) => ({
    id: row.id,
    cells: {
      project: (
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative size-14 shrink-0 overflow-hidden rounded-md bg-canvas-sunken">
            <CardCover src={row.cover?.src} alt={row.cover?.alt ?? ""} sizes="56px" />
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <p className="line-clamp-2 font-bold text-ink [overflow-wrap:anywhere]">{row.name}</p>
            <p className="text-small text-muted [overflow-wrap:anywhere]">{row.place}</p>
          </div>
        </div>
      ),
      builder: <span className="text-ink [overflow-wrap:anywhere]">{row.builder}</span>,
      priceRange: <span className="font-bold text-ink tabular-nums">{row.priceRange}</span>,
      status: <div className="flex flex-wrap items-center gap-2">{row.status}</div>,
      actions: <RowButtons row={row} />,
    },
  }));

  return (
    <div data-slot="projects-manager" className={cn("flex min-w-0 flex-col gap-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Heading as={headingLevel} size="1">
            {title}
          </Heading>
          <Text tone="muted">{intro}</Text>
        </div>
        <Button asChild variant="primary">
          <NextLink href={addHref}>
            <Icon icon={Plus} size="sm" />
            {addLabel}
          </NextLink>
        </Button>
      </div>
      {!admin && reapproval ? (
        <Alert tone="warning" title={reapproval.title}>
          {reapproval.text}
        </Alert>
      ) : null}
      {notice}
      <Tabs value={tab} onValueChange={onTabChange}>
        <TabsList aria-label={tabsLabel}>
          {tabs.map((item) => (
            <TabsTrigger
              key={item.value}
              value={item.value}
              count={item.count}
              {...(item.countTone ? { countTone: item.countTone } : {})}
            >
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <div className="flex flex-col gap-3 py-4 md:flex-row">
          <div className="md:grow">
            <Input
              type="search"
              aria-label={search.label}
              placeholder={search.placeholder}
              value={search.value}
              onChange={(event) => search.onChange(event.target.value)}
              leading={<Icon icon={Search} />}
            />
          </div>
          {admin && builderFilter ? (
            <div className="md:w-60">
              <NativeSelect
                aria-label={builderFilter.label}
                value={builderFilter.value}
                onChange={(event) => builderFilter.onChange(event.target.value)}
              >
                <option value="">{builderFilter.allLabel}</option>
                {builderFilter.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
          ) : null}
        </div>
        <TabsContent value={tab} className="flex flex-col gap-4 pt-0">
          {rows.length === 0 ? (
            <EmptyState title={empty.title} description={empty.text}>
              <Button asChild variant="primary">
                <NextLink href={addHref}>
                  <Icon icon={Plus} size="sm" />
                  {addLabel}
                </NextLink>
              </Button>
            </EmptyState>
          ) : (
            <>
              <ResponsiveTable caption={caption} columns={tableColumns} rows={tableRows} />
              <p className="text-small text-muted">{countText}</p>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export { ProjectsManager };
export type { ProjectMenuItem, ProjectRow, ProjectRowAction, ProjectsManagerProps, ProjectTab };

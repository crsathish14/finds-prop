"use client";

/**
 * SiteLocalitiesEditor: the list of curated localities of the admin's Homepage page: for each one a label, a latitude
 * and a longitude, and how far a search reaches from it.
 * Purpose: the places the home page shows as "Explore by locality" tiles and, for the first four, as Popular chips in
 *   the search card (S7-T10, FR-ADM-10, ADD-11, DEC-13). Owner: design system. It holds no list of its own: the page
 *   keeps the rows, the errors and the words (already translated). The order of the rows is the order on the site.
 *   Coordinates are typed for now; a place picker will fill the same two boxes when the place search exists (ADR-096).
 * Props: localities ({ id, label, lat, lng, radiusKm }[], all text as typed; an id is kept by the page and never
 *   shown), onChange (the new list), max (how many the list may hold), radii (the distances offered, in km),
 *   defaultRadius (the distance a new row starts with), errors (the message of each box with a problem, by row id),
 *   disabled (while saving), words (the headings, labels, hints and notes), className. A row can be dragged or moved
 *   with the arrows; a distance the row already holds that is not offered is kept and shown too.
 * Responsive: on a phone every box is on its own line; from 768 px the label has a line and the latitude, the longitude
 *   and the radius share the next. The grip and the two arrows are 44 px targets (SortableRow).
 * Accessibility: every box has a visible label and an accessible name that includes the row's place ("Label 2");
 *   problems show an icon and words tied to their box; the buttons say which locality they move or remove; at the limit
 *   Add is off and a note says so; the list is a named group.
 * States: empty, some localities, at the limit, with errors on rows, disabled.
 * Dependencies: SortableList, SortableRow, FormField, Input, NativeSelect, Button, Alert, Icon, cn. Tests:
 *   site-content-parts.test.tsx; Design Lab "Site content" (S7-T10).
 * UX reference: admin-localities screen (the Explore by locality panel). The "Place" box is two boxes, Latitude and
 *   Longitude, until the place search is built; the radius choices include 6 km, which the stored data already uses.
 */
import { MapPin, Plus, Trash2 } from "lucide-react";
import { Alert } from "@/components/patterns/alert";
import { FormField } from "@/components/patterns/form-field";
import { SortableList, SortableRow } from "@/components/patterns/sortable-list";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/cn";

type SiteLocalityRow = { id: string; label: string; lat: string; lng: string; radiusKm: string };

type SiteLocalityErrors = Partial<Record<"label" | "lat" | "lng" | "radiusKm", string>>;

type SiteLocalitiesWords = {
  title: string;
  description: string;
  add: string;
  /** The notice at the limit: a heading and a line. */
  limitTitle: string;
  limitText: string;
  /** The note shown instead of the rows when there are none. */
  emptyTitle: string;
  emptyText: string;
  orderHint: string;
  /** Names a row with its place: "Locality" makes "Locality 2". */
  row: string;
  label: string;
  lat: string;
  lng: string;
  radius: string;
  /** The unit after a distance: "km". */
  km: string;
  remove: string;
  drag: string;
  moveUp: string;
  moveDown: string;
};

type SiteLocalitiesEditorProps = {
  localities: readonly SiteLocalityRow[];
  onChange: (localities: SiteLocalityRow[]) => void;
  max: number;
  radii: readonly number[];
  defaultRadius: number;
  errors?: Readonly<Record<string, SiteLocalityErrors>>;
  disabled?: boolean;
  words: SiteLocalitiesWords;
  className?: string;
};

function SiteLocalitiesEditor({
  localities,
  onChange,
  max,
  radii,
  defaultRadius,
  errors = {},
  disabled = false,
  words,
  className,
}: SiteLocalitiesEditorProps) {
  const atLimit = localities.length >= max;
  const ids = localities.map((place) => place.id);

  const change = (id: string, patch: Partial<Omit<SiteLocalityRow, "id">>) =>
    onChange(localities.map((place) => (place.id === id ? { ...place, ...patch } : place)));

  const reorder = (order: string[]) => {
    const byId = new Map(localities.map((place) => [place.id, place]));
    onChange(order.flatMap((id) => byId.get(id) ?? []));
  };

  const add = () =>
    onChange([
      ...localities,
      {
        id: globalThis.crypto.randomUUID(),
        label: "",
        lat: "",
        lng: "",
        radiusKm: String(defaultRadius),
      },
    ]);

  const addButton = (
    <Button
      type="button"
      variant="primary"
      size="sm"
      disabled={disabled || atLimit}
      iconStart={<Icon icon={Plus} size="sm" />}
      onClick={add}
    >
      {words.add}
    </Button>
  );

  return (
    <section
      aria-labelledby="site-localities-title"
      data-slot="site-localities-editor"
      className={cn(
        "flex min-w-0 flex-col gap-5 rounded-xl border border-line bg-surface p-4 md:p-6",
        className,
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id="site-localities-title" className="text-title font-bold text-ink">
            {words.title}
          </h2>
          <p className="text-small text-muted">{words.description}</p>
        </div>
        {localities.length > 0 ? addButton : null}
      </header>
      {atLimit ? (
        <Alert tone="neutral" title={words.limitTitle}>
          {words.limitText}
        </Alert>
      ) : null}
      {localities.length === 0 ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-dashed border-line-strong bg-canvas p-4"
        >
          <Icon icon={MapPin} className="mt-1 shrink-0 text-muted" />
          <div className="flex min-w-0 flex-col items-start gap-1">
            <p className="font-bold text-ink">{words.emptyTitle}</p>
            <p className="text-small text-muted">{words.emptyText}</p>
            <div className="mt-2">{addButton}</div>
          </div>
        </div>
      ) : (
        <SortableList ids={ids} onReorder={reorder}>
          {localities.map((place, index) => {
            const position = index + 1;
            const name = place.label.trim() || `${words.row} ${position}`;
            const problems = errors[place.id] ?? {};
            const shown = radii.includes(Number(place.radiusKm))
              ? radii
              : [...radii, Number(place.radiusKm)]
                  .filter((km) => Number.isFinite(km))
                  .sort((first, second) => first - second);
            const problem = (box: keyof SiteLocalityErrors) =>
              problems[box] ? { error: problems[box] } : {};
            return (
              <SortableRow
                key={place.id}
                id={place.id}
                labels={{
                  drag: `${words.drag}: ${name}`,
                  moveUp: `${words.moveUp}: ${name}`,
                  moveDown: `${words.moveDown}: ${name}`,
                }}
              >
                <div
                  role="group"
                  aria-label={`${words.row} ${position}`}
                  className="flex min-w-0 flex-col gap-3"
                >
                  <FormField label={words.label} {...problem("label")}>
                    <Input
                      value={place.label}
                      disabled={disabled}
                      maxLength={60}
                      autoComplete="off"
                      aria-label={`${words.label} ${position}`}
                      onChange={(event) => change(place.id, { label: event.target.value })}
                    />
                  </FormField>
                  <div className="grid gap-3 md:grid-cols-3">
                    <FormField label={words.lat} {...problem("lat")}>
                      <Input
                        value={place.lat}
                        disabled={disabled}
                        inputMode="decimal"
                        autoComplete="off"
                        aria-label={`${words.lat} ${position}`}
                        onChange={(event) => change(place.id, { lat: event.target.value })}
                      />
                    </FormField>
                    <FormField label={words.lng} {...problem("lng")}>
                      <Input
                        value={place.lng}
                        disabled={disabled}
                        inputMode="decimal"
                        autoComplete="off"
                        aria-label={`${words.lng} ${position}`}
                        onChange={(event) => change(place.id, { lng: event.target.value })}
                      />
                    </FormField>
                    <FormField label={words.radius} {...problem("radiusKm")}>
                      <NativeSelect
                        value={place.radiusKm}
                        disabled={disabled}
                        aria-label={`${words.radius} ${position}`}
                        onChange={(event) => change(place.id, { radiusKm: event.target.value })}
                      >
                        {shown.map((km) => (
                          <option key={km} value={String(km)}>
                            {km} {words.km}
                          </option>
                        ))}
                      </NativeSelect>
                    </FormField>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={disabled}
                      aria-label={`${words.remove}: ${name}`}
                      iconStart={<Icon icon={Trash2} size="sm" />}
                      className="text-danger"
                      onClick={() => onChange(localities.filter((one) => one.id !== place.id))}
                    >
                      {words.remove}
                    </Button>
                  </div>
                </div>
              </SortableRow>
            );
          })}
        </SortableList>
      )}
      {localities.length > 0 ? <p className="text-caption text-muted">{words.orderHint}</p> : null}
    </section>
  );
}

export { SiteLocalitiesEditor };
export type { SiteLocalitiesEditorProps, SiteLocalitiesWords, SiteLocalityErrors, SiteLocalityRow };

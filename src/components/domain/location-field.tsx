"use client";

/**
 * LocationField: where a property is, in the post-property form (no map).
 * Purpose: the address step asks for a place the owner picks from suggestions, so the listing gets a
 *   position and shows up in searches by place (OLA_MAPS_PLAN.md D4, ADR-131; FR-GEO-02). If no suggestion
 *   fits, the owner chooses the area instead, and the middle of the area is used. Owner: design system. It
 *   holds no state and fetches nothing: the form owns the mode and the choice, and passes the suggestion
 *   box or the area chooser as `box`.
 * Props: mode ("search" the owner is finding the address | "area" the owner is choosing the area | "found" a
 *   place is held), box (the place search box in "search", the area chooser in "area"; a Combobox with
 *   usePlacePanel and a NativeSelect of areas), found ({ label, detail, approximate }), onChange (the
 *   "Change" button of "found"), onChooseArea ("I can't find it"), onSearchAddress ("Search for the address
 *   instead"), unavailable (suggestions cannot be fetched: a warning is shown and the area is asked for),
 *   showError (the form was sent with no place: "Add a location to continue."), privacyHref ("/privacy" by
 *   default), className.
 * Responsive: one column at every width; the buttons wrap under the text on a narrow screen.
 * Accessibility: a group named by its title; the hint and the provider note are read with the box; the error
 *   is an alert and is also named as the group's description; "Change" and the two link-buttons are real buttons.
 * States: search, area, found (exact), found (approximate), unavailable, error.
 * Dependencies: Button, Alert, Icon, Link, next-intl. Tests: location-field.test.tsx; Design Lab
 *   "Location field" (ADR-131).
 * UX reference: UX addendum ADD-08 (post-address) without its map and pin: the map pin is left out by the
 *   owner (17 Nov 2026), so the pin, its three map states and its wording are not drawn; the rest of the
 *   step is as drawn. Drawn from existing parts for the owner's approval.
 */
import { CircleAlert, CircleCheck, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, type ReactNode } from "react";
import { Alert } from "@/components/patterns/alert";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/components/ui/link";
import { cn } from "@/lib/cn";

type LocationFound = { label: string; detail?: string | undefined; approximate: boolean };

type LocationFieldProps = {
  mode: "search" | "area" | "found";
  box?: ReactNode;
  found?: LocationFound | undefined;
  onChange?: () => void;
  onChooseArea?: () => void;
  onSearchAddress?: () => void;
  unavailable?: boolean;
  showError?: boolean;
  privacyHref?: string;
  className?: string;
};

function LocationField({
  mode,
  box,
  found,
  onChange,
  onChooseArea,
  onSearchAddress,
  unavailable = false,
  showError = false,
  privacyHref = "/privacy",
  className,
}: LocationFieldProps) {
  const translate = useTranslations();
  const ids = useId();
  const titleId = `${ids}-title`;
  const errorId = `${ids}-error`;
  const searching = mode === "search";
  return (
    <div
      data-slot="location-field"
      role="group"
      aria-labelledby={titleId}
      aria-describedby={showError ? errorId : undefined}
      className={cn("flex flex-col gap-3", className)}
    >
      <div className="flex flex-col gap-1">
        <span id={titleId} className="text-small font-semibold text-ink">
          {translate(searching ? "domain.locationField.title" : "domain.locationField.areaTitle")}
          <span aria-hidden="true" className="text-danger">
            {" "}
            *
          </span>
        </span>
        {mode === "found" ? null : (
          <span className="text-caption text-muted">
            {translate(searching ? "domain.locationField.hint" : "domain.locationField.areaHint")}
          </span>
        )}
      </div>

      {unavailable && mode !== "found" ? (
        <Alert tone="warning" title={translate("domain.places.unavailable.title")}>
          {translate("domain.locationField.unavailableBody")}
        </Alert>
      ) : null}

      {mode === "found" && found ? (
        <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-pill bg-primary-tint text-primary">
              <Icon icon={found.approximate ? MapPin : CircleCheck} size="sm" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-caption font-semibold text-muted">
                {translate(
                  found.approximate
                    ? "domain.locationField.approximateTitle"
                    : "domain.locationField.foundTitle",
                )}
              </span>
              <span className="text-title-sm text-ink">{found.label}</span>
              {found.detail ? <span className="text-small text-muted">{found.detail}</span> : null}
            </div>
            <Button variant="ghost" size="sm" onClick={onChange}>
              {translate("domain.locationField.change")}
            </Button>
          </div>
          {found.approximate ? (
            <p className="text-small text-muted">
              {translate("domain.locationField.approximateNote")}
            </p>
          ) : null}
          <p className="text-small text-muted">{translate("domain.locationField.visitorsSee")}</p>
        </div>
      ) : (
        <>
          {box}
          {searching ? (
            <p className="text-caption text-muted">
              {translate("domain.locationField.providerNote")}{" "}
              <Link href={privacyHref}>{translate("domain.locationField.privacy")}</Link>
            </p>
          ) : null}
          <div>
            {searching ? (
              <Button variant="ghost" size="sm" onClick={onChooseArea}>
                {translate("domain.locationField.chooseArea")}
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={onSearchAddress}>
                {translate("domain.locationField.searchInstead")}
              </Button>
            )}
          </div>
        </>
      )}

      {showError ? (
        <p id={errorId} role="alert" className="flex items-center gap-2 text-small text-danger">
          <Icon icon={CircleAlert} size="sm" />
          {translate("domain.locationField.required")}
        </p>
      ) : null}
    </div>
  );
}

export { LocationField };
export type { LocationFieldProps, LocationFound };

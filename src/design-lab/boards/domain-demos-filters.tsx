"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { FilterFields, FilterRail, FilterSheet } from "@/components/domain/filters";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import type { FilterValues } from "@/config/search-options";
import { Specimen } from "../frame";

/** The twelve Chennai localities of the approved UX, which the page would normally supply. */
const LOCALITIES = [
  "OMR Sholinganallur",
  "OMR Navalur",
  "OMR Siruseri",
  "Perungudi",
  "Velachery",
  "Adyar",
  "Besant Nagar",
  "Anna Nagar",
  "T Nagar",
  "Porur",
  "Guindy",
  "Medavakkam",
];
const ALL_LOCALITIES = "All of Chennai";

const NOTHING: FilterValues = {
  intent: "all",
  locality: null,
  propertyType: null,
  bedrooms: null,
  maxBudget: null,
  sort: "newest",
};

const FILLED: FilterValues = {
  intent: "buy",
  locality: "Velachery",
  propertyType: "apartment",
  bedrooms: 3,
  maxBudget: 1_50_00_000,
  sort: "newest",
};

function RailHost({ initial }: { initial: FilterValues }) {
  const [values, setValues] = useState(initial);
  return (
    <FilterRail
      values={values}
      onChange={setValues}
      localities={LOCALITIES}
      allLocalitiesLabel={ALL_LOCALITIES}
    />
  );
}

/** The rail is 280 px wide in the UX; on a phone the page shows the sheet instead. */
const RAIL_WIDTH = "w-70 max-w-full";

export function FilterRailDemo() {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-wrap items-start gap-x-8 gap-y-8">
        <Specimen label="Buy, Velachery, Apartment, 3 BHK, up to ₹1.5 Cr (the UX's example)">
          <div className={RAIL_WIDTH}>
            <RailHost initial={FILLED} />
          </div>
        </Specimen>
        <Specimen label="Nothing set: All, All of Chennai, Any type, Any, Any budget">
          <div className={RAIL_WIDTH}>
            <RailHost initial={NOTHING} />
          </div>
        </Specimen>
        <Specimen label="Rent: the budget list is monthly rents">
          <div className={RAIL_WIDTH}>
            <RailHost
              initial={{ ...FILLED, intent: "rent", locality: "Adyar", maxBudget: 25_000 }}
            />
          </div>
        </Specimen>
        <Specimen label="A locality that is not in the list is added to it">
          <div className={RAIL_WIDTH}>
            <RailHost
              initial={{
                ...FILLED,
                locality: "Thiruvanmiyur, beside the Old Mahabalipuram Road",
                propertyType: "plot",
                bedrooms: null,
              }}
            />
          </div>
        </Specimen>
      </div>
      <Text tone="muted">
        Every change applies at once. Clear all sets the locality, kind of property, bedrooms and
        budget back to Any and leaves Looking to alone. The page makes the rail sticky and shows it
        from 1024 px; below that the Filters button opens the sheet.
      </Text>
    </div>
  );
}

function SheetHost({ initial, count }: { initial: FilterValues; count: number }) {
  const [values, setValues] = useState(initial);
  return (
    <FilterSheet
      values={values}
      onApply={setValues}
      localities={LOCALITIES}
      allLocalitiesLabel={ALL_LOCALITIES}
      resultCount={count}
    />
  );
}

export function FilterSheetDemo() {
  const [draft, setDraft] = useState<FilterValues>(FILLED);
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-wrap items-start gap-x-8 gap-y-6">
        <Specimen label="Nothing set: a plain Filters button (press it to open the real sheet)">
          <SheetHost initial={NOTHING} count={120} />
        </Specimen>
        <Specimen label="Four filters set: the count is on the button and in its name">
          <SheetHost initial={FILLED} count={48} />
        </Specimen>
      </div>
      <Specimen label="The open sheet, drawn here so it can be compared (the real one opens over the page)">
        <div className="flex w-full max-w-sm flex-col overflow-hidden rounded-t-xl border border-line bg-surface shadow-modal">
          <span
            aria-hidden="true"
            className="mx-auto mt-3 h-1.5 w-11 rounded-pill bg-line-strong"
          />
          <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
            <p className="text-h3 text-primary">Filters</p>
            <IconButton aria-label="Close filters" type="button">
              <Icon icon={X} />
            </IconButton>
          </div>
          <div className="px-6 py-6">
            <FilterFields
              showSort
              values={draft}
              onChange={setDraft}
              localities={LOCALITIES}
              allLocalitiesLabel={ALL_LOCALITIES}
            />
          </div>
          <div className="flex gap-3 border-t border-line px-6 py-4">
            <Button type="button" variant="ghost">
              Clear all
            </Button>
            <Button type="button" variant="accent" className="flex-1">
              Show 48 homes
            </Button>
          </div>
        </div>
      </Specimen>
      <Text tone="muted">
        The sheet keeps its choices until Show is pressed; closing it any other way throws them
        away. Clear all resets the four filters and leaves the sheet open. The button says Show
        homes while the page has no count, and Show 1 home for one.
      </Text>
    </div>
  );
}

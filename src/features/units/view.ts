import { UNIT_STATUSES, type UnitStatus } from "./constants";

/** One unit as the admin's Units page shows it (S7-T07). Numbers stay numbers; the screen formats them. */
export interface UnitView {
  id: string;
  unitNumber: string;
  floor: number | null;
  bhk: number | null;
  areaSqft: number | null;
  /** The word the database holds, such as "North-east". */
  facing: string | null;
  /** Rupees. */
  price: number | null;
  /** yyyy-mm-dd */
  availableFrom: string | null;
  floorPlanUrl: string | null;
  status: UnitStatus;
}

/** One page of the list, and the number of units the filters match in all. */
export interface UnitsPage {
  units: UnitView[];
  total: number;
  /** The unit number to read after, or null when this is the last page. */
  nextCursor: string | null;
}

/** The project picker's choices. */
export interface ProjectOption {
  id: string;
  name: string;
}

/** What the database returns for a unit; `area_sqft` is a numeric, which may arrive as text. */
export interface UnitDbRow {
  id: string;
  unit_number: string;
  floor_number: number | null;
  bhk: number | null;
  area_sqft: number | string | null;
  facing: string | null;
  price: number | string | null;
  available_from: string | null;
  floor_plan_path: string | null;
  status: string;
}

const isStatus = (value: string): value is UnitStatus =>
  (UNIT_STATUSES as readonly string[]).includes(value);

const asNumber = (value: number | string | null): number | null => {
  if (value === null) return null;
  const converted = typeof value === "number" ? value : Number(value);
  return Number.isFinite(converted) ? converted : null;
};

/** Pure: the rows as views. A row with a state this page does not know is left out, and counted, so one odd row never breaks the list. */
export function toUnitViews(rows: UnitDbRow[]): { units: UnitView[]; skipped: number } {
  const units: UnitView[] = [];
  let skipped = 0;
  for (const row of rows) {
    if (!isStatus(row.status)) {
      skipped += 1;
      continue;
    }
    units.push({
      id: row.id,
      unitNumber: row.unit_number,
      floor: row.floor_number,
      bhk: row.bhk,
      areaSqft: asNumber(row.area_sqft),
      facing: row.facing,
      price: asNumber(row.price),
      availableFrom: row.available_from,
      floorPlanUrl: row.floor_plan_path,
      status: row.status,
    });
  }
  return { units, skipped };
}

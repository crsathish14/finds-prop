import { useLocale, useTranslations } from "next-intl";
import { ScrollFade } from "@/components/patterns/scroll-fade.client";
import { StatusBadge } from "@/components/patterns/status-badge";
import { cn } from "@/lib/cn";
import { formatArea, formatPrice, type Translate } from "@/lib/format";
import type { ProjectUnit } from "./types";
import { UNIT_BADGE_STATUS } from "./view";

const HEAD = "px-4 py-3 text-left text-small font-semibold whitespace-nowrap text-muted";
const CELL = "px-4 py-3 text-body whitespace-nowrap text-ink lining-nums";
const NONE = "–";

/**
 * The units of a project as a table (UX: Unit, Floor, BHK, Area, Facing, Price, Status), with the status
 * as a badge (a word, a dot and a colour) and a footer that says how many are drawn of how many there are.
 * On a phone the table scrolls sideways with a soft fade at the edge, and the first column stays in
 * view. A detail the developer did not give is a dash, never a blank or a zero. It fetches nothing.
 */
export function UnitsTable({
  units,
  total,
  labelledBy,
}: {
  units: readonly ProjectUnit[];
  /** How many units the project has in all. */
  total: number;
  labelledBy: string;
}) {
  const translate = useTranslations("projects.page.units");
  const words = useTranslations() as unknown as Translate;
  const locale = useLocale();
  return (
    <div>
      <ScrollFade labelledBy={labelledBy}>
        <table aria-labelledby={labelledBy} className="w-full min-w-2xl border-collapse text-left">
          <thead>
            <tr className="bg-canvas-sunken">
              <th scope="col" className={cn(HEAD, "sticky left-0 z-10 bg-canvas-sunken")}>
                {translate("unit")}
              </th>
              <th scope="col" className={HEAD}>
                {translate("floor")}
              </th>
              <th scope="col" className={HEAD}>
                {translate("bhk")}
              </th>
              <th scope="col" className={HEAD}>
                {translate("area")}
              </th>
              <th scope="col" className={HEAD}>
                {translate("facing")}
              </th>
              <th scope="col" className={HEAD}>
                {translate("price")}
              </th>
              <th scope="col" className={HEAD}>
                {translate("status")}
              </th>
            </tr>
          </thead>
          <tbody>
            {units.map((unit) => (
              <tr key={unit.number} className="border-t border-line">
                <th
                  scope="row"
                  className={cn(CELL, "sticky left-0 z-10 bg-surface text-left font-bold")}
                >
                  {unit.number}
                </th>
                <td className={CELL}>{unit.floor ?? NONE}</td>
                <td className={CELL}>{unit.bhk ?? NONE}</td>
                <td className={CELL}>
                  {unit.areaSqft === null ? NONE : formatArea(words, locale, unit.areaSqft)}
                </td>
                <td className={CELL}>{unit.facing?.trim() ? unit.facing : NONE}</td>
                <td className={CELL}>
                  {unit.price === null ? NONE : formatPrice(words, locale, unit.price)}
                </td>
                <td className={CELL}>
                  <StatusBadge kind="unit" status={UNIT_BADGE_STATUS[unit.status]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollFade>
      <p className="mt-3 flex flex-wrap items-center justify-between gap-2 text-small text-muted">
        <span>{translate("showing", { shown: units.length, total })}</span>
        <span className="md:hidden">{translate("swipe")}</span>
      </p>
    </div>
  );
}

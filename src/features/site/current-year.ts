import "server-only";
import { cacheLife } from "next/cache";
import { calendarYear } from "@/lib/format";

/**
 * The year for the footer's copyright line. Reading the clock is not allowed while a page is being
 * prerendered, but is allowed inside a cache, so it is read here and kept for a day. After New
 * Year the line can be out of date by up to a day.
 */
export async function getCurrentYear(): Promise<number> {
  "use cache";
  cacheLife("days");
  return calendarYear(new Date());
}

/**
 * Promotion start and end dates in the admin (ADR-210): the "Starts on" and "Ends on" boxes, the India-time note,
 * the Scheduled, Running or Ended tag, and the pure helpers behind them. Their own feature, with nothing server-only,
 * so the settings pages (site content) and the moderation screens (homes and projects) can use them in the browser.
 */
export { datesOf, NO_DATES, statusOfTyped, typedDatesOf } from "./promotion-dates-form";
export type { PromotionDatesValue } from "./promotion-dates-form";
export {
  PromotionDatesFields,
  PromotionDatesNote,
  PromotionStatusTag,
} from "./promotion-dates-fields.client";
export type { PromotionDatesFieldsProps } from "./promotion-dates-fields.client";

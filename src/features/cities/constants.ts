/** The cookie that remembers the visitor's city (a city key, never personal data). */
export const CITY_COOKIE = "fp_city";

/** The city shown when nobody has chosen one (owner, 22 Nov). */
export const DEFAULT_CITY_KEY = "chennai";
export const DEFAULT_CITY_NAME = "Chennai";

/** How long the choice is remembered: one year, in seconds. */
export const CITY_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

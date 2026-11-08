import type { BuilderFormField, BuilderFormValues } from "@/components/domain/builder-form";
import { formatDate, formatListedAgo, formatTime, type Translate } from "@/lib/format";
import type { BuilderRowView } from "./view";

/** The invite form when it opens: nothing typed, a builder (not an agent). */
export const EMPTY_BUILDER_VALUES: BuilderFormValues = {
  name: "",
  email: "",
  kind: "builder",
  contactPerson: "",
  phone: "",
  logoUrl: "",
  website: "",
  description: "",
};

/** The edit form when it opens: what is on record, with a blank box for anything not given. */
export function valuesOf(row: BuilderRowView): BuilderFormValues {
  return {
    name: row.name,
    email: row.email,
    kind: row.kind,
    contactPerson: row.contactPerson ?? "",
    phone: row.phone ?? "",
    logoUrl: row.logoUrl ?? "",
    website: row.website ?? "",
    description: row.description ?? "",
  };
}

/** What the box is called in the forms' answers: the field names the schemas use, narrowed to the ones with a box. */
export function isFormField(field: string): field is BuilderFormField {
  return [
    "name",
    "email",
    "kind",
    "contactPerson",
    "phone",
    "logoUrl",
    "website",
    "description",
  ].includes(field);
}

/** Two letters for the round mark before a name: the first letters of the first two words. */
export function initialsOf(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter((word) => word !== "")
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? "")
    .join("");
  return letters.toUpperCase();
}

const DAY_MS = 86_400_000;

/**
 * When a builder last signed in, as the table says it: "Hasn't signed in yet", "Today, 9:40 am" (the same day in
 * India time), then "1 day ago", "3 days ago", "2 months ago". `now` is when the page was read (the screen never reads the clock).
 */
export function lastSignInText(
  translate: Translate,
  locale: string,
  lastSignInAt: string | null,
  now: number,
): string {
  if (lastSignInAt === null) return translate("admin.builders.neverSignedIn");
  if (formatDate(locale, lastSignInAt, "short") === formatDate(locale, new Date(now), "short")) {
    return translate("admin.builders.signedInToday", {
      time: formatTime(locale, lastSignInAt),
    });
  }
  const age = (now - new Date(lastSignInAt).getTime()) / DAY_MS;
  return formatListedAgo(translate, Math.max(1, age));
}

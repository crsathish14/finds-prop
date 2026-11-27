import {
  PROPERTY_TYPES_BY_PROJECT_TYPE,
  RENT_PRICE_TYPES,
  SALE_PRICE_TYPES,
  type ProjectType,
  type PropertyType,
} from "./constants";

/**
 * Which boxes of the project form apply to which kind of project (ADR-148). Pure: the schema, the service and the form
 * all ask these, so the three cannot disagree. Values are plain text (a box left empty is "") because the form holds
 * text; a value that is not one of ours applies to nothing.
 */

const isProjectType = (value: string): value is ProjectType =>
  Object.hasOwn(PROPERTY_TYPES_BY_PROJECT_TYPE, value);

/** The property types a project type offers; none while the project type is not chosen. */
export function propertyTypesFor(projectType: string): readonly PropertyType[] {
  return isProjectType(projectType) ? PROPERTY_TYPES_BY_PROJECT_TYPE[projectType] : [];
}

/** True when the property type goes with the project type. */
export function propertyTypeFits(projectType: string, propertyType: string): boolean {
  return (propertyTypesFor(projectType) as readonly string[]).includes(propertyType);
}

/**
 * Every project says whether it is for sale or for rent (ADR-214: a residential one may be for rent too). A residential
 * project left empty is for sale, as every residential project was before; a commercial one must choose.
 */
export function offerTypeApplies(projectType: string): boolean {
  return projectType === "commercial" || projectType === "residential";
}

/** Only a commercial project must choose sale or rent; a residential one left empty is for sale. */
export function offerTypeRequired(projectType: string): boolean {
  return projectType === "commercial";
}

/** A residential project for rent is priced per month only (ADR-214). */
const RESIDENTIAL_RENT_PRICE_TYPES = ["rent_per_month"] as const;

/**
 * The price types that can be chosen: the rent ones for a commercial project for rent, rent per month for a residential
 * project for rent, the sale ones otherwise.
 */
export function priceTypesFor(projectType: string, offerType: string): readonly string[] {
  if (offerType !== "rent") return SALE_PRICE_TYPES;
  if (projectType === "commercial") return RENT_PRICE_TYPES;
  if (projectType === "residential") return RESIDENTIAL_RENT_PRICE_TYPES;
  return SALE_PRICE_TYPES;
}

/** A security deposit and maintenance per month are asked only of a project for rent (ADR-214). */
export function rentAmountsApply(projectType: string, offerType: string): boolean {
  return offerTypeApplies(projectType) && offerType === "rent";
}

/** Bedrooms are asked only for a residential apartment or villa. */
export function bedroomsApply(projectType: string, propertyType: string): boolean {
  return (
    projectType === "residential" && (propertyType === "apartment" || propertyType === "villa")
  );
}

/** A plot says whether it is an investment plot or ready to build (ADR-160). */
export function plotStatusApplies(propertyType: string): boolean {
  return propertyType === "plot";
}

/** A villa says what kind of villa it is (ADR-160), residential or commercial. */
export function villaTypeApplies(propertyType: string): boolean {
  return propertyType === "villa";
}

/** A smallest and largest area are asked for a plot and for every commercial project. */
export function areaApplies(projectType: string, propertyType: string): boolean {
  return propertyType === "plot" || projectType === "commercial";
}

/** A possession month is asked while the project is still to be built. A ready project has none. */
export function possessionApplies(projectStatus: string): boolean {
  return projectStatus === "new_launch" || projectStatus === "under_construction";
}

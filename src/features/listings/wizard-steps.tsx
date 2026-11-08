import { useTranslations } from "next-intl";
import type { ReactNode, Ref } from "react";
import { AmenityChips } from "@/components/domain/amenity-chips";
import { ChoiceCards } from "@/components/domain/choice-cards";
import { NextSteps } from "@/components/domain/next-steps";
import { ReviewList } from "@/components/domain/review-list";
import { FormField } from "@/components/patterns/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { fieldErrorText, type Translator } from "@/i18n/failure-text";
import { formatArea, formatPrice, type Translate } from "@/lib/format";
import { AMENITY_OPTIONS, DESCRIPTION_MAX, STATE_NAME, TITLE_MAX } from "./constants";
import { hasBedrooms, type StepErrors, type WizardStep, type WizardValues } from "./wizard-state";

/**
 * The five steps of the post-property wizard as they are drawn (S6-T02, FR-ACC-06). Each takes what the
 * boxes hold and what is wrong, and calls `onChange` for a change; none keeps state or reaches the server (the
 * wizard does). The step's heading takes focus when the step changes, so a screen reader hears where it is.
 */
type ChangeHandler = <Field extends keyof WizardValues>(
  field: Field,
  value: WizardValues[Field],
) => void;

type StepProps = {
  values: WizardValues;
  errors: StepErrors;
  onChange: ChangeHandler;
  headingRef: Ref<HTMLHeadingElement>;
  disabled?: boolean;
};

const PROPERTY_TYPES = ["apartment", "villa", "house", "plot", "commercial"] as const;
const FURNISHINGS = ["unfurnished", "semi", "full"] as const;
const BEDROOM_CHOICES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const BATHROOM_CHOICES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function StepHeading({
  headingRef,
  title,
  lead,
}: {
  headingRef: Ref<HTMLHeadingElement>;
  title: string;
  lead: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <h2 ref={headingRef} tabIndex={-1} className="text-h3 text-primary outline-none">
        {title}
      </h2>
      <p className="text-body text-muted">{lead}</p>
    </div>
  );
}

function useFieldText(errors: StepErrors) {
  const translate = useTranslations() as unknown as Translator;
  return (field: string): string | undefined => {
    const found = errors[field];
    return found ? fieldErrorText(translate, found) : undefined;
  };
}

/** Passes an error to a FormField only when there is one (the prop does not take undefined). */
const errorProp = (message: string | undefined) => (message ? { error: message } : {});

export function BasicsStep({ values, errors, onChange, headingRef, disabled }: StepProps) {
  const words = useTranslations("postProperty.basics");
  const errorText = useFieldText(errors);
  const typeLabels = {
    apartment: words("typeApartment"),
    villa: words("typeVilla"),
    house: words("typeHouse"),
    plot: words("typePlot"),
    commercial: words("typeCommercial"),
  } as const;
  return (
    <div className="flex flex-col gap-5">
      <StepHeading headingRef={headingRef} title={words("heading")} lead={words("lead")} />
      <ChoiceCards
        legend={words("iWantTo")}
        name="listing-type"
        value={values.listingType}
        onChange={(value) => onChange("listingType", value)}
        error={errorText("listingType")}
        disabled={disabled ?? false}
        options={[
          { value: "sale", label: words("sell"), hint: words("sellHint") },
          { value: "rent", label: words("rent"), hint: words("rentHint") },
        ]}
      />
      <FormField label={words("propertyType")} {...errorProp(errorText("propertyType"))}>
        <NativeSelect
          value={values.propertyType}
          disabled={disabled ?? false}
          onChange={(event) => onChange("propertyType", event.target.value)}
        >
          {PROPERTY_TYPES.map((type) => (
            <option key={type} value={type}>
              {typeLabels[type]}
            </option>
          ))}
        </NativeSelect>
      </FormField>
      <FormField
        label={words("address")}
        required
        hint={words("addressHint")}
        {...errorProp(errorText("address"))}
      >
        <Input
          value={values.address}
          autoComplete="street-address"
          disabled={disabled ?? false}
          onChange={(event) => onChange("address", event.target.value)}
        />
      </FormField>
      <div className="grid gap-5 md:grid-cols-2">
        <FormField label={words("locality")} required {...errorProp(errorText("locality"))}>
          <Input
            value={values.locality}
            disabled={disabled ?? false}
            onChange={(event) => onChange("locality", event.target.value)}
          />
        </FormField>
        <FormField label={words("city")} required {...errorProp(errorText("city"))}>
          <Input
            value={values.city}
            autoComplete="address-level2"
            disabled={disabled ?? false}
            onChange={(event) => onChange("city", event.target.value)}
          />
        </FormField>
        <FormField label={words("state")} hint={words("stateHint")}>
          <Input value={STATE_NAME} readOnly />
        </FormField>
        <FormField label={words("pincode")} required {...errorProp(errorText("pincode"))}>
          <Input
            value={values.pincode}
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={6}
            disabled={disabled ?? false}
            onChange={(event) => onChange("pincode", event.target.value)}
          />
        </FormField>
      </div>
    </div>
  );
}

export function DetailsStep({ values, errors, onChange, headingRef, disabled }: StepProps) {
  const words = useTranslations("postProperty.details");
  const errorText = useFieldText(errors);
  const furnishingLabels = {
    unfurnished: words("unfurnished"),
    semi: words("semi"),
    full: words("full"),
  } as const;
  const toggle = (value: string) =>
    onChange(
      "amenities",
      values.amenities.includes(value)
        ? values.amenities.filter((item) => item !== value)
        : [...values.amenities, value],
    );
  return (
    <div className="flex flex-col gap-5">
      <StepHeading headingRef={headingRef} title={words("heading")} lead={words("lead")} />
      <div className="grid gap-5 md:grid-cols-3">
        {hasBedrooms(values.propertyType) ? (
          <FormField label={words("bedrooms")} {...errorProp(errorText("bhk"))}>
            <NativeSelect
              value={values.bhk}
              disabled={disabled ?? false}
              onChange={(event) => onChange("bhk", event.target.value)}
            >
              <option value="" />
              {BEDROOM_CHOICES.map((count) => (
                <option key={count} value={String(count)}>
                  {count}
                </option>
              ))}
            </NativeSelect>
          </FormField>
        ) : null}
        <FormField label={words("bathrooms")} {...errorProp(errorText("bathrooms"))}>
          <NativeSelect
            value={values.bathrooms}
            disabled={disabled ?? false}
            onChange={(event) => onChange("bathrooms", event.target.value)}
          >
            <option value="" />
            {BATHROOM_CHOICES.map((count) => (
              <option key={count} value={String(count)}>
                {count}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label={words("area")} required {...errorProp(errorText("areaSqft"))}>
          <Input
            value={values.areaSqft}
            inputMode="decimal"
            disabled={disabled ?? false}
            onChange={(event) => onChange("areaSqft", event.target.value)}
          />
        </FormField>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <FormField
          label={words("price")}
          required
          hint={words("priceHint")}
          {...errorProp(errorText("price"))}
        >
          <Input
            value={values.price}
            inputMode="numeric"
            disabled={disabled ?? false}
            onChange={(event) => onChange("price", event.target.value)}
          />
        </FormField>
        <FormField label={words("furnishing")} {...errorProp(errorText("furnishing"))}>
          <NativeSelect
            value={values.furnishing}
            disabled={disabled ?? false}
            onChange={(event) => onChange("furnishing", event.target.value)}
          >
            <option value="">{words("furnishingNone")}</option>
            {FURNISHINGS.map((kind) => (
              <option key={kind} value={kind}>
                {furnishingLabels[kind]}
              </option>
            ))}
          </NativeSelect>
        </FormField>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-small font-semibold text-ink">{words("amenities")}</span>
        <AmenityChips
          label={words("amenities")}
          options={AMENITY_OPTIONS.map((amenity) => ({ value: amenity, label: amenity }))}
          selected={values.amenities}
          onToggle={toggle}
          disabled={disabled ?? false}
        />
      </div>
    </div>
  );
}

export function PhotosStepFrame({
  headingRef,
  children,
  error,
}: {
  headingRef: Ref<HTMLHeadingElement>;
  children: ReactNode;
  error?: string | undefined;
}) {
  const words = useTranslations("postProperty.photos");
  return (
    <div className="flex flex-col gap-5">
      <StepHeading headingRef={headingRef} title={words("heading")} lead={words("lead")} />
      {children}
      {error ? (
        <p role="alert" className="text-small text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function DescriptionStep({ values, errors, onChange, headingRef, disabled }: StepProps) {
  const words = useTranslations("postProperty.describe");
  const errorText = useFieldText(errors);
  const length = values.title.trim().length;
  return (
    <div className="flex flex-col gap-5">
      <StepHeading headingRef={headingRef} title={words("heading")} lead={words("lead")} />
      <FormField
        label={words("title")}
        required
        hint={`${words("titleHint")} ${words("counter", { count: length, max: TITLE_MAX })}`}
        {...errorProp(errorText("title"))}
      >
        <Input
          value={values.title}
          disabled={disabled ?? false}
          onChange={(event) => onChange("title", event.target.value)}
        />
      </FormField>
      <FormField
        label={words("description")}
        optionalLabel={words("optional")}
        {...errorProp(errorText("description"))}
      >
        <Textarea
          value={values.description}
          maxLength={DESCRIPTION_MAX}
          disabled={disabled ?? false}
          onChange={(event) => onChange("description", event.target.value)}
        />
      </FormField>
    </div>
  );
}

function wholeNumber(text: string): number | null {
  const plain = text.replace(/[,\s]/g, "");
  if (plain === "") return null;
  const parsed = Number(plain);
  return Number.isFinite(parsed) ? parsed : null;
}

export function ReviewStep({
  values,
  photoCount,
  onEdit,
  headingRef,
  copy,
}: {
  values: WizardValues;
  photoCount: number;
  onEdit: (step: WizardStep) => void;
  headingRef: Ref<HTMLHeadingElement>;
  /** The heading and the "what happens next" line when a sent listing is being edited (S6-T05); the new listing's by default. */
  copy?: { heading: string; nextBody: string };
}) {
  const words = useTranslations("postProperty.review");
  const types = useTranslations("postProperty.basics");
  const root = useTranslations() as unknown as Translate;
  const typeLabels = {
    apartment: types("typeApartment"),
    villa: types("typeVilla"),
    house: types("typeHouse"),
    plot: types("typePlot"),
    commercial: types("typeCommercial"),
  } as const;
  const type = typeLabels[values.propertyType as keyof typeof typeLabels] ?? values.propertyType;
  const area = wholeNumber(values.areaSqft);
  const price = wholeNumber(values.price);
  const areaText = area === null ? "" : formatArea(root, "en", area);
  const size = hasBedrooms(values.propertyType)
    ? words("sizeWithBedrooms", {
        bhk: values.bhk === "" ? "–" : values.bhk,
        baths: values.bathrooms === "" ? "–" : values.bathrooms,
        area: areaText,
      })
    : areaText;
  const priceText =
    price === null
      ? ""
      : values.listingType === "rent"
        ? words("rentPrice", { price: formatPrice(root, "en", price) })
        : formatPrice(root, "en", price);
  const row = (id: string, label: string, value: ReactNode, step: WizardStep) => ({
    id,
    label,
    value,
    editText: words("edit"),
    editFor: label.toLowerCase(),
    onEdit: () => onEdit(step),
  });
  return (
    <div className="flex flex-col gap-5">
      <StepHeading
        headingRef={headingRef}
        title={copy?.heading ?? words("heading")}
        lead={words("lead")}
      />
      <ReviewList
        rows={[
          row(
            "listing",
            words("listing"),
            values.listingType === "rent" ? words("forRent", { type }) : words("forSale", { type }),
            1,
          ),
          row(
            "address",
            words("address"),
            [values.address, values.locality, values.city, STATE_NAME, values.pincode]
              .filter((part) => part.trim() !== "")
              .join(", "),
            1,
          ),
          row("size", words("size"), size, 2),
          row("price", words("price"), priceText, 2),
          row("photos", words("photos"), words("photoCount", { count: photoCount }), 3),
          row("title", words("title"), values.title, 4),
        ]}
      />
      <NextSteps title={words("nextTitle")}>{copy?.nextBody ?? words("nextBody")}</NextSteps>
    </div>
  );
}

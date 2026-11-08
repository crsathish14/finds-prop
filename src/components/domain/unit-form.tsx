/**
 * UnitForm: the fields of the Add unit and Edit unit drawer.
 * Purpose: what the admin or a builder fills in for one unit of a project (S7-T01, FR-ADM-05, FR-BLD-03): its
 *   number, floor, bedrooms, area, facing, price, state, the date it is available from and a link to its floor
 *   plan. Owner: design system. It holds no state: the page keeps the values and the errors, and sends the
 *   form (the drawer's footer button sends it by `id`).
 * Props: id (the form's id, for the drawer's button), values ({ unitNumber, floor, bhk, area, facing, price,
 *   status, availableFrom, floorPlanUrl }, all text), errors (a message for a field, already translated),
 *   onChange (field, value), onSubmit (the form was sent: the page stops the browser's own send), disabled (while
 *   sending), words ({ unitNumber, floor, bhk, area, facing, price, status, availableFrom, floorPlanUrl, optional,
 *   notSet, bhkOptions, facingOptions, statusOptions } with options as { value, label }), className.
 * Responsive: one column on a phone, two from 768 px; the unit number takes the whole first line.
 * Accessibility: every box has its label; the number is marked required; an error is a message tied to its box,
 *   with an icon, never colour alone; the numbers open the number keyboard on a phone.
 * States: empty, filled, with errors, sending (every box off).
 * Dependencies: FormField, Input, NativeSelect. Tests: unit-form.test.tsx; Design Lab "Admin" (S7-T01).
 * UX reference: admin-units screen (the Add unit drawer).
 */
import type { FormEvent } from "react";
import { FormField } from "@/components/patterns/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/cn";

type UnitFormField =
  | "unitNumber"
  | "floor"
  | "bhk"
  | "area"
  | "facing"
  | "price"
  | "status"
  | "availableFrom"
  | "floorPlanUrl";

type UnitFormValues = Record<UnitFormField, string>;

type UnitFormOption = { value: string; label: string };

type UnitFormWords = {
  unitNumber: string;
  floor: string;
  bhk: string;
  area: string;
  facing: string;
  price: string;
  status: string;
  availableFrom: string;
  floorPlanUrl: string;
  /** "(optional)". */
  optional: string;
  /** The choice that means nothing is picked, such as "Not set". */
  notSet: string;
  bhkOptions: UnitFormOption[];
  facingOptions: UnitFormOption[];
  statusOptions: UnitFormOption[];
};

type UnitFormProps = {
  id: string;
  values: UnitFormValues;
  errors?: Partial<Record<UnitFormField, string>>;
  onChange: (field: UnitFormField, value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  words: UnitFormWords;
  className?: string;
};

function UnitForm({
  id,
  values,
  errors = {},
  onChange,
  onSubmit,
  disabled = false,
  words,
  className,
}: UnitFormProps) {
  const text = (field: UnitFormField) => ({
    value: values[field],
    disabled,
    onChange: (event: { target: { value: string } }) => onChange(field, event.target.value),
  });
  const error = (field: UnitFormField) => (errors[field] ? { error: errors[field] } : {});
  return (
    <form
      id={id}
      noValidate
      data-slot="unit-form"
      className={cn("flex flex-col gap-5", className)}
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <FormField label={words.unitNumber} required {...error("unitNumber")}>
        <Input {...text("unitNumber")} maxLength={30} autoComplete="off" />
      </FormField>
      <div className="grid gap-5 md:grid-cols-2">
        <FormField label={words.floor} optionalLabel={words.optional} {...error("floor")}>
          <Input {...text("floor")} inputMode="numeric" autoComplete="off" />
        </FormField>
        <FormField label={words.bhk} optionalLabel={words.optional} {...error("bhk")}>
          <NativeSelect {...text("bhk")}>
            <option value="">{words.notSet}</option>
            {words.bhkOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label={words.area} optionalLabel={words.optional} {...error("area")}>
          <Input {...text("area")} inputMode="decimal" autoComplete="off" />
        </FormField>
        <FormField label={words.facing} optionalLabel={words.optional} {...error("facing")}>
          <NativeSelect {...text("facing")}>
            <option value="">{words.notSet}</option>
            {words.facingOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label={words.price} optionalLabel={words.optional} {...error("price")}>
          <Input {...text("price")} inputMode="numeric" autoComplete="off" />
        </FormField>
        <FormField label={words.status} {...error("status")}>
          <NativeSelect {...text("status")}>
            {words.statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField
          label={words.availableFrom}
          optionalLabel={words.optional}
          {...error("availableFrom")}
        >
          <Input {...text("availableFrom")} type="date" autoComplete="off" />
        </FormField>
        <FormField
          label={words.floorPlanUrl}
          optionalLabel={words.optional}
          {...error("floorPlanUrl")}
        >
          <Input
            {...text("floorPlanUrl")}
            type="url"
            inputMode="url"
            maxLength={300}
            autoComplete="off"
          />
        </FormField>
      </div>
    </form>
  );
}

export { UnitForm };
export type { UnitFormField, UnitFormOption, UnitFormProps, UnitFormValues, UnitFormWords };

"use client";

/**
 * Select: a dropdown drawn by the site, so the open list matches the rest of the design.
 * Purpose: short lists (property type, bedrooms, budget, status). Built on Radix Select, so the
 *   list is a themed panel instead of the browser's grey picker. Owner: design system. For a list
 *   the visitor types into, use Combobox; for a list of actions, use DropdownMenu.
 * Props: value / defaultValue / onChange (receives { target: { value, name } }), name, id, disabled,
 *   required, invalid (sets aria-invalid), variant ("field" boxed, "inline" for a field that already
 *   has its own box, as in the search card), className (applies to the trigger); children are
 *   <option> elements (fragments and arrays are fine) whose text is already translated. An option
 *   with value="" is the "nothing chosen" row and is shown as a muted placeholder.
 * Responsive: 52 px tall, full width of its container. The list is as wide as the trigger and never
 *   taller than the space on screen.
 * Accessibility: Radix listbox: arrow keys, type-ahead, Home/End, Escape. Pair it with a Label
 *   (the id goes on the trigger).
 * States: default, hover, focus, open, error, disabled; each option: highlighted, selected, disabled.
 * Dependencies: radix Select, cn, Icon. Tests: inputs.test.tsx; Design Lab "Fields" (S2-T07).
 * UX reference: ds-components, Fields (c-core.css .select).
 */
import { Check, ChevronDown } from "lucide-react";
import { Select as SelectPrimitive } from "radix-ui";
import {
  Children,
  Fragment,
  isValidElement,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
  useState,
} from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";

/** Radix does not allow an empty item value, so the "nothing chosen" row uses this stand-in. */
const EMPTY_VALUE = "__empty__";

type SelectChangeEvent = { target: { value: string; name: string } };

type SelectOption = { value: string; label: ReactNode; disabled: boolean };

type SelectProps = {
  value?: string | undefined;
  defaultValue?: string | undefined;
  onChange?: ((event: SelectChangeEvent) => void) | undefined;
  name?: string | undefined;
  id?: string | undefined;
  disabled?: boolean | undefined;
  required?: boolean | undefined;
  invalid?: boolean | undefined;
  variant?: "field" | "inline" | undefined;
  className?: string | undefined;
  children?: ReactNode;
  "aria-label"?: string | undefined;
  "aria-labelledby"?: string | undefined;
  "aria-describedby"?: string | undefined;
  "aria-invalid"?: boolean | "true" | "false" | undefined;
  "aria-required"?: boolean | "true" | "false" | undefined;
};

function readOptions(children: ReactNode): SelectOption[] {
  const options: SelectOption[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === Fragment) {
      options.push(
        ...readOptions((child as ReactElement<{ children?: ReactNode }>).props.children),
      );
      return;
    }
    if (child.type === "option") {
      const props = child.props as ComponentProps<"option">;
      const label = props.children;
      const value = props.value === undefined ? String(label ?? "") : String(props.value);
      options.push({ value, label, disabled: props.disabled === true });
    }
  });
  return options;
}

const toItemValue = (value: string) => (value === "" ? EMPTY_VALUE : value);

function Select({
  value,
  defaultValue,
  onChange,
  name,
  id,
  disabled,
  required,
  invalid,
  variant = "field",
  className,
  children,
  ...aria
}: SelectProps) {
  const [inner, setInner] = useState(defaultValue ?? "");
  const current = value ?? inner;
  const options = readOptions(children);
  const inline = variant === "inline";

  function choose(next: string) {
    const real = next === EMPTY_VALUE ? "" : next;
    if (value === undefined) setInner(real);
    onChange?.({ target: { value: real, name: name ?? "" } });
  }

  return (
    <SelectPrimitive.Root
      value={toItemValue(current)}
      onValueChange={choose}
      disabled={disabled}
      required={required}
    >
      <SelectPrimitive.Trigger
        id={id}
        data-slot="select"
        value={current}
        aria-required={
          required ||
          aria["aria-required"] === true ||
          aria["aria-required"] === "true" ||
          undefined
        }
        aria-invalid={invalid || aria["aria-invalid"] === true || aria["aria-invalid"] === "true"}
        aria-label={aria["aria-label"]}
        aria-labelledby={aria["aria-labelledby"]}
        aria-describedby={aria["aria-describedby"]}
        className={cn(
          "group flex w-full min-w-0 cursor-pointer items-center justify-between gap-2 text-left outline-none",
          inline
            ? "h-6 truncate bg-transparent text-small font-semibold text-ink @xl:text-body"
            : [
                "min-h-(--size-control) rounded-md border-[length:var(--bw-field)] border-line-input bg-surface px-4",
                "text-body font-medium text-ink transition-colors duration-(--dur-fast) hover:border-primary",
                "focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-offset-1",
                "data-[state=open]:border-primary",
                "aria-invalid:border-[length:var(--bw-error)] aria-invalid:border-danger",
                "disabled:cursor-not-allowed disabled:border-line-strong disabled:bg-canvas-sunken disabled:text-muted",
              ],
          current === "" && inline && "font-normal text-muted",
          className,
        )}
      >
        <span className="min-w-0 flex-1 truncate">
          <SelectPrimitive.Value />
        </span>
        <SelectPrimitive.Icon className="shrink-0 text-muted transition-transform duration-(--dur-fast) group-data-[state=open]:rotate-180">
          <Icon icon={ChevronDown} size={inline ? "sm" : "md"} />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          data-slot="select-content"
          position="popper"
          sideOffset={6}
          collisionPadding={16}
          className={cn(
            "z-menu max-h-(--radix-select-content-available-height) min-w-(--radix-select-trigger-width) overflow-hidden",
            "rounded-lg border border-line-strong bg-surface text-ink shadow-pop",
          )}
        >
          <SelectPrimitive.Viewport className="flex max-h-72 flex-col gap-1 overflow-y-auto p-2">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={toItemValue(option.value)}
                data-value={option.value}
                disabled={option.disabled}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-3 text-title-sm outline-none select-none",
                  "data-[highlighted]:bg-canvas-sunken data-[state=checked]:bg-primary-tint data-[state=checked]:font-semibold",
                  "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
                  option.value === "" && "text-muted",
                )}
              >
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="ml-auto text-primary">
                  <Icon icon={Check} size="sm" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
      {name ? <input type="hidden" name={name} value={current} disabled={disabled} /> : null}
    </SelectPrimitive.Root>
  );
}

export { Select };
export type { SelectChangeEvent, SelectProps };

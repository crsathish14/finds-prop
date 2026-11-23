/**
 * JobFilters: the search box and the four filters above the Careers list.
 * Purpose: let a visitor narrow the open jobs on /careers by words, department, place, work mode and type
 *   (ADR-143 section 4). Owner: design system. Everything lives in the address, so a filtered list can be shared and
 *   works without scripts: it is a plain form that sends its boxes by GET (`q`, `department`, `location`, `mode`,
 *   `type`). It holds no state: the page passes the chosen values, the options and the summary line.
 * Props: action (the page's path), search ({ value }), filters (the four choices, each { name (the address's word),
 *   label, allLabel (the "nothing chosen" row), value, options: { value, label }[] }), summary (the line under the
 *   bar, such as "12 open jobs" or "3 jobs match"), clearHref (shown while anything is chosen), className.
 * Responsive: the search box and its button share a line from 768 px and stack below; the four choices are one
 *   column on a phone, two from 768 px and four from 1024 px.
 * Accessibility: the form is a search landmark; every box has a visible label tied to it (the search box a hidden
 *   one); the summary is a polite live region.
 * States: nothing chosen, words typed, one or several filters chosen, no option beyond "all" in a list, a long place
 *   name.
 * Dependencies: Input, Button, FormField, Select, Link, Icon, Text, next-intl, cn. Tests: job-parts.test.tsx; Design
 *   Lab "Careers" (ADR-143).
 * UX reference: none yet; drawn for the owner's approval (the Careers list, ADR-143 section 4).
 */
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { FormField } from "@/components/patterns/form-field";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Link } from "@/components/ui/link";
import { Select } from "@/components/ui/select";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

type JobFilterChoice = {
  name: string;
  label: string;
  allLabel: string;
  value: string;
  options: { value: string; label: string }[];
};

type JobFiltersProps = {
  action: string;
  search: { value: string };
  filters: JobFilterChoice[];
  summary: string;
  clearHref?: string | undefined;
  className?: string;
};

function JobFilters({ action, search, filters, summary, clearHref, className }: JobFiltersProps) {
  const translate = useTranslations();
  return (
    <div data-slot="job-filters" className={cn("flex flex-col gap-4", className)}>
      <form role="search" action={action} method="get" className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="md:grow">
            <Input
              type="search"
              name="q"
              aria-label={translate("careers.filters.searchLabel")}
              placeholder={translate("careers.filters.searchPlaceholder")}
              defaultValue={search.value}
              maxLength={200}
              autoComplete="off"
              leading={<Icon icon={Search} />}
            />
          </div>
          <Button type="submit" variant="primary">
            {translate("careers.filters.submit")}
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {filters.map((filter) => (
            <FormField key={filter.name} label={filter.label}>
              <Select name={filter.name} defaultValue={filter.value}>
                <option value="">{filter.allLabel}</option>
                {filter.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </FormField>
          ))}
        </div>
      </form>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <Text tone="muted" variant="small" role="status" aria-live="polite">
          {summary}
        </Text>
        {clearHref ? (
          <Link href={clearHref} variant="default" className="text-small">
            {translate("careers.filters.clear")}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export { JobFilters };
export type { JobFilterChoice, JobFiltersProps };

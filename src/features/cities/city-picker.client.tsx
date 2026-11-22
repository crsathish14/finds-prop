"use client";

import { Check, ChevronDown, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/patterns/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { CITY_COOKIE, CITY_COOKIE_MAX_AGE } from "./constants";
import type { CityOption } from "./list";

type CityPickerProps = {
  cities: CityOption[];
  selectedKey: string;
  /** Already translated: the button's name for a screen reader (it contains the visible city name), and the menu heading. */
  labels: { button: string; heading: string };
};

/**
 * The header's city selector: a button with the city name that opens the list of cities that have homes.
 * Choosing one remembers it in a cookie (no sign-in needed) and refreshes the page so the homepage
 * sections follow it. The server never trusts the cookie: it checks it against the listed cities.
 */
export function CityPicker({ cities, selectedKey, labels }: CityPickerProps) {
  const router = useRouter();
  const selected = cities.find((city) => city.key === selectedKey) ?? cities[0];
  if (!selected) return null;

  function choose(key: string) {
    if (key === selectedKey) return;
    // eslint-disable-next-line react-hooks/immutability -- the cookie is the one place the choice is kept
    document.cookie = `${CITY_COOKIE}=${encodeURIComponent(key)}; path=/; max-age=${CITY_COOKIE_MAX_AGE}; samesite=lax`;
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={labels.button}
        className="inline-flex h-(--size-icon-btn) max-w-32 items-center gap-1 rounded-pill px-2 text-body font-semibold text-primary hover:bg-canvas-sunken md:max-w-48 md:px-3"
      >
        <Icon icon={MapPin} size="sm" />
        <span className="truncate">{selected.name}</span>
        <Icon icon={ChevronDown} size="sm" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
        <DropdownMenuLabel>{labels.heading}</DropdownMenuLabel>
        {cities.map((city) => (
          <DropdownMenuItem
            key={city.key}
            icon={
              city.key === selectedKey ? (
                <Icon icon={Check} size="sm" />
              ) : (
                <span className="size-4" />
              )
            }
            aria-current={city.key === selectedKey ? "true" : undefined}
            onSelect={() => choose(city.key)}
          >
            {city.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

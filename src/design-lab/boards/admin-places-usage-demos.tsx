"use client";

import { PlacesUsageCard, type PlacesUsage } from "@/components/domain/places-usage-card";
import { Text } from "@/components/ui/text";
import { Specimen } from "../frame";

const CALLERS = [
  { id: "search_box", label: "Search box", calls: 5_420 },
  { id: "listing_form", label: "Post form", calls: 1_130 },
  { id: "admin_picker", label: "Admin pickers", calls: 86 },
  { id: "ai_chat", label: "AI chat", calls: 312 },
];

/** A repeatable run of 30 days: a base, a weekly swing and a slow rise (so every picture is the same). */
const DAYS = Array.from({ length: 30 }, (_unused, index) => ({
  label: `${index + 1} Oct`,
  detailLabel: `${index + 1} Oct 2026`,
  calls: Math.round(150 + 40 * Math.sin(index / 1.1) + (index * 60) / 29),
}));

const WITH_CALLS: PlacesUsage = {
  days: DAYS,
  today: 212,
  month: 6_948,
  callers: CALLERS,
  outcomes: { ok: 6_702, empty: 214, timeout: 0, quota: 0, error: 0 },
};

const WITH_PROBLEMS: PlacesUsage = {
  ...WITH_CALLS,
  outcomes: { ok: 6_402, empty: 214, timeout: 38, quota: 270, error: 24 },
};

export function PlacesUsageDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Text tone="muted">
        The admin dashboard card for place search (ADR-131): our own count of calls to Ola Maps and
        nothing else (no cost, no allowance, no credit balance: the owner&apos;s choice of 17 Nov
        2026). It would sit on the dashboard below the existing charts. Made-up numbers.
      </Text>
      <Specimen label="With calls, no problems">
        <div className="w-full max-w-5xl">
          <PlacesUsageCard usage={WITH_CALLS} />
        </div>
      </Specimen>
      <Specimen label="With problems: the third tile is tinted and says so in words">
        <div className="w-full max-w-5xl">
          <PlacesUsageCard usage={WITH_PROBLEMS} />
        </div>
      </Specimen>
      <Specimen label="No calls yet">
        <div className="w-full max-w-5xl">
          <PlacesUsageCard usage={null} />
        </div>
      </Specimen>
    </div>
  );
}

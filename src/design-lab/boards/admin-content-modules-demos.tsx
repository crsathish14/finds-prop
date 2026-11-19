"use client";

import { useState } from "react";
import { ContentModuleBar } from "@/components/domain/content-module-bar";
import {
  ContentModulesCard,
  type ContentModuleRow,
} from "@/components/domain/content-modules-card";
import { Text } from "@/components/ui/text";
import { Specimen } from "../frame";

/** Made-up counts, so every picture is the same. */
const WITH_COUNTS: ContentModuleRow[] = [
  { module: "blog", live: true, published: 24, drafts: 5 },
  { module: "faq", live: true, published: 38, drafts: 2 },
  { module: "careers", live: true, published: 6, drafts: 1 },
];

const NO_TABLES: ContentModuleRow[] = [
  { module: "blog", live: true },
  { module: "faq", live: true },
  { module: "careers", live: true },
];

function TryItCard() {
  const [rows, setRows] = useState<ContentModuleRow[]>(WITH_COUNTS);
  return (
    <ContentModulesCard
      modules={rows}
      onChange={(module, next) =>
        setRows((current) =>
          current.map((row) =>
            row.module === module
              ? { ...row, live: next, status: "saved" }
              : { ...row, status: "idle" },
          ),
        )
      }
    />
  );
}

export function ContentModulesCardDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Text tone="muted">
        The dashboard card that switches Blog, FAQ and Careers on and off (ADR-143): a row per
        module with its switch, Live or Hidden, the counts of published and draft items and what
        turning it off does. Turning a module off asks first; turning it on does not. It would sit
        last on the admin dashboard, below the place search card. All wording is draft wording for
        the owner to approve. Made-up numbers.
      </Text>
      <Specimen label="Try it: turn a switch off to see the question, then turn it on again">
        <div className="w-full max-w-5xl">
          <TryItCard />
        </div>
      </Specimen>
      <Specimen label="Blog hidden, saved: the label says Hidden and the saved line says so in words">
        <div className="w-full max-w-5xl">
          <ContentModulesCard
            onChange={() => undefined}
            modules={[
              { module: "blog", live: false, published: 24, drafts: 5, status: "saved" },
              WITH_COUNTS[1] as ContentModuleRow,
              WITH_COUNTS[2] as ContentModuleRow,
            ]}
          />
        </div>
      </Specimen>
      <Specimen label="Saving the FAQ switch: every switch is off until it is saved, because one save writes all three">
        <div className="w-full max-w-5xl">
          <ContentModulesCard
            onChange={() => undefined}
            modules={[
              WITH_COUNTS[0] as ContentModuleRow,
              { module: "faq", live: true, published: 38, drafts: 2, status: "pending" },
              WITH_COUNTS[2] as ContentModuleRow,
            ]}
          />
        </div>
      </Specimen>
      <Specimen label="Save failed: the switch stays as it was and the reason is in words">
        <div className="w-full max-w-5xl">
          <ContentModulesCard
            onChange={() => undefined}
            modules={[
              WITH_COUNTS[0] as ContentModuleRow,
              WITH_COUNTS[1] as ContentModuleRow,
              {
                module: "careers",
                live: true,
                published: 6,
                drafts: 1,
                status: "error",
                problem: "You don't have permission to do that.",
              },
            ]}
          />
        </div>
      </Specimen>
      <Specimen label="Counts not available yet (the module's table does not exist): dashes">
        <div className="w-full max-w-5xl">
          <ContentModulesCard onChange={() => undefined} modules={NO_TABLES} />
        </div>
      </Specimen>
    </div>
  );
}

export function ContentModuleBarDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Text tone="muted">
        The same switch as a bar at the top of each module&apos;s admin page (ADR-143). The admin
        pages keep working while a module is hidden, so the bar is always there. Made-up numbers.
      </Text>
      <Specimen label="Live, with counts">
        <div className="w-full max-w-5xl">
          <ContentModuleBar
            module="blog"
            live
            published={24}
            drafts={5}
            onChange={() => undefined}
          />
        </div>
      </Specimen>
      <Specimen label="Hidden, saved">
        <div className="w-full max-w-5xl">
          <ContentModuleBar
            module="faq"
            live={false}
            published={38}
            drafts={2}
            status="saved"
            onChange={() => undefined}
          />
        </div>
      </Specimen>
      <Specimen label="Counts not available yet">
        <div className="w-full max-w-5xl">
          <ContentModuleBar module="careers" live onChange={() => undefined} />
        </div>
      </Specimen>
      <Specimen label="Saving">
        <div className="w-full max-w-5xl">
          <ContentModuleBar
            module="blog"
            live
            published={24}
            drafts={5}
            status="pending"
            onChange={() => undefined}
          />
        </div>
      </Specimen>
      <Specimen label="Save failed">
        <div className="w-full max-w-5xl">
          <ContentModuleBar
            module="faq"
            live={false}
            published={38}
            drafts={2}
            status="error"
            problem="A service we rely on isn't responding. Please try again."
            onChange={() => undefined}
          />
        </div>
      </Specimen>
      <Specimen label="Large counts on a narrow area">
        <div className="w-full max-w-sm">
          <ContentModuleBar
            module="careers"
            live
            published={12_480}
            drafts={3_050}
            onChange={() => undefined}
          />
        </div>
      </Specimen>
    </div>
  );
}

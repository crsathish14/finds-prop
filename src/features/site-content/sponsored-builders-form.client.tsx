"use client";

import { Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { ProjectSaveBar } from "@/components/domain/project-save-bar";
import { Alert } from "@/components/patterns/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import type { SponsoredSlot } from "@/lib/sponsored-builders";
import { useSaveFlow, useSiteContentFrame, type SaveContent } from "./save-flow.client";

export type SponsoredBuilderOption = {
  id: string;
  name: string;
  kind: "builder" | "agent";
  /** How many projects they have (all states), shown beside the name. */
  projects: number;
};

export type SponsoredBuildersFormProps = {
  /** Every active builder and agent the super admin may pick. */
  options: readonly SponsoredBuilderOption[];
  /** The ids saved today for each slot. */
  initial: Readonly<Record<SponsoredSlot, readonly string[]>>;
  /** The most each slot holds. */
  max: number;
  save: SaveContent;
};

type Picks = Record<SponsoredSlot, string[]>;

/**
 * The super admin's "Sponsored builders" page (ADR-191): which builders and agents the Featured project card in the
 * results and the Developer Spotlight on the home page draw from (at most `max` each). The admin only picks; what is
 * shown comes from what each builder or agent uploaded, and each visit shows a different one of the picked. Both lists
 * are saved together with the page's Save bar; Discard puts them back.
 */
export function SponsoredBuildersForm({ options, initial, max, save }: SponsoredBuildersFormProps) {
  const translate = useTranslations("admin.sponsoredBuilders");
  const frame = useSiteContentFrame("sponsored_builders");
  const flow = useSaveFlow(save, {
    title: translate("saved.title"),
    text: translate("saved.text"),
  });
  const start = (): Picks => ({
    featured: [...initial.featured],
    spotlight: [...initial.spotlight],
  });
  const [picks, setPicks] = useState<Picks>(start);
  const byId = new Map(options.map((option) => [option.id, option]));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (flow.saving) return;
    await flow.submit({ featured: picks.featured, spotlight: picks.spotlight });
  };

  const slot = (key: SponsoredSlot) => {
    const chosen = picks[key];
    const available = options.filter((option) => !chosen.includes(option.id));
    const full = chosen.length >= max;
    const titleId = `sponsored-${key}`;
    const set = (next: string[]) => setPicks((previous) => ({ ...previous, [key]: next }));
    const kindLabel = (option: SponsoredBuilderOption) =>
      option.kind === "agent" ? translate("kindAgent") : translate("kindBuilder");
    return (
      <section
        aria-labelledby={titleId}
        className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5"
      >
        <div className="flex flex-col gap-1">
          <h2 id={titleId} className="text-title text-ink">
            {key === "featured" ? translate("featured.title") : translate("spotlight.title")}
          </h2>
          <p className="text-small text-muted">
            {key === "featured" ? translate("featured.text") : translate("spotlight.text")}
          </p>
        </div>
        <p className="text-small font-semibold text-ink">
          {translate("chosen", { count: chosen.length, max })}
        </p>
        {chosen.length === 0 ? (
          <Alert tone="info" title={translate("empty.title")}>
            {key === "featured" ? translate("empty.featured") : translate("empty.spotlight")}
          </Alert>
        ) : (
          <ul className="flex flex-col gap-2">
            {chosen.map((id) => {
              const option = byId.get(id);
              const name = option?.name ?? translate("unknown");
              return (
                <li
                  key={id}
                  className="flex items-center gap-2 rounded-md border border-line bg-canvas px-3 py-2"
                >
                  <span className="min-w-0 flex-1 truncate text-body text-ink">{name}</span>
                  {option ? <Badge tone="neutral">{kindLabel(option)}</Badge> : null}
                  <IconButton
                    type="button"
                    aria-label={translate("remove", { name })}
                    disabled={flow.saving}
                    onClick={() => set(chosen.filter((other) => other !== id))}
                  >
                    <Icon icon={X} size="lg" />
                  </IconButton>
                </li>
              );
            })}
          </ul>
        )}
        {full ? (
          <Alert tone="warning" title={translate("full.title", { max })}>
            {translate("full.text")}
          </Alert>
        ) : null}
        <div className="flex flex-col gap-2">
          <p className="text-small text-muted">{translate("available")}</p>
          {available.length === 0 ? (
            <p className="text-body text-muted">{translate("availableEmpty")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {available.map((option) => (
                <li
                  key={option.id}
                  className="flex flex-wrap items-center gap-3 rounded-md border border-line bg-surface px-3 py-2"
                >
                  <span className="min-w-0 flex-1 truncate text-body text-ink">{option.name}</span>
                  <Badge tone="neutral">{kindLabel(option)}</Badge>
                  <span className="text-small text-muted">
                    {translate("projects", { count: option.projects })}
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    iconStart={<Icon icon={Plus} />}
                    disabled={flow.saving || full}
                    aria-label={translate("add", { name: option.name })}
                    onClick={() => set([...chosen, option.id])}
                  >
                    {translate("addShort")}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    );
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Heading as="h1" size="2">
          {translate("title")}
        </Heading>
        <p className="text-body text-muted">{translate("description", { max })}</p>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        {slot("featured")}
        {slot("spotlight")}
      </div>
      <ProjectSaveBar
        note={frame.saveNote}
        words={frame.saveWords}
        saving={flow.saving}
        onCancel={() => setPicks(start())}
      />
    </form>
  );
}

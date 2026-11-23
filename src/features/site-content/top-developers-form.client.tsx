"use client";

import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { ProjectSaveBar } from "@/components/domain/project-save-bar";
import { Alert } from "@/components/patterns/alert";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { useSaveFlow, useSiteContentFrame, type SaveContent } from "./save-flow.client";

export type TopDeveloperOption = {
  id: string;
  name: string;
  /** How many projects the developer has (all states), shown beside the name. */
  projects: number;
};

export type TopDevelopersFormProps = {
  /** Every developer the super admin may pick. */
  options: readonly TopDeveloperOption[];
  /** The ids saved today, in their order. */
  initial: readonly string[];
  /** The most the home page shows. */
  max: number;
  save: SaveContent;
};

/**
 * The super admin's "Top developers" page: choose which developers the home page shows, and in what order (at most
 * `max`). The order is set with Up and Down buttons, which work from the keyboard. With none chosen the home page
 * picks developers by itself, as before. A developer with no approved, published project is skipped on the home page.
 */
export function TopDevelopersForm({ options, initial, max, save }: TopDevelopersFormProps) {
  const translate = useTranslations("admin.topDevelopers");
  const frame = useSiteContentFrame("top_developers");
  const flow = useSaveFlow(save, {
    title: translate("saved.title"),
    text: translate("saved.text"),
  });
  const [chosen, setChosen] = useState<string[]>(() => [...initial]);
  const byId = new Map(options.map((option) => [option.id, option]));
  const available = options.filter((option) => !chosen.includes(option.id));
  const full = chosen.length >= max;

  const move = (index: number, by: -1 | 1) => {
    const target = index + by;
    if (target < 0 || target >= chosen.length) return;
    const next = [...chosen];
    const [moved] = next.splice(index, 1);
    if (moved === undefined) return;
    next.splice(target, 0, moved);
    setChosen(next);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (flow.saving) return;
    await flow.submit({ builderIds: chosen });
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Heading as="h1" size="2">
          {translate("title")}
        </Heading>
        <p className="text-body text-muted">{translate("description", { max })}</p>
      </div>

      <section aria-labelledby="top-developers-chosen" className="flex flex-col gap-3">
        <h2 id="top-developers-chosen" className="text-title font-semibold text-ink">
          {translate("chosen.title", { count: chosen.length, max })}
        </h2>
        {chosen.length === 0 ? (
          <Alert tone="info" title={translate("empty.title")}>
            {translate("empty.text")}
          </Alert>
        ) : (
          <ol className="flex flex-col gap-2">
            {chosen.map((id, index) => {
              const name = byId.get(id)?.name ?? translate("unknown");
              return (
                <li
                  key={id}
                  className="flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-2"
                >
                  <span className="w-6 text-small text-muted">{index + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-body text-ink">{name}</span>
                  <IconButton
                    type="button"
                    aria-label={translate("moveUp", { name })}
                    disabled={flow.saving || index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <Icon icon={ArrowUp} size="lg" />
                  </IconButton>
                  <IconButton
                    type="button"
                    aria-label={translate("moveDown", { name })}
                    disabled={flow.saving || index === chosen.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <Icon icon={ArrowDown} size="lg" />
                  </IconButton>
                  <IconButton
                    type="button"
                    aria-label={translate("remove", { name })}
                    disabled={flow.saving}
                    onClick={() => setChosen(chosen.filter((other) => other !== id))}
                  >
                    <Icon icon={X} size="lg" />
                  </IconButton>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section aria-labelledby="top-developers-available" className="flex flex-col gap-3">
        <h2 id="top-developers-available" className="text-title font-semibold text-ink">
          {translate("available.title")}
        </h2>
        {full ? (
          <Alert tone="warning" title={translate("full.title", { max })}>
            {translate("full.text")}
          </Alert>
        ) : null}
        {available.length === 0 ? (
          <p className="text-body text-muted">{translate("available.empty")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {available.map((option) => (
              <li
                key={option.id}
                className="flex items-center gap-3 rounded-md border border-line bg-surface px-3 py-2"
              >
                <span className="min-w-0 flex-1 truncate text-body text-ink">{option.name}</span>
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
                  onClick={() => setChosen([...chosen, option.id])}
                >
                  {translate("addShort")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ProjectSaveBar
        note={frame.saveNote}
        words={frame.saveWords}
        saving={flow.saving}
        onCancel={() => setChosen([...initial])}
      />
    </form>
  );
}

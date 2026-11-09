"use client";

import { useTranslations } from "next-intl";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { ProjectLeadsPanel, type ProjectLeadsActions } from "./project-leads-panel.client";
import type { LeadsPage } from "./view";

/**
 * The builder's Leads page (S7-T03, FR-BLD-04): the heading and the leads of the builder's own projects, with the one
 * thing a builder can change, a lead's state. It is the admin's "Project leads" list without the tabs: a builder has
 * no form submissions. Who sees which leads is decided by the database, not by this page.
 */
export function BuilderLeadsBoard({
  page,
  actions,
}: {
  page: LeadsPage;
  actions: ProjectLeadsActions;
}) {
  const translate = useTranslations("builderPortal.leads");
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Heading as="h1" size="1">
          {translate("metaTitle")}
        </Heading>
        <Text tone="muted">{translate("intro")}</Text>
      </div>
      <ProjectLeadsPanel page={page} actions={actions} />
    </div>
  );
}

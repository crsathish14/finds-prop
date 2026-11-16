import "server-only";
import { getComparedHomes } from "@/features/compare";
import { getProject } from "@/features/projects";
import { getProperty } from "@/features/property";
import type { ContextReads } from "./resolve";

/** The real reads: the cached public reads the property, project and compare pages use (anonymous, no cookies). */
export const realContextReads: ContextReads = {
  async homeIsOpen(shortId) {
    return (await getProperty(shortId)).status !== "missing";
  },
  async projectIsOpen(slug) {
    return (await getProject(slug)).status !== "missing";
  },
  async openHomeIds(shortIds) {
    return (await getComparedHomes(shortIds)).properties.map((property) => property.shortId);
  },
};

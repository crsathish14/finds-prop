import type { Translate } from "@/lib/format";
import type { AgentDone } from "../agent-types";

/**
 * The reply buttons under an answer (ADR-175). The SERVER picks them from what the turn returned; the model never
 * writes them, because this model does not reliably write markers. Each one is fixed, translated wording from
 * `en.json`, and a click sends the same words as the customer's next message, so every button is something the
 * customer could have typed. Nothing here sends, books or submits anything: "enquire" only makes the assistant
 * prepare the card, and only the customer pressing Send sends it.
 */

/** The `en.json` keys of the buttons, written out as literals so the message check finds each one in use. */
export const REPLY_MESSAGE_KEYS = {
  enquireHome: "ai.replies.enquireHome",
  workOutEmi: "ai.replies.workOutEmi",
  similarHomes: "ai.replies.similarHomes",
  compareHomes: "ai.replies.compareHomes",
  showMore: "ai.replies.showMore",
  enquireProject: "ai.replies.enquireProject",
  siteVisit: "ai.replies.siteVisit",
} as const;

export interface ReplyItem {
  /** The name of the button, stable across languages. */
  readonly key: string;
  /** The words on the button and the message a click sends. */
  readonly text: string;
}

/** Tools whose answers get no buttons: the answer is a sum or a comparison, not a list to act on. */
const NO_REPLY_TOOLS = ["calculate_emi", "compare_properties"] as const;

function item(key: keyof typeof REPLY_MESSAGE_KEYS, translate: Translate): ReplyItem {
  return { key, text: translate(REPLY_MESSAGE_KEYS[key]) };
}

/** The lookups of one home or one project the customer asked about: only after one of them is an enquiry offered. */
const DETAIL_TOOLS = ["get_property", "get_project"] as const;

/**
 * The buttons for a finished answer, from the records the tools returned this turn: one home, several homes, or one
 * project. No buttons for a turn that ended with a proposal (the customer sees the confirm card), for an answer
 * that was cut short, for an EMI sum or a comparison, for several projects, or for a mix of homes and projects.
 *
 * An enquiry or a site visit is offered only after the customer looked at one home or one project in detail (ADR-204):
 * a list of search results gets ways to keep looking (compare, show more, similar homes, an EMI sum), never an enquiry.
 */
export function pickReplies(agent: AgentDone, translate: Translate): ReplyItem[] {
  if (agent.outcome !== "answered" || agent.offers.length > 0) return [];
  if (NO_REPLY_TOOLS.some((name) => agent.toolsRan.includes(name))) return [];
  const homes = new Set<string>();
  const projects = new Set<string>();
  for (const reference of agent.references) {
    if (reference.kind === "home") homes.add(reference.homeId);
    else if (reference.kind === "project") projects.add(reference.slug);
  }
  const detail = DETAIL_TOOLS.some((name) => agent.toolsRan.includes(name));
  if (projects.size === 0 && homes.size === 1) {
    const keepLooking = [item("workOutEmi", translate), item("similarHomes", translate)];
    return detail ? [item("enquireHome", translate), ...keepLooking] : keepLooking;
  }
  if (projects.size === 0 && homes.size > 1) {
    return [item("compareHomes", translate), item("showMore", translate)];
  }
  if (homes.size === 0 && projects.size === 1 && detail) {
    return [item("enquireProject", translate), item("siteVisit", translate)];
  }
  return [];
}

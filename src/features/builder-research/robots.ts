/**
 * Whether a site's `robots.txt` lets the findsprop reader open a page (AI search Phase 4). The rules of the group for
 * our name are used when there is one, otherwise the group for every reader (`*`). The longest matching rule wins and
 * Allow wins a tie, as the common readers do; `*` and a closing `$` in a rule are understood. A missing or unreadable
 * file allows everything. Pure.
 */

/** The name the reader gives itself, in its requests and when it looks for its own group in robots.txt. */
export const READER_NAME = "findsprop-assistant";

interface Rule {
  readonly allow: boolean;
  readonly pattern: string;
}

function rulesFor(robotsTxt: string): Rule[] {
  const groups: { agents: string[]; rules: Rule[] }[] = [];
  let current: { agents: string[]; rules: Rule[] } | null = null;
  let lastWasAgent = false;
  for (const rawLine of robotsTxt.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const field = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (field === "user-agent") {
      if (!lastWasAgent || current === null) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if ((field === "allow" || field === "disallow") && current !== null) {
      lastWasAgent = false;
      // An empty Disallow allows everything; it adds no rule.
      if (value !== "") current.rules.push({ allow: field === "allow", pattern: value });
    } else {
      lastWasAgent = false;
    }
  }
  const ours = groups.filter((group) => group.agents.some((agent) => agent === READER_NAME));
  if (ours.length > 0) return ours.flatMap((group) => group.rules);
  return groups.filter((group) => group.agents.includes("*")).flatMap((group) => group.rules);
}

function matches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const expression = body
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${expression}${anchored ? "$" : ""}`).test(path);
}

/** True when robots.txt (its text, or null when there is none) lets the reader open this path (with its query). */
export function allowedByRobots(robotsTxt: string | null, path: string): boolean {
  if (robotsTxt === null) return true;
  let best: Rule | null = null;
  for (const rule of rulesFor(robotsTxt)) {
    if (!matches(rule.pattern, path)) continue;
    if (
      best === null ||
      rule.pattern.length > best.pattern.length ||
      (rule.pattern.length === best.pattern.length && rule.allow)
    ) {
      best = rule;
    }
  }
  return best === null || best.allow;
}

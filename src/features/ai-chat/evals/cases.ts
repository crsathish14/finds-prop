/**
 * Loads and checks the case files (AI-P8-T01). A file that is not a list of valid cases, a case that sits in the
 * wrong file, a repeated id, or a case that names a tool the assistant does not have, is an error that names the
 * file and the case: the run stops before it measures anything (a quiet skip would hide a lost case).
 */
import type { z } from "zod";
import goldenFile from "./data/golden.json";
import redTeamFile from "./data/red-team.json";
import { caseFileSchema, type EvalCase, type EvalSet } from "./case-schema";

/** Thrown for every problem with a case file, so a test (and a person reading the log) can tell it from a bug. */
export class CaseFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CaseFileError";
  }
}

function describeIssues(file: string, error: z.ZodError, raw: unknown): string {
  const lines = error.issues.slice(0, 8).map((issue) => {
    const [first, ...rest] = issue.path;
    const entry = typeof first === "number" && Array.isArray(raw) ? raw[first] : undefined;
    const id =
      typeof entry === "object" && entry !== null && "id" in entry && typeof entry.id === "string"
        ? entry.id
        : `entry ${String(first)}`;
    return `  ${id} ${rest.map(String).join(".")}: ${issue.message}`;
  });
  const more =
    error.issues.length > lines.length ? `\n  and ${error.issues.length - lines.length} more` : "";
  return `${file} is not a valid case file:\n${lines.join("\n")}${more}`;
}

/** One case file's contents as cases. `expectedSet` is the set the file holds; every case in it must say the same. */
export function parseCaseFile(file: string, raw: unknown, expectedSet: EvalSet): EvalCase[] {
  const parsed = caseFileSchema.safeParse(raw);
  if (!parsed.success) throw new CaseFileError(describeIssues(file, parsed.error, raw));
  const seen = new Set<string>();
  for (const evalCase of parsed.data) {
    if (evalCase.set !== expectedSet)
      throw new CaseFileError(
        `${file}: ${evalCase.id} says set "${evalCase.set}" but the file holds "${expectedSet}"`,
      );
    if (seen.has(evalCase.id))
      throw new CaseFileError(`${file}: the id ${evalCase.id} is used twice`);
    seen.add(evalCase.id);
  }
  return parsed.data;
}

/** Both files together; an id must be unique across them. */
export function loadCases(
  files: { golden: unknown; redTeam: unknown } = { golden: goldenFile, redTeam: redTeamFile },
): { golden: EvalCase[]; redTeam: EvalCase[]; all: EvalCase[] } {
  const golden = parseCaseFile("data/golden.json", files.golden, "golden");
  const redTeam = parseCaseFile("data/red-team.json", files.redTeam, "red_team");
  const ids = new Set(golden.map((evalCase) => evalCase.id));
  for (const evalCase of redTeam)
    if (ids.has(evalCase.id))
      throw new CaseFileError(`the id ${evalCase.id} is used in both files`);
  return { golden, redTeam, all: [...golden, ...redTeam] };
}

/** Every tool name a case mentions (in its script and its expectations) must be a tool the assistant has. */
export function checkToolNames(cases: readonly EvalCase[], toolNames: readonly string[]): void {
  const known = new Set(toolNames);
  for (const evalCase of cases) {
    const mentioned = [
      ...evalCase.script.flatMap((round) =>
        "calls" in round ? round.calls.map((call) => call.name) : [],
      ),
      ...evalCase.expect.tools.mustCall.map((call) => call.name),
      ...evalCase.expect.tools.mustNotCall,
      ...evalCase.failingTools,
    ];
    for (const name of mentioned)
      if (!known.has(name))
        throw new CaseFileError(`${evalCase.id} names the tool "${name}", which does not exist`);
  }
}

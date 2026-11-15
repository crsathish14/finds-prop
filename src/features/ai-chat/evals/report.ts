/**
 * The totals, the pass rule and the report (AI-P8-T01). `summarise` turns the case scores into the rates the rule is
 * written in; `judge` applies the thresholds; `renderReport` writes the Markdown the owner reads after a real-model
 * run. The rule itself (what "passes" means and why these numbers) is in `README.md` next to the data. Nothing here
 * touches the network, the disk or a key: writing the report to a file is the live test's job.
 */
import type { CaseScore } from "./score";
import type { Mode } from "./score";
import { thresholdsFor, type Thresholds } from "./thresholds";

export interface Rate {
  readonly passed: number;
  readonly of: number;
  /** `null` when there is nothing to measure (no case applies). */
  readonly rate: number | null;
}

function rate(passed: number, of: number): Rate {
  return { passed, of, rate: of === 0 ? null : passed / of };
}

export interface Metrics {
  readonly golden: Rate;
  readonly redTeam: Rate;
  /** Match to tool output. */
  readonly facts: Rate;
  /** Of the cases that had to be refused or declined, how many were, by the right layer. */
  readonly refusals: Rate;
  /** Of the cases that had to be answered, how many were wrongly refused or blocked (`passed` counts the mistakes). */
  readonly falseRefusals: Rate;
  readonly language: Rate;
  /** Of the golden answers with a figure in them, how many the shadow number check flagged although all were grounded. */
  readonly groundingFalsePositives: Rate;
  /** Ungrounded figures the shadow check did not flag, across all cases (for information). */
  readonly groundingMisses: number;
}

export function summarise(scores: readonly CaseScore[]): Metrics {
  const golden = scores.filter((score) => score.set === "golden");
  const redTeam = scores.filter((score) => score.set === "red_team");
  const facts = scores.filter((score) => score.facts.applicable);
  const refusals = scores.filter(
    (score) => score.refusal.applicable && score.refusal.refusalExpected,
  );
  const shouldAnswer = scores.filter(
    (score) => score.refusal.applicable && !score.refusal.refusalExpected,
  );
  const language = scores.filter((score) => score.languageMatch.applicable);
  const withFigures = golden.filter(
    (score) => score.refusal.refusalExpected === false && (score.grounding?.claims ?? 0) > 0,
  );
  return {
    golden: rate(golden.filter((score) => score.passed).length, golden.length),
    redTeam: rate(redTeam.filter((score) => score.passed).length, redTeam.length),
    facts: rate(facts.filter((score) => score.facts.passed).length, facts.length),
    refusals: rate(refusals.filter((score) => score.refusal.passed).length, refusals.length),
    falseRefusals: rate(
      shouldAnswer.filter((score) => !score.refusal.passed).length,
      shouldAnswer.length,
    ),
    language: rate(language.filter((score) => score.languageMatch.passed).length, language.length),
    groundingFalsePositives: rate(
      withFigures.filter((score) => score.grounding?.falsePositive === true).length,
      withFigures.length,
    ),
    groundingMisses: scores.filter((score) => score.grounding?.missed === true).length,
  };
}

export interface Verdict {
  readonly name: string;
  readonly rule: string;
  readonly actual: string;
  readonly passed: boolean;
}

function atLeast(name: string, measured: Rate, minimum: number): Verdict {
  const percent = (value: number) => `${Math.round(value * 1000) / 10}%`;
  return {
    name,
    rule: `at least ${percent(minimum)}`,
    actual:
      measured.rate === null
        ? "no case applies"
        : `${percent(measured.rate)} (${measured.passed} of ${measured.of})`,
    passed: measured.rate === null || measured.rate >= minimum,
  };
}

function atMost(name: string, measured: Rate, maximum: number): Verdict {
  const percent = (value: number) => `${Math.round(value * 1000) / 10}%`;
  return {
    name,
    rule: `at most ${percent(maximum)}`,
    actual:
      measured.rate === null
        ? "no case applies"
        : `${percent(measured.rate)} (${measured.passed} of ${measured.of})`,
    passed: measured.rate === null || measured.rate <= maximum,
  };
}

/** Applies the thresholds of the mode. Every verdict must pass for the run to pass. */
export function judge(
  metrics: Metrics,
  mode: Mode,
  thresholds: Thresholds = thresholdsFor(mode),
): Verdict[] {
  return [
    atLeast("Red-team cases passed", metrics.redTeam, thresholds.redTeamPass),
    atLeast("Golden cases passed", metrics.golden, thresholds.goldenPass),
    atLeast("Match to tool output", metrics.facts, thresholds.facts),
    atLeast("Refusal correctness", metrics.refusals, thresholds.refusals),
    atMost("False refusals", metrics.falseRefusals, thresholds.falseRefusals),
    atLeast("Language match", metrics.language, thresholds.language),
    atMost(
      "Number-grounding false positives",
      metrics.groundingFalsePositives,
      thresholds.groundingFalsePositives,
    ),
  ];
}

export function runPassed(verdicts: readonly Verdict[]): boolean {
  return verdicts.every((verdict) => verdict.passed);
}

export interface ReportInput {
  readonly mode: Mode;
  readonly promptVersion: string;
  /** The model's id for a real run; `fake` for the offline run. */
  readonly model: string;
  readonly at: string;
  readonly scores: readonly CaseScore[];
}

/** The Markdown report. Safe to keep and to share: every case, home and number in it is made up. */
export function renderReport(input: ReportInput): string {
  const metrics = summarise(input.scores);
  const verdicts = judge(metrics, input.mode);
  const passed = runPassed(verdicts);
  const total = (field: "modelCalls" | "input" | "output") =>
    input.scores.reduce((sum, entry) => sum + entry.tokens[field], 0);
  const lines: string[] = [
    `# AI chat eval report: ${passed ? "PASS" : "FAIL"}`,
    "",
    `- Run: ${input.mode === "live" ? "real model" : "offline, scripted"} (${input.model})`,
    `- Prompt version: ${input.promptVersion}`,
    `- When: ${input.at}`,
    `- Cases: ${input.scores.length} (${metrics.golden.of} golden, ${metrics.redTeam.of} red-team)`,
    `- Model use: ${total("modelCalls")} calls, ${total("input")} input tokens, ${total("output")} output tokens (multiply by your provider's price; the offline run counts none)`,
    "",
    "## The rule",
    "",
    "| Measure | Rule | Result | |",
    "| --- | --- | --- | --- |",
    ...verdicts.map(
      (verdict) =>
        `| ${verdict.name} | ${verdict.rule} | ${verdict.actual} | ${verdict.passed ? "ok" : "FAIL"} |`,
    ),
    "",
    `Ungrounded figures the shadow number check did not flag: ${metrics.groundingMisses} (information only: the rule is in shadow mode).`,
    "",
    "## By category",
    "",
    "| Category | Cases | Passed |",
    "| --- | --- | --- |",
  ];
  const categories = [...new Set(input.scores.map((score) => score.category))].sort();
  for (const category of categories) {
    const inCategory = input.scores.filter((score) => score.category === category);
    lines.push(
      `| ${category} | ${inCategory.length} | ${inCategory.filter((score) => score.passed).length} |`,
    );
  }
  const failed = input.scores.filter((score) => !score.passed);
  lines.push("", `## Cases that failed (${failed.length})`, "");
  if (failed.length === 0) lines.push("None.");
  for (const score of failed) {
    lines.push(`### ${score.id}: ${score.title}`, "");
    for (const entry of score.checks.filter((candidate) => !candidate.passed && candidate.hard))
      lines.push(`- ${entry.name}: ${entry.detail}`);
    lines.push("", `What the customer read: ${score.excerpt.replace(/\s+/gu, " ")}`, "");
  }
  const flagged = input.scores.filter((score) => score.grounding?.falsePositive === true);
  lines.push(
    "",
    `## Answers the shadow number check flagged although every figure was grounded (${flagged.length})`,
    "",
  );
  if (flagged.length === 0) lines.push("None.");
  for (const score of flagged) lines.push(`- ${score.id}: ${score.title}`);
  const wrongLanguage = input.scores.filter(
    (score) => score.languageMatch.applicable && !score.languageMatch.passed,
  );
  lines.push("", `## Answers in the wrong language (${wrongLanguage.length})`, "");
  if (wrongLanguage.length === 0) lines.push("None.");
  for (const score of wrongLanguage) lines.push(`- ${score.id}: ${score.title}`);
  return `${lines.join("\n")}\n`;
}

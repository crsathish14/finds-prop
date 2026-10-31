// Claude Code PostToolUse hook for Edit and Write (R-GEN-11: names are words).
// After Claude writes a file, check it for single-letter names and cryptic shorthand and, if there
// are any, send the list back to Claude so it fixes them in the same turn. The rules are the same
// ones ESLint enforces (scripts/policy/naming-rules.mjs); lint, the pre-commit hook and CI remain
// the authority. This hook only gives Claude early feedback, so it never blocks on its own failure.
// The pure checkNaming() function is unit tested (scripts/__tests__/check-naming-hook.test.mjs).
import { ESLint } from "eslint";
import path from "node:path";
import { fileURLToPath } from "node:url";
import tseslint from "typescript-eslint";
import { NAMING_RULES } from "../../scripts/policy/naming-rules.mjs";

const CHECKED = /\.(ts|tsx|mjs|mts)$/;
const SKIPPED = /(^|\/)(node_modules|\.next|\.git)\//;

/**
 * @param {string} filePath  path of the file Claude just wrote (absolute or relative to root)
 * @param {string} root      project root
 * @returns {Promise<string[]>} one line per problem, empty when the file is fine
 */
export async function checkNaming(filePath, root) {
  const relative = path.relative(root, path.resolve(root, filePath)).replace(/\\/g, "/");
  if (!CHECKED.test(relative) || SKIPPED.test(relative) || relative.startsWith("..")) return [];
  const eslint = new ESLint({
    cwd: root,
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ["**/*.{ts,tsx,mjs,mts}"],
        languageOptions: {
          parser: tseslint.parser,
          parserOptions: { ecmaFeatures: { jsx: true } },
        },
        rules: NAMING_RULES,
      },
    ],
  });
  const [result] = await eslint.lintFiles([relative]);
  return (result?.messages ?? [])
    .filter((message) => message.ruleId === "id-length" || message.ruleId === "id-denylist")
    .map((message) => `${relative}:${message.line}:${message.column} ${message.message}`);
}

function report(problems) {
  return [
    "R-GEN-11: names are words, not letters or shorthand. Rename these to meaningful words",
    "(for example token, index, match, finding, file, error, context) and keep the behaviour:",
    ...problems.map((problem) => `  ${problem}`),
  ].join("\n");
}

function main() {
  let raw = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => (raw += chunk));
  process.stdin.on("end", async () => {
    try {
      const input = JSON.parse(raw);
      const root = process.env.CLAUDE_PROJECT_DIR ?? input?.cwd ?? process.cwd();
      const filePath = input?.tool_input?.file_path;
      if (!filePath) process.exit(0);
      const problems = await checkNaming(filePath, root);
      if (problems.length > 0) {
        // Exit code 2 in a PostToolUse hook shows stderr to Claude.
        process.stderr.write(`${report(problems)}\n`);
        process.exit(2);
      }
    } catch (error) {
      // Feedback only: a failure here must not get in the way of the edit.
      process.stderr.write(
        `check-naming: skipped (${error instanceof Error ? error.message : "error"})\n`,
      );
    }
    process.exit(0);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

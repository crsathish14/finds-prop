// G-11 Dependency policy (offline part): one lockfile, exact versions, no banned packages,
// permissive or approved licences, install scripts only where approved, and a report of what a
// change adds. `npm audit` runs separately in CI.
// Usage: node scripts/check-deps.mjs [--report] [--base <git ref>]
import fs from "node:fs";
import path from "node:path";
import {
  finding,
  git,
  globToRegExp,
  isMain,
  printFindings,
  readJson,
  repoRoot,
} from "./lib/core.mjs";

const LOCKFILES = ["bun.lock", "bun.lockb", "pnpm-lock.yaml", "yarn.lock", "npm-shrinkwrap.json"];
const SECTIONS = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"];

function packageName(lockKey) {
  return lockKey.replace(/^.*node_modules\//, "");
}

/** Evaluate an SPDX-like expression: AND needs every part acceptable, OR needs one. */
function licenceVerdict(expression, name, policy) {
  const accept = (id) => {
    const clean = id.replace(/[()]/g, "").trim();
    if (policy.permissive.includes(clean)) return "ok";
    if (policy.weakCopyleft.includes(clean)) {
      return policy.weakCopyleftAllowedPackages.some((pattern) => globToRegExp(pattern).test(name))
        ? "ok"
        : "weak";
    }
    return "bad";
  };
  if (/\sOR\s/.test(expression)) {
    const parts = expression.split(/\s+OR\s+/).map(accept);
    return parts.includes("ok") ? "ok" : parts.includes("weak") ? "weak" : "bad";
  }
  const parts = expression.split(/\s+AND\s+/).map(accept);
  return parts.includes("bad") ? "bad" : parts.includes("weak") ? "weak" : "ok";
}

export function directDependencies(manifest) {
  const result = new Map();
  for (const section of SECTIONS) {
    for (const [name, range] of Object.entries(manifest[section] ?? {}))
      result.set(name, { range, section });
  }
  return result;
}

export function diffDependencies(base, current) {
  const before = directDependencies(base ?? {});
  const after = directDependencies(current);
  const added = [];
  const changed = [];
  const removed = [];
  for (const [name, info] of after) {
    if (!before.has(name)) added.push({ name, ...info });
    else if (before.get(name).range !== info.range)
      changed.push({ name, from: before.get(name).range, to: info.range });
  }
  for (const name of before.keys()) if (!after.has(name)) removed.push({ name });
  return { added, changed, removed };
}

export function checkDeps({ root = repoRoot, baseManifest = null } = {}) {
  const findings = [];
  const manifest = readJson(root, "package.json");
  const lock = fs.existsSync(path.join(root, "package-lock.json"))
    ? readJson(root, "package-lock.json")
    : null;
  const banned = readJson(root, "scripts/policy/banned-deps.json", []);
  const licences = readJson(root, "scripts/policy/licences.json");

  for (const name of LOCKFILES) {
    if (fs.existsSync(path.join(root, name)))
      findings.push(
        finding(
          name,
          0,
          "DEP-LOCKFILE",
          "npm is the only package manager; delete this lockfile (R-GEN-01)",
        ),
      );
  }
  if (!lock)
    findings.push(
      finding(
        "package-lock.json",
        0,
        "DEP-LOCKFILE",
        "package-lock.json is missing; commit it (R-GEN-01)",
      ),
    );
  if (manifest.packageManager && !String(manifest.packageManager).startsWith("npm@")) {
    findings.push(
      finding(
        "package.json",
        0,
        "DEP-LOCKFILE",
        "packageManager must name npm or be absent (R-GEN-01)",
      ),
    );
  }

  for (const [name, { range, section }] of directDependencies(manifest)) {
    if (section !== "peerDependencies" && !/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(range)) {
      findings.push(
        finding(
          "package.json",
          0,
          "DEP-EXACT",
          `${name} uses range "${range}"; install exact versions (R-DEP-03)`,
        ),
      );
    }
    for (const rule of banned) {
      if ((rule.name && rule.name === name) || (rule.prefix && name.startsWith(rule.prefix))) {
        findings.push(finding("package.json", 0, "DEP-BANNED", `${name}: ${rule.reason}`));
      }
    }
  }

  if (lock?.packages) {
    for (const [key, info] of Object.entries(lock.packages)) {
      if (!key) continue;
      const name = packageName(key);
      if (
        info.hasInstallScript &&
        !licences.installScriptAllowedPackages.some((pattern) => globToRegExp(pattern).test(name))
      ) {
        findings.push(
          finding(
            "package-lock.json",
            0,
            "DEP-INSTALL-SCRIPT",
            `${name}@${info.version} runs an install script; approve it by name in scripts/policy/licences.json (R-DEP-04)`,
          ),
        );
      }
      const licence = info.license;
      if (!licence) {
        if (!info.link)
          findings.push(
            finding(
              "package-lock.json",
              0,
              "DEP-LICENCE",
              `${name}@${info.version} has no licence field`,
            ),
          );
        continue;
      }
      const verdict = licenceVerdict(String(licence), name, licences);
      if (verdict === "weak")
        findings.push(
          finding(
            "package-lock.json",
            0,
            "DEP-LICENCE",
            `${name}@${info.version} is ${licence} (weak copyleft); approve it by name in scripts/policy/licences.json after review (R-DEP-05)`,
          ),
        );
      else if (verdict === "bad")
        findings.push(
          finding(
            "package-lock.json",
            0,
            "DEP-LICENCE",
            `${name}@${info.version} licence ${licence} is not on the approved list (R-DEP-05)`,
          ),
        );
    }
  }

  const diff = baseManifest ? diffDependencies(baseManifest, manifest) : null;
  return { findings, diff, lock };
}

function loadBaseManifest(root, ref) {
  const out = git(root, ["show", `${ref}:package.json`], { allowFail: true });
  return out ? JSON.parse(out) : null;
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const baseIndex = args.indexOf("--base");
  const baseRef = baseIndex >= 0 ? args[baseIndex + 1] : process.env.BASE_REF;
  const base = baseRef ? loadBaseManifest(repoRoot, baseRef) : null;
  const { findings, diff, lock } = checkDeps({ baseManifest: base });
  if (args.includes("--report") || diff) {
    if (diff && (diff.added.length || diff.changed.length || diff.removed.length)) {
      console.log("Dependency changes against the base branch:");
      for (const addedPackage of diff.added) {
        const entry = lock?.packages?.[`node_modules/${addedPackage.name}`];
        console.log(
          `  + ${addedPackage.name}@${addedPackage.range} (${addedPackage.section}) licence=${entry?.license ?? "?"} installScript=${entry?.hasInstallScript ? "yes" : "no"}`,
        );
      }
      for (const changedPackage of diff.changed)
        console.log(`  ~ ${changedPackage.name}: ${changedPackage.from} -> ${changedPackage.to}`);
      for (const removedPackage of diff.removed) console.log(`  - ${removedPackage.name}`);
    } else if (baseRef && !base)
      console.log(`check-deps: base ref ${baseRef} not available; skipping the change report`);
  }
  process.exit(printFindings("check-deps", findings));
}

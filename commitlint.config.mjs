// Conventional commits (R-GIT-02). The pull request title becomes the squash commit message and
// is checked by scripts/check-pr.mjs (G-17); this file checks messages while working on a branch.
const commitlintConfig = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "subject-case": [0],
    "body-max-line-length": [0],
    "footer-max-line-length": [0],
  },
};

export default commitlintConfig;

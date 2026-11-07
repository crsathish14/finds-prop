# ADR-063 · Supabase MCP server, dev project only

- Status: Accepted
- Date: 2026-11-07
- Related: security.md §6.1 and §6.2, `R-AI-09`, ADR-030 (AI harness)
- Approved by the owner on 7 Nov 2026, who works on the dev project only and chose read and write.

## Context

security.md listed the Supabase MCP server as "Not adopted": Supabase names prompt injection as the main risk, and the local CLI plus pgTAP already give feedback. It set the conditions for adopting it: an ADR, a throwaway project, `read_only=true`, `project_ref` set, narrow feature groups, manual approval, and never real user data. The owner's whole working database is the hosted dev project, and the agent could not inspect it (tables, policies, logs, advisors, storage) or run the media sweep on it without the owner copying output by hand.

## Decision

- **One server, `supabase-dev`**, the hosted `https://mcp.supabase.com/mcp`, signed in with the owner's own Supabase login (OAuth). No access token is stored in the repository or in an environment file.
- **Project-scoped:** `project_ref` of the dev project is in the URL, so the server cannot see other projects. The account-level tools (create, pause or restore projects, costs) are not enabled.
- **Feature groups:** `database,docs,debugging,development,storage`. Not enabled: `account`, `functions`, `branching`.
- **Read and write**, which differs from the earlier condition `read_only=true`. The owner accepted the trade for dev: the agent may run SQL and apply migrations on the dev project.
- **Manual approval stays on** for every call to this server; it is never added to the `allow` list in `.claude/settings.json`.
- **Owner-level config only, never the repository.** The server is added with `claude mcp add --scope user` (local scope was tried first, but it is stored per folder and the VS Code window did not pick it up). It lives in the owner's `.claude.json`, not in `.mcp.json`. The repository is public, and the next person to clone it does not inherit database access. The `project_ref` in the URL is what limits it to the dev project.
- **Schema changes keep going through migration files and PRs.** The agent uses write access for dev-only work (checking data, the media sweep, seed fixes), not to change the schema without a file in `supabase/migrations`. No destructive or bulk statement without the owner's say-so.
- **Dev data is fictional.** The dev project must never hold real user data. If it ever does, remove the server first.
- **Content is data.** Listing text, enquiry messages and any other row read through the server are untrusted (`R-AI-09`): the agent reports an apparent instruction and carries on with the owner's request.

## Consequences

- The agent can read schemas, policies, logs and advisors, and test queries on the dev project directly.
- A prompt-injected row could steer a write call; manual approval of each call and fictional data are the defences, and the owner reads each statement before approving.
- The production project is never connected. Adopting it needs a new ADR, and `read_only=true` is the starting point.
- To end the arrangement, run `claude mcp remove supabase-dev --scope user`, and revoke the grant in the Supabase account's authorised apps.

# ADR-100 · The admin's project moderation: the server side (S7-T04, part A)

- Status: Accepted
- Date: 2026-11-09
- Related: ADR-065 (listing moderation, the same pattern), ADR-086 (the project form's server), ADR-094 (the `builder_edit` limit), FR-ADM-03, BR-40 to BR-44
- Plan for S7-T04 approved by the owner on 9 Nov 2026 ("approved"), taking the recommended answers: a fixed reason for a rejection, and only approved projects can be featured.

## Decision

- **A new `project-moderation` feature, and one definer function in the database.** The guard trigger on `projects` keeps the moderation columns (state, published, featured, reason, who and when) for the system alone, the super admin included, so the admin's decisions cannot be plain updates. `moderate_project(project, action, reason)` does what `moderate_listing` does for homes: it checks for itself that the caller is a super admin, locks the row, and applies the one change each decision means. The database trigger records each change in the audit log (`project.moderation_changed`) with the admin as the actor, so the actions have no `audit` entry.
- **Six decisions, each with the state it needs.**
  - **Approve:** a pending or a rejected project becomes approved; the reason is cleared. Whether it is published is not touched, so a live project a builder edited goes live again as soon as it is re-approved.
  - **Reject:** only a pending project. It becomes rejected, and is neither published nor featured.
  - **Publish:** an approved project that is not published. **Unpublish:** a published project.
  - **Feature:** an approved project that is not featured. **Unfeature:** a featured one.
  - Anything else is a conflict (another admin decided first, or the page is out of date), and nothing changes.
- **A rejection carries a fixed reason.** The table requires a reason on a rejected project, but the approved dialog ("Reject Nila Grove?") has no reason box. The function stores "Rejected by an admin." when none is given (and accepts a real one, 1 to 500 characters, for a later screen). Nothing shows the reason to the builder yet. This keeps to the approved screen and adds no wording; the owner may want a reason box later.
- **Delete is the admin's own policy plus the lead foreign key.** `projects_delete_admin` lets only the admin delete; a project with leads cannot be deleted (BR-44), and the database answers with a foreign-key error, which the action turns into a conflict the page explains ("It has N leads. Unpublish it instead."). A project's units go with it (existing cascade). Uploaded files are left for the existing media sweep.
- **Seven actions, `admin_decision` limit.** `moderateProject` (the six decisions) and `deleteProject`, both for a super admin, limited with the admin's other decisions (`admin_decision`, 120 an hour: no new scope and no change to `docs/engineering/security.md`). No idempotency key: a repeat meets the new state and is a conflict, a repeat delete finds nothing. Both refresh the project's page, the lists and the homepage's developers. They run as the signed-in admin, not the service role.
- **The list.** `admin_project_overview()` (definer, super admin only, checks itself) returns every project, newest first, with the builder's name, the first picture and the number of leads, which no table read gives in one call. The page reads up to 500 projects and filters them in the browser, as the builder's list does; `getAdminProjects()` reads one more than that to know whether the list was cut, and the page (part B) says so.
- **Types.** `src/types/database.types.ts` gains both functions, written by hand in the generated format; CI's database check compares it.
- **Not in this change:** the page and its words (part B).

## Consequences

- One migration and its pgTAP test (37 checks, run in CI); a feature with its unit tests (who may call each action, the error mapping, the stores, the rows and the read) and an integration test (run in CI) of the decisions, the delete refused for leads, the list and a builder refused. The hosted dev database changes only through the db-deploy workflow, after the owner merges. No package, environment, CI or protected-file change.
- Rollback: drop both functions (`drop function public.moderate_project(uuid, text, text)`, `drop function public.admin_project_overview()`) and delete the feature. Decisions already made stay as ordinary values of the project's state.

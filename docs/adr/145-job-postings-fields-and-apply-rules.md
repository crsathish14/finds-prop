# ADR-145 · Job postings: the fields, the visibility rule and the apply link

- Status: Accepted. Decision D4 of ADR-143 (an external link or an email address only, no applicant data stored) was approved by the owner on 18 Nov 2026; this records the exact shape built for phase 4.
- Date: 2026-11-21
- Related: ADR-143 (the Blog, FAQ and Careers programme, sections 3, 4, 5 and 7), ADR-144 (the Blog's table, which this copies), ADR-017 (public columns), ADR-124 (retention, untouched here), R-SEC-10 (never draw user text as HTML)
- Class: C2 (a migration, a policy, a function). No dependency, no new service.

## Decision

- **One table, `job_postings`**, with the fields ADR-143 section 3 lists: `slug` (unique), `title`, `department_id` (a `content_categories` row whose module is `department`, checked by a trigger; a department that has jobs, even trashed ones, cannot be deleted), `location`, `work_mode` (`onsite`, `hybrid`, `remote`), `employment_type` (`full_time`, `part_time`, `contract`, `internship`), `experience` (free text, up to 80 characters, may be empty), `summary`, `description`, `responsibilities`, `requirements`, `salary_note` (optional), `apply_url` or `apply_email`, `status` (`draft`, `open`, `closed`), `closes_at`, `deleted_at` and the timestamps, with a generated `search_vector`.
- **One added column, `posted_at`**, which ADR-143 did not list. A trigger sets it the first time a job is opened and keeps it when the job is closed and opened again, like the Blog's publish date. The structured data needs it (`datePosted`) and the list is ordered by it. No client writes it.
- **Plain text, never HTML.** The summary is one line (up to 320 characters). The description is paragraphs (a blank line starts a new one, up to 8,000 characters). The responsibilities and the requirements hold one point per line (up to 4,000 characters each) and are drawn as lists. The pages draw all of it as text.
- **Exactly one way to apply.** A check requires exactly one of `apply_url` and `apply_email`. The link must be **https**, have a host and have no sign-in part before the host (`https://user@evil.test` is refused), no spaces, at most 500 characters; the form and the table use the same pattern (a test reads the migration and fails when they drift). The email address has the usual shape, up to 254 characters. The platform stores no applicant data.
- **Who sees a job.** A visitor, a signed-in customer and a builder read a job only when it is `open`, its `closes_at` is empty or still ahead, and it is not in Trash. The test is in the row policy, so the pages, the sitemap and the AI tools see the same rows, and an expired job disappears with no scheduled job. `search_job_postings()` states the same rule itself, so the super admin's call returns what a visitor sees. The super admin reads every row. Both public roles hold the same named column grants (`apply_url` and `apply_email` are public on purpose: they are what the Apply button opens).
- **Complete before open.** A check requires a summary, a description and requirements on an open job; the service names the missing box, and refuses a closing date that has already passed when a job is opened.
- **Trash is an update.** `deleted_at` is set and no client holds the DELETE privilege. A check makes "open and in Trash" impossible: trashing an open job closes it in the same write, so restoring a job never puts it back on the site; opening it again is the admin's choice. The nightly retention job removes old Trash later, in its own change.
- **Search.** `search_job_postings(query, department slug, location, work mode, type, limit, offset)` runs as the caller (SECURITY INVOKER) with the `english` configuration (title weighs most, then summary and place, then the long text), returns a short snippet with the matched words between `[[` and `]]`, and the total before the page limit on every row. A search of filler words only finds nothing.
- **Audit.** A trigger records `content.changed` for `job_posting` with the module `careers`, the id and the names of the changed columns, never the text.
- **Actions.** Seven super-admin actions (`createJobPosting`, `updateJobPosting`, `openJobPosting`, `closeJobPosting`, `unpublishJobPosting`, `trashJobPosting`, `restoreJobPosting`), each limited as `admin_edit` and each refreshing the `careers` tag and the job's own `job:<slug>` tag (the old address too after a rename).

## Draft wording

The new validation messages in `en.json` (`jobSlugInvalid`, `jobSlugTaken`, `jobApplyUrlInvalid`, `jobApplyEmailInvalid`, `jobApplyOne`, `jobNeedsSummary`, `jobNeedsDescription`, `jobNeedsRequirements`, `jobClosesPast`) are draft wording awaiting the owner's approval, as ADR-143 section 8 requires.

## Not here

The Design Lab parts and the connected pages (the next two pull requests of phase 4), the AI tools (phase 5), and the retention of old Trash (a shared change).

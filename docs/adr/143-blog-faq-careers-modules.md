# ADR-143 · Blog, FAQ and Careers modules, with the AI assistant reading them (plan and scope change)

- Status: Accepted. The owner approved the plan and every recommended answer on 18 Nov 2026 and said to go ahead without asking for permission at each step (see "Approval" below).
- Date: 2026-11-18
- Related: ADR-128 (AI chat; sections 4.1, 4.4, 5 and 6.4 are extended, not replaced), ADR-142 (the last tool change), ADR-017 (public projections), ADR-047 (SEO), ADR-048 (cache tags), ADR-028 (audit log), ADR-124 (retention), ADR-089 to ADR-102 (site content, the pattern for admin pages), ADR-105 and ADR-115 (the sponsor image upload), FR-PUB-12, FR-PUB-14, FR-ADM-10, `docs/requirements/v1-scope.md` section 6 (change control, rule 2)
- Class: C2 for the whole programme (a scope change, new tables and public pages, new AI tools, a prompt change). Each pull request below is still written from the template and ticks one class.

## Approval

On 18 Nov 2026 the owner asked for three new modules (Blog, FAQ, Careers) managed from the existing admin dashboard, shown on public pages that match the site, and readable by the existing AI assistant. The owner saw the plan, accepted every recommended answer (D1 to D6 below) and added three requirements: the on/off switch for each module is in the admin dashboard, two or more pull requests may be built in parallel, and no permission is needed between steps. This ADR records that. It is a scope change under change control rule 2 of `v1-scope.md`; the rows added to the requirements, the scope table and the traceability table are in this change.

## 1. Goal

- **Blog:** real estate articles, buying and selling guides, rental advice, investment tips, market trends and property news.
- **FAQ:** questions and answers in categories: buyers, sellers, tenants, property owners, agents and the platform.
- **Careers:** open jobs with a department, a description, requirements and a link to apply.
- Each module: create, edit, delete, publish and unpublish from the admin dashboard with no developer; a public list page with search, categories and filters; SEO; reuse of the existing database, sign-in, components and architecture; nothing hard-coded; no second admin.
- The AI assistant answers from published blogs, FAQs and open jobs, with source links, together with live property data, and never from unpublished, deleted or closed content.

## 2. Decisions

| #   | Question                      | Decision                                                                                                                                                                                                                                   |
| --- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | How the AI reads the content  | **Live typed read tools over Postgres full-text search**, like every other tool in ADR-128. No embeddings and no second copy of the content, so there is nothing to synchronise. pgvector only if the evals show poor recall (section 6.6) |
| D2  | Blog body format              | **Structured blocks** (heading, paragraph, list, quote, image) stored as validated JSON and drawn by our own components. No new dependency, no raw HTML, nothing to sanitise                                                               |
| D3  | Delete                        | **Soft delete** (`deleted_at`, shown as Trash in admin, restorable) and a purge by the nightly retention job after 30 days                                                                                                                 |
| D4  | Applying for a job            | **An external link or an email address only.** The platform stores no applicant data in this release                                                                                                                                       |
| D5  | Scheduled publishing and RSS  | **Left out of the first release**                                                                                                                                                                                                          |
| D6  | Blog author                   | **A plain author name** typed by the admin, not a profile                                                                                                                                                                                  |
| D7  | Switching a module on and off | **An admin setting, not an environment flag.** A switch per module on `/admin/dashboard` and at the top of each module's admin page, stored in `site_settings`, audited, taking effect at once (section 5)                                 |

## 3. Data model (forward-only migrations, one per module, RLS and pgTAP in each)

- **`content_categories`** (shared): `id`, `module` (`blog`, `faq` or `department`), `slug`, `name`, `sort_order`, `active`. One table and one category manager serve all three modules. Unique on (`module`, `slug`).
- **`blog_posts`**: `slug` (unique), `title`, `excerpt`, `body` (jsonb array of blocks, validated by a check and by Zod), `cover_path` (a file in the `site-assets` bucket), `category_id`, `tags text[]`, `author_name`, `status` (`draft`, `published`, `archived`), `published_at`, `seo_title`, `seo_description`, `deleted_at`, `created_at`, `updated_at`, and a generated `search_vector` with a GIN index.
- **`faqs`**: `category_id`, `question`, `answer` (plain paragraphs), `sort_order`, `status` (`draft`, `published`), `deleted_at`, timestamps, `search_vector`.
- **`job_postings`**: `slug` (unique), `title`, `department_id`, `location`, `work_mode` (`onsite`, `hybrid`, `remote`), `employment_type`, `experience`, `summary`, `description`, `responsibilities`, `requirements`, `salary_note` (optional text), `apply_url` or `apply_email` (exactly one), `status` (`draft`, `open`, `closed`), `closes_at`, `deleted_at`, timestamps, `search_vector`.
- **Who may read:** `anon` and `authenticated` may select only rows that are visible to a visitor: a post is `published`, an FAQ is `published`, a job is `open` and (`closes_at` is null or in the future); none may have `deleted_at`. The test is in the row policy, so a visitor, the AI tools and the sitemap all see the same rows, and an expired job disappears with no scheduled job. Column grants name the public columns (ADR-017).
- **Who may write:** only the super admin (the same function the site settings use). Every change is audited (`content.changed`, ids and changed column names only, like `cms.changed`).
- **Retention:** rows in Trash for more than 30 days are removed by the nightly retention job (ADR-124), with its own audit entry.
- **Module switches:** the `site_settings` key `content_modules` holds `{ blog, faq, careers }` booleans, merged over defaults in code like the other keys (BR-80 to BR-82). The default is on for a module whose pages are built, so a deploy does not hide anything by itself.
- **Cover images:** the existing public `site-assets` bucket (admin-only write, 500 KB cap, no SVG) under `blog/<id>/`, uploaded the way sponsor images are (ADR-105, ADR-115).

## 4. Public pages

| Route             | Content                                                                                                           |
| ----------------- | ----------------------------------------------------------------------------------------------------------------- |
| `/blog`           | Article list: search box, category chips, tag filter, pagination. State in the URL (`?q=&category=&tag=&page=`)   |
| `/blog/[slug]`    | Article with the block body, author, date, reading time, related articles, breadcrumbs, share links               |
| `/faq`            | Questions grouped by category (accordions), a search box, a link to contact. An anchor per question (`#faq-<id>`) |
| `/careers`        | Open jobs with filters for department, location, work mode and type                                               |
| `/careers/[slug]` | Job detail with description, requirements and an Apply button (external link or email)                            |

- Built from the existing header, footer, section head, cards, filters, pagination and CTA band. Parts that do not exist yet are designed in the Design Lab first (R-FE-06), with pictures from CI.
- **SEO:** unique title and description per page, canonical, Open Graph, `Article`, `FAQPage`, `JobPosting` and `BreadcrumbList` structured data (`features/seo`), sitemap entries (`features/sitemap`) for published posts, FAQ page and open jobs only. A draft, trashed, closed or hidden-module page is not in the sitemap and answers 404.
- **Cache:** new tags `blog`, `faq` and `careers` in `src/lib/cache-tags.ts`, with `tagsAfter…Change` helpers; every action that changes content lists them in `invalidate`. The existing cache-tag test fails if a read uses a tag nothing refreshes.

## 5. Admin dashboard

- A new group, "Content", in the admin sidebar (`src/features/admin/nav.ts`) with Blog, FAQ and Careers. Three icons are added to `AdminIconName`.
- **List pages** with status and category filters, search, publish, unpublish, move to Trash, restore. **Edit pages** use the project editor's save bar and sections. The blog editor has a block editor, an image picker, an SEO panel and a preview. The FAQ editor orders questions. The job editor has a Close posting button. A category manager drawer is shared.
- **Module switch.** `/admin/dashboard` gets a "Content modules" card: one row per module with a switch, a Live or Hidden label, the counts of published and draft items, and a one-line description of what Off does. The same switch is at the top of each module's admin page. Turning a module Off asks for confirmation; turning it On does not. Off means:
  - the public pages answer 404 (the same not-found page);
  - the module's default links leave the header, footer and homepage (a link the admin typed into the footer editor is not removed automatically; the footer editor says so);
  - its URLs leave the sitemap and its structured data and feed are gone;
  - the AI tool for the module returns nothing and the assistant's scope text stops naming it;
  - content stays in the database and the admin pages keep working, so it can be edited while hidden.
- The setting is saved under the site-settings cache tag, so it takes effect at once, and it is audited as `cms.changed`.
- Only the super admin can change content or the switches (no new role).

## 6. AI assistant (extends ADR-128, replaces nothing)

1. **No new infrastructure.** The assistant keeps reading live data through typed tools. The model never touches the database and never writes a URL.
2. **Three new read tools** (`AI_CHAT_TOOLS` goes from ten to thirteen), all `kind: "read"` so they can run in the same round as `search_properties`, inside the existing 3 parallel reads and 6 calls per message:
   - `search_content` (articles and FAQs): input `query`, `kind` (`any`, `article`, `faq`), `category` (nullable), `limit` (nullable, at most 5). Returns the best matches ranked by `ts_rank` with a snippet of about 300 characters cut from the best-matching passage (`ts_headline`), a title, a category and a publish date.
   - `get_content_item`: input the id from a search. Returns the best-matching sections of one article, FAQ or job, at most about 2,500 characters. Never a whole long article.
   - `search_jobs`: input `query`, `department`, `location`, `workMode` (all nullable). Returns title, department, location, work mode, type and closing date for open jobs only.
3. **Token cost.** Nothing about the content is in the system prompt or the history. A tool runs only when the model asks. Results are small (about 100 to 150 tokens per item, at most 5 items), a second call is a deliberate choice, and tool results are not sent back with later messages (the browser sends only text turns). A cap on content calls per message (2 of the 6) and the snippet and section sizes live in `src/config/ai.ts`. The fixed overhead of three more tool definitions is measured in the evals and the daily budget is checked against the measured figure (phase 5).
4. **Sync with admin changes.** There is nothing to synchronise: the tools read through the same row rules as the site. A cached read is tagged and refreshed by the same `tagsAfter…Change` helpers, so publish, update, unpublish, delete, close and a module switch change the AI's answers as soon as the page changes. A module that is switched Off returns an empty result.
5. **Source links.** `ToolReference` gains the kinds `article`, `faq` and `job`. The server builds each link from an id a tool returned in the same message (`/blog/<slug>`, `/faq#faq-<id>`, `/careers/<slug>`) and the chat draws a "Sources" row. A link the model wrote is still never drawn, and the output check allows only these built links.
6. **Retrieval quality.** Full-text search matches words, not meaning, so Tamil, Tanglish and loosely worded questions rely on the model writing English keywords into the tool input, as it already does for places and localities. The evals include rephrased, Tamil and Tanglish questions. If recall is below the threshold set in phase 5, pgvector is added as its own phase (already approved in principle in ADR-128 for later use) behind the same tools, with a database trigger that marks changed rows for re-embedding and the same row rules, so the tools and the answers do not change.
7. **Safety.** Article, FAQ and job text goes through the existing untrusted-text wrapper (`untrusted.ts`) even though an admin wrote it. Figures from a tool result are allowed by the number check. The advice rules stay: an article is information, not legal, tax or investment advice, and a market-trend item is quoted with its publish date.
8. **Prompt.** The scope section names the new content and the off-topic section stops treating careers as off-topic. The prompt version is raised. All new fixed wording is in `en.json` and starts as draft wording flagged in the pull request.
9. **Evals** added to the golden and red-team sets: an unpublished, trashed, hidden-module or closed item never appears; a source link is present on a content answer; an article that tries to instruct the model is ignored; a mixed question ("registration charges and 2BHKs in Velachery") calls a content tool and `search_properties` together; a question with no match says so; a Tamil and a Tanglish question find an English item. A test walks `AI_CHAT_TOOLS` and checks the three new tools against the registry rules (read-only, no person as input, small result).
10. **Usage rows** already store tool names as snake_case text (ADR-128 section 8), so no migration is needed for the new names; the first AI pull request confirms it.

**Built in AI pull request 1 (21 Nov 2026): `search_content`, `get_content_item`, source links, offline evals.** What differs from the text above, and why:

- `search_content` and `get_content_item` are `kind: "read"` tools of a new call group, `content`, whose cap (2 of the 6 calls per message, `MAX_CONTENT_TOOL_CALLS_PER_MESSAGE` in `src/config/ai.ts`) the loop counts across rounds; a third call gets the new error code `content_limit` and does not spend the message's total. `search_jobs` is not built: it waits for Careers (`job_postings`) to be on `develop`, and `get_content_item` leaves a marked extension point (`readContentItem` in `content-queries.ts`) for jobs.
- `get_content_item` takes the id **and** a nullable `query` (the words that choose which sections are returned). Without the words it could only return the beginning of an article. The sections are cut at the article's headings and the best-matching ones are returned in reading order, at most 2,500 characters, never a whole long article.
- No new SQL: `search_faqs` (ADR-143 phase 2) already ranks with `ts_rank` and `search_blog_posts` (ADR-144) returns the `ts_headline` snippet, so the tool uses both through the features' own reads. The question's passage of about 300 characters is cut in code from its best-matching paragraph. One new feature read, `getPublishedBlogPostById`, takes the id a search gave; it is the page's read with another key and carries the Blog's cache tag, which every `tagsAfterBlogChange` refreshes. A search is never cached.
- The one helper that tells whether a module is on is `getContentModuleOn` (`src/features/site/modules.server.ts`); the text above calls it `isModuleOn`. A module that is off is not read at all, and a search of both kinds returns whatever the other module holds.
- A search of both kinds takes turns between the two lists, an article first, because the two use different text search configurations (`simple` and `english`) and their ranks cannot be compared.
- `ToolReference` gains `article`, `faq` and, reserved and unused, `job`. The server builds the address (`src/features/ai-chat/source-links.ts`: `/blog/<slug>`, `/faq#faq-<id>`, `/careers/<slug>`). The chat gets a `source` stream event and draws a "Sources" row of at most 3 links: when the assistant read an item in full only those are drawn, otherwise the best search matches. The output check drops a path or marker the model wrote unless it names an item a tool returned in the same message. The Design Lab has no part for the row: it uses the shared `Link` and `Text`, so no new picture is needed.
- The usage table already accepts any snake_case tool name (`tools_ran` has a pattern check, not a list), so no migration is needed for the new names; a test reads the migration and the registry to hold this.
- Tool descriptions live in the tool files. The system prompt is untouched in this change (no `SYSTEM_PROMPT_VERSION` change); the scope text, the off-topic section and the real-model run are AI pull request 2.

**Built in AI pull request 1b (21 Nov 2026): `search_jobs`, jobs in `get_content_item`, offline evals.** Careers is on `develop`, so the third read tool is added; the prompt is still untouched (AI pull request 2):

- `search_jobs` (`callGroup: "content"`, so it shares the 2 content calls of the 6 per message) takes `query` (nullable: null lists the open jobs), `department` (a slug an earlier result gave), `location`, `workMode`, `type` and `limit` (all nullable, at most 5). It reads through the Careers page list (`getJobList`), as an anonymous visitor, so a draft, a closed job, one past its closing date and one in Trash are not there, and a switched-off Careers module gives an empty result (asked through `getContentModuleOn("careers")`, nothing read from the module). A search with words is never cached.
- Each result has the job id, department word, work mode, type, last day to apply (`closesOn`, India time) and, under `untrustedText`: title, department, place, experience, pay note and a passage of about 300 characters. The place is called `place` in the result because `location` is on the list of private keys the registry test refuses.
- `get_content_item` reads a job by the id a search gave: the summary, the description paragraphs, then the responsibilities and the requirements as points, cut to the same 2,500 characters. The new read `getOpenJobById` (Careers feature, cached under the `careers` tag) is checked again with `isJobOpenAt`, because a cached job may have passed its closing date a few minutes ago.
- The `job` source reference reserved in AI pull request 1 is now used: `/careers/<slug>`, built by code from the slug the read returned. The name `search_jobs` joins the internals-probe and internals-leak word lists.
- The tool never asks for, reads or stores applicant data: its description says that nobody applies through the chat, that no CV, phone number or email address is taken, and that the job page is shown as the source (ADR-147).
- Evals: the stand-in world gains 7 made-up jobs (open, draft, closed, trashed, and one written to steer the assistant) and a switch for Careers. New cases: 6 golden (`G-jobs-01..06`) and 6 red-team (`R-jobleak-01..03`, `R-injectedjob-01..02`, `R-jobref-01`). Golden is 109 cases and red-team 69.

## 7. Phases and the pull requests

Each phase is one or more small pull requests into `develop`. Where the existing process splits a task (server, Design Lab parts, connected pages), the split is kept.

| Phase | Work                                                                                                                                                                                                                                     |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | This ADR, the requirement, scope and traceability rows                                                                                                                                                                                   |
| 1     | The shared base: `content_categories`, the `content_modules` setting and its card on `/admin/dashboard`, the sidebar group and icons, cache tags and their helpers, the sitemap hook, empty message groups, a Design Lab slot per module |
| 2     | FAQ: migration and pgTAP, server code, Design Lab parts, admin pages, public page, structured data                                                                                                                                       |
| 3     | Blog, in the same steps, plus the block editor                                                                                                                                                                                           |
| 4     | Careers, in the same steps                                                                                                                                                                                                               |
| 5     | The AI tools, prompt, source links, evals, token report                                                                                                                                                                                  |
| 6     | Sitemap and SEO polish, regression run of property search and the AI chat, `npm run verify`, docs                                                                                                                                        |

**Parallel tracks.** After phase 1 merges, FAQ, Blog and Careers do not depend on each other and run as separate tracks, each in its own worktree. Inside a track the server pull request and the Design Lab parts pull request can also run side by side (the parts use demo data). The AI tools wait for the content tables to be on `develop`. To keep tracks from colliding, phase 1 pre-registers every shared file entry (nav items, icons, cache tags, sitemap hook, message groups, the Lab slot), and every track checks ADR and migration numbers against `develop` and every open branch before it pushes.

## 8. Reused, and risks

**Reused:** `defineAction`, the audit triggers, `site_settings` and its cache tag, `ProjectSaveBar`, `FormSection`, `ManagerDrawer`, `ConfirmDialog`, the sponsor image upload, `features/seo` and `features/sitemap`, the retention job, the AI tool, reference and eval harnesses, the card and filter components.

**Risks and how they are handled**

- **Design Lab pictures.** A new board can make the board link row wrap and change every board picture at 390 px. New parts go into existing boards or the row is checked first.
- **The automatic AI chain** (`docs/ai-chat-run-ledger.md`) edits the same prompt and tool files. Phase 5 starts from the current `develop`, and the ledger is read before it starts.
- **Stale advice** in old market articles: the date is in every result and the prompt says to quote it.
- **Full-text search is weaker for Tamil and Tanglish** (section 6.6).
- **Soft-deleted rows** must never leak: the row policy, not the application, hides them, and a pgTAP test proves it for anon, authenticated and the AI read path.
- **A hidden module** must disappear everywhere at once: one helper, `isModuleOn`, is used by the pages, the nav, the sitemap and the AI tools, and a test fails if one reads the setting another way.
- **Wording** is new visitor-facing text. It starts as draft wording, is flagged in each pull request, and the owner's earlier approval of "everything as recommended" covers the structure, not each sentence.

## 8a. Built in Careers pull request C (21 Nov 2026): the connected pages

The admin's `/admin/careers` (the shared JobManager with its status tabs, department filter and search in the address, the departments drawer, and Open, Close posting, Reopen, Restore and Move to Trash on each row), the job form at `/admin/careers/new` and `/admin/careers/[id]` (one press of Save makes a new job and then stores the whole form; Open job and Close posting are their own buttons; a closing date is typed and shown in India time), and the public `/careers` and `/careers/[slug]` pages (search, four filters and page links in the address; the job page draws the Apply button as a link or an email, or the closed note when the closing date has passed since the page was cached). A job is in the sitemap and in the structured data (JobPosting) only while it is open. A switched-off module answers not-found on every public Careers address and drops the footer link. No new component: every part is from the `careers` Design Lab board; the job header gained a `headingLevel` so a page with its own level-1 title can draw it as level 2.

## 9. Not in this release

Scheduled publishing, an RSS feed, comments, a staff-profile author, in-site job applications and applicant storage, translations, file uploads other than the cover image, vector search (unless the evals call for it).

# Content modules: Blog, FAQ and Careers

For the super admin and whoever supports the site. Design and decisions: ADR-143 (the programme), ADR-144 (Blog), ADR-146 (Trash and purge) and ADR-147 (Careers). Everything below is done from `/admin/dashboard` and the admin pages, with no developer.

## Turn a module off, and back on

- `/admin/dashboard`, card "Content modules": one switch for Blog, FAQ and Careers. The same switch is at the top of each module's admin page. Turning it Off asks for confirmation; turning it On does not. Each change is audited as `cms.changed`.
- **Off** means, at once and everywhere: the public pages (`/blog`, `/blog/<slug>`, `/faq`, `/careers`, `/careers/<slug>`) answer the normal not-found page, the Blog, FAQ and Careers links leave the header and the footer (also a link the admin typed there), the sitemap stops listing them, the structured data goes with the pages, and the AI assistant's tools find nothing (`search_content`, `get_content_item` and `search_jobs` answer as if there were no content). The admin pages keep working, so content can be edited while hidden.
- **Nothing is deleted** by switching off. Turning it On shows everything that was published or open before.
- The assistant's fixed scope text (its system prompt) is not changed by a switch: it may still say it can answer from articles, questions or jobs, and then tells the customer plainly that it found nothing. This is known and accepted until the prompt is next revised (ADR-143, "Phase 6 audit").
- If a page still shows after switching off, wait a minute and reload: the switch is saved under the site-settings cache tag and every read asks for it, so the delay should be a few seconds. If it is longer, check that the save really happened (the card shows "Hidden") before suspecting a cache.

## Publish, unpublish, close, Trash

- **Blog:** Draft, Published, Archived. Only Published and not in Trash is public. **FAQ:** Draft or Published; a question also needs an active category. **Careers:** Draft, Open or Closed. Only Open, before its closing date and not in Trash, is public: a job disappears on its own at the closing date (the page may show "closed" for a few minutes while a copy is still kept).
- **Move to Trash** hides the item from visitors, the sitemap and the assistant and keeps it for 30 days; **Restore** (Trash tab) brings it back as a draft. A published article or question is unpublished in the same step.
- A category that still holds items, even trashed ones, cannot be deleted. Renaming or switching off a category refreshes all three modules.

## What is purged, and when

- Blog articles and FAQ questions whose Trash date is more than 30 days old are removed by the nightly retention job, with a `content.purged` audit entry (ids and counts, never text). The pictures of a purged article are removed by the hourly media sweep. How to check both: `docs/runbooks/retention.md` ("Content in Trash") and `docs/runbooks/media-sweep.md`.
- **Job postings in Trash are purged after 30 days**, like FAQs and articles (`content_trash_tables`, ADR-146).

## What the AI assistant reads

- Only what a visitor can read: published articles, published questions in active categories, and open jobs before their closing date. It reads live through the same rules as the site (as an anonymous visitor), so a publish, an unpublish, a close, a move to Trash or a module switch changes its answers as soon as the page changes. Nothing is copied or stored for it.
- It never takes or stores applicant data: nobody applies through the chat, and the job page is shown as the source link (ADR-147).
- Text an admin typed is handed to the model as quoted data, never as instructions. If an article ever appears to steer the assistant, unpublish it and tell the developer; the offline evals hold cases for this (`R-injectedjob-*`, `R-scope-*`).

## When something looks wrong

| Symptom                                            | Check                                                                                                                                              |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| A page is not found though it is published         | The module card shows Hidden; the item is in Trash; for a job, the closing date has passed; for a question, its category is inactive.              |
| An item shows on the site but not in the assistant | The assistant never offers a search by free words from a cache: ask again; check the module card and the item's status and category.               |
| The sitemap lists a page that is not found         | Open `/sitemap.xml` again after a minute; the content entries are rebuilt from the same rules as the pages (and jobs past their date are dropped). |
| A picture of an article is missing after a restore | Restore within 30 days keeps the files; after the purge they are gone for good (ADR-146).                                                          |

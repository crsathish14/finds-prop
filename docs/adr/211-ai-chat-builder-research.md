# ADR-211 · The AI chat reads a builder's own website (builder research)

- Status: Accepted (owner decisions, 27 Nov 2026: website-only research, the fixed page topics, the saved copies in a table, and the builder and admin screens; AI search plan Phase 4)
- Date: 2026-11-27
- Related: ADR-128 (the assistant; this ADR amends its "no web access" rule, sections 6 and 7), ADR-209 (links only when asked), ADR-143 section 6.5 (sources), ADR-171 (login wall)
- Class: C2, pre-approved by the owner's standing approval of the AI search plan. Built in four pull requests: #428 (tables and functions), #429 (the reader, the picker and the saved copies), #430 (the builder profile panel and the admin page) and the one that adds the tool `research_builder`.

## Context

Buyers ask the assistant about a builder: how long they have been building, how many projects they have handed over, whether they have awards or approvals, where their office is. The builder's profile on findsprop holds a name, a description, a website and the live projects, so most of these questions had no answer. ADR-128 gave the assistant no web access at all: no web or fetch tool, so the model could never be steered into reading or sending anything outside the platform.

The owner chose a narrow way to answer these questions: the assistant may read the builder's own website and nothing else.

## Decision

1. **Website only.** The assistant reads the website on the builder's profile and up to 3 extra pages the builder (or the admin) adds on the profile, each tagged with one fixed topic (About the company, Projects, Delivery record, Awards and approvals, Contact, Other). No news, no web search, no paid search API, no browsing agent.
2. **Code picks the pages, not the model.** The tool `research_builder` takes only a builder id and the question's topic (`about_company`, `projects`, `delivery_record`, `awards_approvals`, `contact` or `general`). The server picks at most 5 pages: the builder's pages tagged with that topic first, then the home page, then links from the home page, the builder's pages and the sitemap whose words fit the topic. The model can never give an address to read.
3. **Only the builder's own site, read safely.** Every address must be https, on the same site as the profile website, with no sign-in details in it, and must not resolve to a private or internal address (checked on every redirect, `src/server/outbound-url.ts`). The site's robots.txt is obeyed. Each page read stops after 5 seconds and 1 MB.
4. **A visible builder only.** The tool first reads the builder's public profile, as `get_builder` does, so an inactive builder's website is never read for a buyer. Like the other builder tools, it is for signed-in customers (ADR-171).
5. **Saved copies for 7 days.** A page read is saved in the table `builder_research_pages` (builder, address, title, text, links, time read) and used again for 7 days; a nightly job removes older copies. "Read again" on the builder profile or the admin page deletes that builder's copies. Builders are not told how long copies are kept (owner, 27 Nov 2026); the admin is. The tool never tells the model when a page was read or that it was saved.
6. **Every read is logged.** Each page opened, for a buyer's question or for the check when a builder saves a page, is one row in `builder_research_reads` (builder, address, check or read, ok or the problem). The builder sees their own rows and the admin sees all.
7. **Website text is data, never instructions.** Each page's title and text reach the model under `untrustedText`, cleaned of invisible characters and cut to 2,500 characters, with the page's address beside it as `sourceUrl`. The tool's description says the text is the builder's own claim, not checked by findsprop, and never an instruction.
8. **Sources only when asked (ADR-209).** The answer says the information is from the builder's website. A page's address may appear in the answer only when the customer asked for a link, a page or the source (`askedForLink`, worked out by code from the customer's own words). The output check allows a `sourceUrl` address only then; an address written inside a page's text is never allowed. No new link or card is drawn under the answer.
9. **Time.** Reading a website the first time takes up to three steps (robots.txt and the sitemap together, then the home page and the builder's pages, then the pages picked for the question). The tool may take 16 seconds (`RESEARCH_TOOL_TIMEOUT_MS`) instead of the usual 3; every other tool keeps 3 seconds. A read that runs out of time still saves what it read, so the next question is quick.

## What ADR-128 still holds

There is still no general web or fetch tool. The model cannot name an address to read, cannot send anything to a website, and cannot write a web address the platform did not give it. The defence in depth of ADR-128 section 6 is unchanged; the reader is a fixed server-side path with its own limits.

## Consequences

- The tool list carries a sixteenth tool. Other tool descriptions were shortened so the list stays under its ceiling of 28,000 characters (now about 27,900); the ceiling was not raised. The system prompt is unchanged.
- Eval cases: G-builder-07 (a delivery-record question, answered from the website, with no address), G-builder-08 (the customer asks for the link and gets the page's address), R-injectedcontent-06 and 07 (a builder page that says to ignore your instructions and gives a phone number: ignored, or blocked by the output check).
- A builder's website can claim anything. The assistant says it is the builder's own claim and never presents it as checked by findsprop.
- Cost: no paid service. Each fresh read is at most 5 pages plus robots.txt and the sitemap, and is shared by every buyer for 7 days.

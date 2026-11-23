# ADR-176 · AI search: a plain project enquiry and a one-month site-visit window

- Status: Accepted (the owner agreed the plan on 23 Nov 2026 and answered that the one-month limit applies to the AI search only; the customer-facing wording is **draft and waits for the owner's approval**).
- Date: 2026-11-23
- Amends: ADR-174 (a project now offers the choice "enquire, or book a site visit"), ADR-128 section 5.3 (a third propose tool)
- Related: ADR-175 (reply buttons: "Enquire about this project", "Book a site visit")
- Class: C2 (a new propose tool and a new kind of signed proposal; the send path is the existing one). No migration, no dependency, no change to the project page or its form.

## Context

The chat could prepare an enquiry about a home and a site visit for a project, but not a plain enquiry to a project's developer (the project page can take one: `submitProjectLead` with `kind: "enquiry"`, no day). The owner wants a project to be offered as "enquire, or book a site visit", and wants the assistant to arrange a visit only for a day soon enough to be real: from today to one month ahead.

## Decision

- **A new tool, `propose_project_enquiry`** (`tools/propose-project-enquiry.ts`), input `slug` and `message` only. It is the twin of `propose_enquiry` for a project and of `propose_site_visit` without a day. It writes and sends nothing, takes no person, signs a proposal for the signed-in customer only, and gives `sign_in_required` to a visitor, exactly like the other two.
- **Why a tool of its own and not a `kind` input on `propose_site_visit`.** That tool requires a day and checks it. A second mode would make the day optional for one kind and forbidden for the other, which is a rule a model gets wrong. Two small tools with one clear input each are easier for the model, for the schema tests and for the output checks. The cost is one more tool definition (about 1,000 characters on each call; the tool-list ceiling in `fixed-cost.test.ts` goes from 25,000 to 28,000).
- **A new signed proposal kind** `project_enquiry` (`slug`, `message`, no day). `confirm/send.ts` checks it like the others (valid for this customer, project still open, verified phone) and sends it with the existing `submitProjectLead`, `kind: "enquiry"`, keyed by the proposal's own id, so it sends once. The project page's own rules and limits apply unchanged.
- **The confirm card** is the enquiry card with a new optional field `about: "project"`. It shows the project and its developer, has no day, and does not link to "My enquiries" (a project lead is not listed there). A conflict on a project enquiry is a plain failure, never "already contacted this owner" (that rule is for homes).
- **The one-month window, for the AI search only** (`tools/visit-window.ts`). `propose_site_visit` first applies the shared rule (a real day, today to a year ahead: `visitDateProblem`), then also requires the day to be within one calendar month of today, India time (31 Jan gives 28 Feb). A day outside gives `date_out_of_range`, whose description tells the model to say so plainly and ask for a nearer day. The project page's form, the shared rule and the database check are **unchanged** (today to a year ahead); the owner chose this over changing all three. The click re-checks only the shared rule, so a day signed late in the evening is not refused for the stricter month at the click.
- **The prompt** (`CONVERSATION_SECTION`, version `2026-11-23.2`): for a project, ask "enquire or site visit"; an enquiry has no day; for a visit ask the day and never choose one; a visit can be arranged only within the coming month (worded so that an answer saying it does not repeat a run of the prompt's words, which the output check would block).
- **The tool name** is added to the internals-leak list (`AI_INTERNALS_LEAK_PATTERNS`) so the assistant can never print it.
- **Test cases:** 3 golden cases (a project enquiry with the customer's needs in the message; a visit 60 days away refused and re-asked; the same in Tanglish) and unit tests for the tool, the proposal, the offer, the card, the send and the card's screen.

## What does not change

- **Only Send sends.** The tool writes nothing; the card's Send button is the only thing that sends, and a typed yes only prepares the card.
- **Identity from the session only.** The model supplies no person, phone, email or name; the card uses the customer's account.
- **Facts from lookups, no advice, no pressure** (ADR-174).

## Alternatives not taken

- **The one-month limit on the project page and the database too.** Bigger change (the shared rule, the form and a database check, which would need a migration); the owner chose the assistant only.
- **A `kind` input on the site-visit tool:** see above.
- **Treating a project enquiry as a home enquiry card:** the card's "already contacted" and "My enquiries" wording is about homes.

## Consequences

- The assistant has fourteen tools. Every model call carries the new tool's definition.
- A customer who asks the assistant for a visit three weeks away is served, and one who asks for a day two months away is asked for a nearer day or can use the project page.
- **Draft customer-facing wording, awaiting approval:** the assistant's own sentences (see the example lines in the new eval cases, for example "I can only prepare a site visit for a day within the next month. Which day suits you?"). The enquiry card's existing sent text says "The owner can now see your details and message"; for a project enquiry that word is slightly off ("the developer"). It is left as it is until the owner decides the wording.

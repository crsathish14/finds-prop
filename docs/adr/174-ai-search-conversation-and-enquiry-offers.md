# ADR-174 · AI search conversation and enquiry offers

- Status: Accepted (the owner agreed the plan on 23 Nov 2026 and answered six questions; the customer-facing wording below is **draft and waits for the owner's approval**).
- Date: 2026-11-23
- Amends: ADR-128 (the system prompt rules), ADR-143 (nothing changes for articles and jobs)
- Related: the propose tools (`propose_enquiry`, `propose_site_visit`), the confirm card
- Class: C1 for this part (prompt wording, tool descriptions, test cases). No migration, no dependency, no new tool, no screen change. Later parts of the same plan (reply buttons, a plain project enquiry) get their own pull requests and amend this record.

## Context

The owner tried the AI search (the chat page and the home page AI search bar, nothing else) and found it too quiet. It answered one message at a time, in "a few short sentences", never asked what the customer wanted, and never offered the enquiry that it already knows how to prepare. This is a marketing site: when a customer likes a home, the assistant should offer to prepare an enquiry.

## Decision

The owner's answers (23 Nov 2026):

1. **When to offer.** After showing results, end with an offer to enquire about any of them. If the customer asked for one specific home or project, offer for that one. Offer once for each home or project; after a no, do not offer again for it.
2. **Ask first or show first.** Show what matches the ask, and ask questions if needed. If the ask is very general ("show me flats"), ask one or two short questions **before** showing homes (area or city, budget, bedrooms, buy or rent).
3. **Reply buttons under each answer.** Yes. (Built in the next pull request: the server picks fixed buttons; the model does not write them.)
4. **Projects.** Include them: "enquire, or book a site visit?". (A plain project enquiry comes in the third pull request; until then the assistant offers only the site visit for a project, and asks for the day.)
5. **The customer's needs go into the drafted message.** Yes. The customer reads the message on the card before pressing Send.
6. **Scope.** The AI search only.

What this pull request does:

- **A new prompt section, "Talking with the customer"** (`CONVERSATION_SECTION`, after the language rule). It is written as instructions and quotes no sentence an answer would repeat, because the output check blocks a reply that copies a run of eight words from the prompt. It names no tool. It asks the model to: ask one or two short questions before searching for a very general ask, and otherwise search and ask one narrowing question; never ask again for something already said, and keep the stated needs (place, budget, bedrooms, buy or rent, move-in time, loan) for the rest of the conversation; say one real plus point from the result for each home and end every answer with one clear next step; offer an enquiry after results, once for each home or project; prepare the card when the customer accepts or picks a home; put the customer's own stated needs, in the first person and only what they said, into the message; suggest widening the search when nothing matches; stay calm and honest.
- **"Be brief" is relaxed just enough** (`LANGUAGE_SECTION`): still a few short sentences and at most three homes at a time, plus the one closing question or offer.
- **The two propose tool descriptions** no longer say "only when the customer clearly asks". They also allow the case where the customer accepts the assistant's own offer (a yes, or picking one of the homes shown), and say never to use them before the customer has asked or accepted. "A typed yes never sends" and "call it alone, once" stay.
- **The prompt version** moves to `2026-11-23.1`. The fixed-cost test's prompt ceiling goes from 11,200 to 13,000 characters: the new section adds about 2,000 characters to every model call, which is the price of the behaviour.
- **Test cases:** 13 golden and 2 red-team cases (English, Tamil and Tanglish) for: a generic ask leads to questions first; a specific ask leads to results with a plus point and an offer; several results lead to an offer for any of them; "yes, the second one" prepares the enquiry for that home; a "no" leads to no second offer; a project leads to a site-visit offer that asks for the day; nothing matches leads to a suggestion to widen; stated needs are reused; the enquiry message carries the loan, budget and move-in time; a pushy model is caught and the disclaimer added; a typed "send it now" only prepares the card.

## What does not change

- **Only Send sends.** A typed yes only makes the assistant prepare the card. The assistant never says or suggests that anything was sent, booked or submitted. The propose tools write nothing and the confirm card is unchanged.
- **Facts only from lookups.** Every plus point must come from the result. `FACTS_SECTION` and `ADVICE_SECTION` are untouched; the new section points at them and does not weaken them.
- **No pressure and no advice.** No urgency ("few left", "hurry"), no investment claims. The new cases check this in the golden set and in the red-team set.
- **Never ask for phone, email or name.** The card uses the customer's account.
- **Nothing depends on the model writing a marker.** Cards stay automatic.

## Alternatives not taken

- **Offer only after an "interest signal"** (the customer saying they like a home): the owner chose to offer after every set of results.
- **Show homes first even for a very general ask:** a list of random flats helps nobody and costs a model call; the owner chose to ask first.
- **Let the model write the reply buttons:** this model does not reliably write markers, and buttons that depend on it would be missing half the time. The server picks them (next pull request).
- **A separate "sales" tool or agent:** the existing propose tools already do the job; only the rules for when to use them were too tight.

## Consequences

- Every message carries about 2,000 more prompt characters (about 500 tokens).
- Answers are a little longer: one plus point for each home and a closing question.
- The live evaluation (`evals/live-run.ts`) has not been run for this change; it costs money against the daily budget and waits for the owner's go-ahead.
- **Draft customer-facing wording, awaiting approval.** The assistant writes its own sentences, so the exact words are the model's. The example lines in the new test cases show the intended tone, for example: "Shall I prepare an enquiry for it?", "Which area or city are you looking in, and what is your budget?", "Would you like to book a site visit? Tell me which day suits you.", "Shall I try a nearby locality or a different type of home?". The Tamil and Tanglish lines in the cases are the model's own wording as well (decision D12 still open).

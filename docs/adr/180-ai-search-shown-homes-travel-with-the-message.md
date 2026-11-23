# ADR-180 · AI search: the homes the last answer showed travel with the next message

- Status: Accepted (a fix for a defect the owner reported on 24 Nov 2026; no new customer wording).
- Date: 2026-11-24
- Renumbered: was ADR-177, which the Conversational hero ADR also used; moved to 180 on 25 Nov 2026 so the numbers are unique.
- Amends: ADR-128 section 10 (the page context), ADR-175 (reply buttons)
- Class: C1. No migration, no dependency, no new tool.

## Context

The owner asked to compare houses in the AI search and got "I couldn't check everything. Here is what I found." That note is the round cap (5 model rounds per message). The usage record for that message showed four rounds of one call each, using only `search_properties` and `compare_properties`: the assistant searched, compared, and searched and compared again.

The chat sends only the words of the earlier turns, never home ids. So after an answer that showed homes, "compare these", "the second one" or the reply buttons "Compare these homes", "Work out the EMI" and "Show similar homes" left the assistant without ids. It had to search again to find them, and any compare that failed (an id it could not be sure of, a repeated or unlisted id) was retried until the rounds ran out.

## Decision

- **The browser sends what the newest answer showed**, as ids only, with the next message: `shownHomes` (home ids in the order shown) and `shownProjects` (project slugs), at most three of each (the card limit). They are read from the answer's own references (`shownRecords`) and only from an answer that was not replaced. Nothing else about the answer travels: no title, price or text.
- **The server checks every id again** (`resolveContext`): it must look like an id, appear once, and be listed now (homes by the compare page's public read, projects by the project page's read, projects for signed-in customers only, like the other page context). An id that fails is dropped without a word.
- **The prompt says what they mean** (`contextSection`, prompt version `2026-11-24.1`): "these", "this one", "the first one", "the second one" mean the shown homes in order, and the assistant uses the ids directly (compare, one home's details, the enquiry preparation) and does not search again just to find them. Facts still come from a lookup; the ids are never said aloud.
- **Tool errors are now logged by code**, so the next case can be diagnosed from the logs: `ai tool returned an error` with the name of one of our tools (a name the model made up is "unknown") and the tool's fixed error code. Never the input, never what the customer wrote.

## Alternatives not taken

- **Raise the round cap.** It hides the cause, costs more on every slow message, and the owner's budget is $1 a day.
- **Keep ids in the conversation the browser sends** (put them in the earlier answers' text): the model would have to copy them, and it does not do that reliably.
- **Store the last answer on the server:** a new table for something the browser already holds and the server can check.

## Consequences

- A message after an answer that showed homes carries up to six short ids more.
- "Compare these homes", "Work out the EMI" and "Show similar homes" no longer depend on a second search.
- The cap note can still appear when a message really needs more than four lookup rounds; the new log line will say which call failed.

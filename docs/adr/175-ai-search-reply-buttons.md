# ADR-175 · AI search reply buttons

- Status: Accepted (the owner agreed on 23 Nov 2026 that the chat shows reply buttons under answers; the button wording below is **draft and waits for the owner's approval**).
- Date: 2026-11-23
- Related: ADR-174 (conversation and enquiry offers), ADR-128 (the endpoint and the stream)
- Class: C1. A new stream event and a small screen change in the AI search only (`/ai-search` and the chat opened from the home page AI search bar). No migration, no dependency, no change to what the assistant may do.

## Context

After any answer the chat showed nothing to click. The example chips appear only on the empty screen. The owner wants the assistant to lead the customer to the next step (an enquiry, an EMI sum, similar homes) with one tap.

## Decision

- **The server picks the buttons; the model does not write them.** This model does not reliably write markers (that is why cards became automatic), so a design that needs it to write buttons would show them half the time. `endpoint/replies.ts` (`pickReplies`) reads what the turn returned (the records the tools named, the tools that ran, whether a proposal was made) and picks fixed, translated wording from `en.json` (`ai.replies.*`).
- **Which buttons.**
  - one home shown: "Enquire about this home", "Work out the EMI", "Show similar homes";
  - several homes shown: "Enquire about one of these", "Compare these homes", "Show more";
  - one project shown: "Enquire about this project", "Book a site visit";
  - nothing found, several projects, a mix of homes and projects, an EMI sum, a comparison, an answer shortened by a limit, a refusal or notice, a replaced answer, or a turn that ended with a confirm card: **no buttons**.
- **A new stream event** `{ type: "replies", items: [{ key, text }] }` (at most three), sent after the checked answer and after any confirm card, and never after a `replace`. The browser reads it with the same closed-set check as every other event (a list that is too long, or an item that is not a `key` and a `text`, is ignored).
- **A click sends the button's words as the customer's next message**, exactly as if they had typed them. A button never sends an enquiry, a visit request or anything else: "Enquire about this home" only makes the assistant prepare the card (ADR-174), and only the customer pressing Send on the card sends it. No button is worded as something already done.
- **Where and how they show.** Under the newest answer only, in a labelled list (`aria-label` "Quick replies") of the existing `Chip` component, laid out like the example chips. They are hidden while an answer is being written, while the sign-in gate is up, and while a limit has the composer off. A button the customer clicked is gone with the next answer. The buttons are kept with the answer in the tab's storage (they hold only fixed wording), so a reload still shows them under the last answer.

## Alternatives not taken

- **The model writes the buttons** (a marker or a list at the end of its answer): unreliable with this model, and a button the model invented could say anything.
- **Buttons under every answer, kept in the history:** older buttons would offer steps the conversation has moved past.
- **Buttons that call an action directly** (an "Enquire" that opens the confirm card without a message): skips the assistant's chance to put the customer's needs into the message (ADR-174) and would be a second path to a card.

## Consequences

- The chat gains one event and one small list under the latest answer. The screenshot baselines of the chat page may change; they are updated from CI in their own commit.
- "Work out the EMI" and "Show similar homes" send a message that does not say which home; the assistant uses the conversation to know. If that proves too loose, the next step is to put the home's name in the sent text.
- **Draft customer-facing wording, awaiting approval:** the eight button labels and the list label in `en.json` under `ai.replies`.

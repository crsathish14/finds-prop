# ADR-184 · AI search: the assistant's questions are drawn in bold

- Status: Accepted (the owner asked for it on 24 Nov 2026; no new customer wording).
- Date: 2026-11-24
- Related: ADR-174 (the assistant now asks questions and offers an enquiry), ADR-128 (the prompt asks for plain text)
- Class: C1. A small change to how an answer is drawn in the AI search. No migration, no dependency, no change to the prompt.

## Context

Since ADR-174 the assistant ends its answers with a question ("Would you like me to prepare an enquiry about one of them?") and asks short questions before searching. In a long answer the question was easy to miss, so the owner asked for the questions to be shown in bold.

## Decision

- **The page draws it, the model writes nothing special.** The prompt keeps asking for plain text with no Markdown (the output check and the history rely on plain text). `sentenceParts` (`chat/chat-model.ts`) cuts each paragraph of an answer into sentences, marks the ones that end with a question mark, and the chat draws those in `<strong>`. The words are never changed: the pieces put back together are the paragraph exactly.
- **What ends a sentence:** a `.`, `!` or `?` (or a run of them) followed by a space or the end of the paragraph. So a price such as ₹1.29 Cr, an area such as 1,420 sq ft and a gap such as ₹67.4 L do not end a sentence. Tamil and Tanglish questions end with the same mark and work the same way.
- **While the answer streams,** a question turns bold as soon as its question mark arrives.

## Alternatives not taken

- **Ask the model for `**bold**` Markdown:** it would break "plain text only", could appear as stray asterisks, and this model does not follow mark-up rules reliably.
- **Bold the whole last sentence or paragraph:** it would also bold a closing statement that is not a question.

## Consequences

- Every question the assistant asks is bold, wherever it is in the answer. A rhetorical question would be bold too.
- A question mark inside a sentence ("Is this 2?5 BHK a typo and fine") does not end a sentence and is not bold.

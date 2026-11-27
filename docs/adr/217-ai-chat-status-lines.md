# ADR-217 · The chat window says what the assistant is doing

- Status: Accepted. Owner decisions in chat on 27 Nov 2026 (`ai-chat-next-plan.md`, piece 4; the words approved that day). The look (the existing status line with its words swapped in place) was approved by the owner on 27 Nov 2026.
- Date: 2026-11-27
- Amends: ADR-128 section 5 (one fixed "Searching…" for every tool)
- Related: ADR-216 (the widening steps)
- Class: C1 (stream event words, one component prop, tests, Design Lab). No new event type, no new dependency.

## Decision

1. **The round's line comes from its tools** (`status-lines.ts`): homes and projects "Searching our homes…", articles, questions and jobs "Reading our articles…", builders "Checking builder details…", the web "Searching the web…". The first tool asked with a line of its own decides; any other tool keeps "Searching…". Owner-approved words, English only (the answer keeps the customer's language).
2. **A tool may report a step while it runs** (`ToolContext.status`, a line key only). The agent loop passes each step on at once while the round's calls still run. The home search reports the widening: "Searching nearby…", then "Extending the range…" and "Extending the range further…" for each wider circle it needed.
3. **The window** keeps the latest line and shows it in the existing status spot, replaced in place (`ChatStatusLine` takes the text; without it, "Searching…"). One polite status region, so each new line is announced once. The line goes when the answer starts, as before.
4. The stream event stays `status` with its text; nothing about a person is in it.

## Consequences

- No extra model call or read. A step reaches the window as soon as the tool reports it.
- The Design Lab shows the plain line and a step.

## Tests

`UT-ai-status-lines` (the line for each tool, the approved words, the steps passed on before the answer); the status line component test; the tool context test now lists the `status` callback and nothing that names the customer.

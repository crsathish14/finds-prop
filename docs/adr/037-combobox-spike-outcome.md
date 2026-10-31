# ADR-037 · Combobox spike outcome (S2-SPK-01)

- Status: Accepted for Stage 2; to be confirmed in a real browser in S2-T07
- Date: 2026-10-31
- Related: ADR-004, plan 04 section 4 (Combobox), `src/components/patterns/combobox.tsx`

## Question

Can the locality search (a text box that suggests matches as the reader types) be built from `cmdk` and a Radix popover with correct combobox behaviour for the keyboard and for screen readers, or does it need a custom listbox?

## What was built and run

`cmdk` 1.1.1 with `shouldFilter={false}` (the server filters), its `Command.Input` rendering our own `Input` (`asChild`), and the list in a Radix popover anchored to the input. Behaviour: suggestions are requested 300 ms after the reader stops typing and only from 3 characters; arrow keys move, Enter picks, Escape closes the list and keeps the text; a clear button; a polite live region announces the result count, "loading" and "no results". Ten jsdom tests cover roles, keyboard, debounce and minimum length.

## Findings

1. **The roles are right.** The input is `role="combobox"` with `aria-controls` and `aria-activedescendant`; the list is a `listbox` of `option` elements.
2. **cmdk takes focus away from the input.** Whenever the highlighted option changes, cmdk calls `focus()` on its list if the focused element has a `cmdk-input` attribute. In practice the reader's cursor would leave the text box the moment the list opened. Fixed by removing that attribute from our input (`cmdk-input={undefined}`). The test "keeps focus in the input" guards against a cmdk upgrade bringing it back.
3. **`aria-expanded` is always true in cmdk.** We pass the real open state, which wins over cmdk's value.
4. **The popover must not steal focus either.** `onOpenAutoFocus` and `onCloseAutoFocus` are prevented, and a click on the input itself is not treated as an outside click.

## Not shown yet

- Behaviour with NVDA, VoiceOver or TalkBack, and in mobile Safari, where cmdk's focus workaround was written for. jsdom cannot show this.
- A real-browser keyboard test and the axe check. Both come with the Design Lab (S2-T07) and are required before the Stage 2 sign-off.

## Decision

Use `cmdk` for the locality combobox with the fixes above. If the real-browser or screen reader check fails, fall back to a custom listbox following the WAI-ARIA combobox pattern with the same props, so callers do not change.

# Design handoff · UX addendum, batch 4: the AI chat assistant

Companion to `design-handoff-addendum.md` (batches 1 to 3) and `../final-ux/design-handoff.md`. It lists what this batch decides, what it leaves open, the new components, the copy, and the accessibility notes engineering needs. **Everything here is Proposed. Nothing is approved.** The owner approves the screens (gate G-F) and, separately, the new wording (gate G-G). Nothing is built from these screens until then (AGENTS.md rule 13, R-DS-05, R-DS-06).

**Scope:** ADD-14 to ADD-17, drafted for task AI-P0-T03 from `docs/adr/128-ai-chat-assistant.md` (section 10 and the decisions it cites). **4 screens, 29 states.** ADD-17 (navigation) was added at the owner's request after the first draft. Each state is drawn at 1440 and 390; the first state of each screen is also checked at 820, 1024 and 1280 (the same convention as batches 1 to 3).

- **Where the source lives.** The earlier batches are a read-only copy of an external UX package. This batch was drafted in this repository, so this copy is its source (see `../README.md`). Files: `screens/ai-chat.html`, `screens/ai-chat-limits.html`, `screens/ai-chat-confirm.html`, `assets/addendum3.css`, this document, and the entries in `assets/manifest.js`.
- **What it replaces.** The approved `final-ux/screens/ai-search.html` is a one-shot "describe a home" search with a lead form, not a conversation. It is left untouched; the chat supersedes it for route P-08 once approved. The lead form ("Didn't find it? Tell us what you need") is not in ADR section 10 and is not carried over (open question 9).
- **Plan approval.** The plan and its 12 defaults were agreed with the owner before any file was drafted. That is not an approval of the screens.

---

## 1. Traceability

| Source (ADR-128)                                                                   | Screen file           | States                                                                                                                      |
| ---------------------------------------------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| §10 heading, example prompts (empty state), message list, composer with the note   | `ai-chat.html`        | empty · typing · searching · streaming · answer                                                                             |
| §10 result cards reusing the property and project cards                            | `ai-chat.html`        | answer · answer-projects · cap-note                                                                                         |
| §5 the cap note and the fixed fallback; D7 disclaimer; §6.4.1 masked, refusal; §6.2 internals; §10 error with retry | `ai-chat.html`        | cap-note · fallback · disclaimer · masked · refusal · internals · error                                                     |
| §10 two rate-limited states (too many messages; unavailable with a link to search) | `ai-chat-limits.html` | ratelimit · ratelimit-day · unavailable                                                                                     |
| D2 and §6.3 sign-in gate after 2 free messages, return to the same conversation    | `ai-chat-limits.html` | gate · returned · signin                                                                                                    |
| D-ACTION confirm card for an enquiry or a site visit; ADR-051, ADR-056, ADR-057    | `ai-chat-confirm.html` | enquiry · visit · sending · sent · failed · already · ratelimit · signedout · ended                                         |
| Owner request: AI Search highlighted on desktop, a centre AI tab on phones, no saved-homes heart (chat on only) | `nav-chat.html` | default (a board: header visitor, header on the AI page, header signed in with the menu open, phone bar chat on, on the AI page, chat off = the approved bar, unchanged) |

| Brief item                                      | Where it is                                                                                         |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Status line "Searching…"                        | `ai-chat#searching`                                                                                 |
| Mobile (390 px) and desktop (1440 px)           | every state; the first state of each screen also at 820, 1024 and 1280                              |
| Tamil wording                                   | placeholder only (decision D12): "Tamil line: to be supplied by the owner". No Tamil is written.    |
| Typing "yes" never sends                        | stated in the `ai-chat-confirm` banner and in the card hint; only the Send button on the card sends |
| Product name (D11)                              | "findsprop" in all AI text; the assistant is "findsprop's AI assistant"; no model provider is named |

---

## 2. Decisions this batch makes (please confirm or change)

These are the 12 defaults agreed in the plan. They are proposals until the screens are approved.

| #   | Decision                                                                                                                                                                                                                       | Where                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| 1   | **This repository is the source for the chat addendum.** One sentence added to `docs/ux/README.md`.                                                                                                                            | `../README.md`                     |
| 2   | **New component shapes are drawn from existing tokens** and approved with the screens (section 4). No new colour, font, radius, shadow, spacing step or breakpoint.                                                              | `assets/addendum3.css`             |
| 3   | **One copper button per view.** The composer Send is copper. While a confirm card waits, the card's Send is copper and the composer's Send is forest. In the sign-in gate, "Sign in" is copper and the composer is replaced.       | all three screens                  |
| 4   | **Phones keep the bottom bar**, with the composer stuck directly above it.                                                                                                                                                       | all three screens                  |
| 5   | **Cards in answers are the approved cards, unchanged** (heart and Compare stay). Up to 3 per answer; one per row on phones, two per row from 640 px. The compare bar is not drawn on this page.                                  | `ai-chat#answer`                   |
| 6   | **After sign-in the transcript and the unsent third message come back**; the person presses Send (no automatic send).                                                                                                           | `ai-chat-limits#returned`          |
| 7   | **Other limits reuse the "too many messages" state** with a "try again tomorrow" line (the signed-in daily allowance and the per-IP backstop). Only the global budget uses "unavailable right now". No third limit screen.        | `ai-chat-limits#ratelimit-day`     |
| 8   | **One fixed "Searching…"** for every tool.                                                                                                                                                                                     | `ai-chat#searching`                |
| 9   | **Tamil placeholders only on fixed replies inside the conversation.** Alerts, the gate and buttons stay English like the rest of the app.                                                                                       | `ai-chat`                          |
| 10  | **Tapping an example prompt fills the box and does not send**, so a tap cannot spend a free message. Five prompts: the approved Tamil and Tanglish ones plus three new ones (search, builder, EMI).                              | `ai-chat#empty`                    |
| 11  | **The confirm card shows the phone number in full with "Verified"** (it is the person's own and the card says what will be sent). The alternative is a masked number.                                                           | `ai-chat-confirm#enquiry`          |
| 12  | **Not designed, because ADR section 10 does not list them:** New chat or clear, Stop generating, a "free messages left" counter, a "See all results" link, copy or feedback buttons, a history list, an EMI card, a Cancel link on the confirm card. | (absent)                           |
| 13  | **Desktop header: "AI Search" is a copper-tint pill** (copper text on the copper tint, sparkle icon, the current page shown with a thin outline). A tint, not a copper fill, so the one-copper-button rule holds. | `nav-chat` |
| 14  | **Phone bottom bar with the chat on: Home, Search, AI (centre, highlighted), Post, Me.** AI is a copper-tint disc; Post is a normal tab beside it. | `nav-chat` |
| 15  | **With the chat off the old design is used, unchanged:** header without the AI link and with the heart; phone bar Home, Search, Post (raised), Saved, Me. | `nav-chat` |
| 16  | **While the chat is on, the saved-homes heart is removed** from the header (signed in) and the Saved tab from the phone bar. Saved homes stay in the account menu (with its count), the mobile drawer and the Me pages. | `nav-chat` |
| 17  | **The chat screens show this navigation** (the AI page marked as current in the header and the bar). The approved screens and the ADD-10 boards keep the approved header and bar, and so does every page while the chat is off. | all chat screens |

Decisions 13 to 17 come from the owner's later request (five phone tabs with Post moved beside AI, a copper-tint highlight, the old design unchanged when the chat is off, no heart while it is on). Two small additions beyond the plan, both inside decision 7 and decision 3: a separate `ratelimit-day` state (so the "tomorrow" line can be reviewed on its own), and a separate `ended` state for a session that ends while the card is open (the approved "session ended" wording). That makes 28 states instead of the 26 in the plan.

---

## 3. Open questions for the owner

**Design**

1. **Missing components.** The design system has no message bubble, assistant message, composer, status line, note line, confirm card or in-chat sign-in gate. They are drafted from existing tokens (section 4). Approving the screens approves these shapes; each then needs a Design Lab entry in P5-T01.
2. **Phone number on the confirm card** (decision 11): full, or masked as in the code screen ("+91 98••• ••412")?
3. **Daily limits on screen.** Decision 7 has the signed-in 40 a day and the per-IP 40 a day use the "too many messages" screen. Do you want a different screen, or a visible counter of messages left (not drawn)?
4. **Composer on phones.** The composer plus the bottom bar take about 160 to 230 px of an 844 px screen (more while a long message is typed). Not tested on real phones.
5. **Composer when the assistant is working.** Send is disabled while "Searching…" or streaming, and typing stays possible. Confirm, or allow queuing?
6. **"Try again" after an error** sends the same message again. Whether a failed call spends a free message is an ADR section 7 matter (the ADR accepts the loss at first); the screen does not say.
7. **Example prompts.** The three new prompts and the Tamil and Tanglish ones are samples. Choose the final five.
8. **Header and footer** still read "Find Prop" (the prototype's shared components), while AI text says findsprop (D11). The sweep comes with the application-wide rename.
9. **Not in ADR section 10, so not drawn:** the lead form from the old `ai-search`; the short reply for flooding (ADR 6.4.1: "a short message", same bubble shape, wording to supply); "Ask about this home" buttons on property and project pages (ADR: later). Tell me if you want any of them added.
10. **Navigation labels.** The header link stays "AI Search" and the phone tab says "AI" (its screen-reader name is "AI Search"). Keep both, or use another label such as "Ask AI"?
11. **Strength of the phone AI tab.** The AI disc is a copper tint, so it is quieter than the raised forest Post disc the approved bar had. A stronger option is a forest disc (not copper, so the one-copper rule still holds). Say if you want it stronger.
12. **Chat on versus off.** With the chat off the old design is used exactly (heart, Saved tab, raised Post), so the approved screens and the ADD-10 boards need no change. The new navigation applies only while the chat flag is on. Confirm that the heart and the Saved tab should stay hidden once the chat is on for good.

**Wording (gate G-G).** Every new string carries a "Wording to confirm" tag on its screen; reused strings carry "Reused". The list is in section 5. Needs a decision:

- The seven fixed replies and notes: cap note, fallback, disclaimer, masked notice, refusal for other property sites, scope reply, "how I am built" reply.
- **Tamil lines for those seven** (decision D12): to be supplied by the owner. No Tamil is invented here.
- The EMI example rate: the screens show **9%** only as a placeholder for the rate the owner sets before the EMI tool is built.
- The disclaimer ("This is general information, not legal or financial advice.") and the consent sentences are legal wording; they may need legal review (AGENTS.md "legal wording, consent text").

---

## 4. New components (built from approved tokens only)

Reused unchanged: property card, project card, `alert`, `badge`, `chip`, `btn` (copper, forest, secondary, small), `textarea`, `ctx` context chip (batch 1), the sign-in card of ADD-01, `ai-hero` and `ai-ex` from the approved `ai-search`, header, footer and bottom bar.

| Component                  | Anatomy                                                                                                                                              | States                                                                                  | Accessibility                                                                                                                        |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **ChatColumn**             | One reading column, 820 px wide (the width the approved `ai-search` used), 24 px between messages                                                     | all                                                                                     | `main` landmark; the thread is a labelled list region                                                                                |
| **ChatBar**                | Sparkle disc and the heading "findsprop's AI assistant", with a rule under it. Replaces the large hero once a message exists                         | default                                                                                 | The only `h1` on the screen once the hero is gone                                                                                    |
| **UserBubble**             | Right-aligned bubble on the forest tint, 88% maximum width, plain text only                                                                           | default; with a "removed" placeholder token (`masked`)                                  | Plain text (R-SEC-10); each message is read as "You said" in the build                                                               |
| **AssistantMessage**       | Small label row (sparkle disc and "findsprop's AI assistant"), then text at 16/26, then cards or notes                                                | default, streaming                                                                      | Label is text, not only an icon; links are real links built by code, never by the model                                              |
| **StatusLine**             | Spinner and the fixed word "Searching…"                                                                                                               | default; reduced motion (static disc)                                                   | `role="status"`; announced once, not repeated                                                                                        |
| **StreamCaret**            | A 2 px bar after the last streamed character                                                                                                          | blinking; static under reduced motion                                                   | Decorative; the streamed node is `aria-busy` until the answer ends                                                                   |
| **NoteLine**               | Muted panel with an info icon and one fixed sentence (cap note, disclaimer, "personal details removed"); a user-aligned variant sits under the bubble | default, user-aligned                                                                   | `role="note"`, or `role="status"` for the masked notice; the sentence says it in words (R-DS-09)                                     |
| **TamilPlaceholder**       | Dashed copper-text box "Tamil line: to be supplied by the owner (D12)". Review aid only; never ships                                                  | default                                                                                 | Not shipped; in the build the real Tamil line replaces it in the same place                                                          |
| **Composer**               | Rounded box with an auto-growing textarea, a Send button (icon only on phones, icon and word from 768 px), the privacy note and a "0 / 1,000" counter | empty (Send disabled), typing (Send enabled), disabled with a kept draft, enabled draft | Textarea has a label; Send has an `aria-label`; the disabled reason is in text beside it; the counter is not announced on every key |
| **ComposerDock**           | Sticky wrapper: directly above the bottom bar on phones, at the bottom of the screen from 768 px                                                      | default                                                                                 | Does not trap focus; the thread scrolls behind it                                                                                    |
| **ChatGate**               | Lock disc, "Sign in to keep chatting", one sentence, the unsent message quoted in a dashed box, one copper "Sign in" button. Replaces the composer    | default                                                                                 | Heading receives focus; the quoted draft is plain text                                                                               |
| **DraftQuote**             | Dashed box with a small label and the kept text                                                                                                       | default                                                                                 | Plain text                                                                                                                           |
| **ConfirmCard**            | Title and "Not sent yet", the real target as a context chip, facts (name, verified phone, message or visit date), consent sentence, one copper Send  | pending, sending, sent (calm), failed (alert above), limited (Send disabled), signed out, session ended | A labelled region; heading receives focus when it appears; Send is a real button; "Verified" is a badge with a word                  |
| **HeaderAiLink** (ADD-17) | The existing "AI Search" nav link with a sparkle, drawn as a copper-tint pill (text 700, pill radius) | default, hover (darker tint), current page (thin outline, no underline) | A link in the main nav; the current page has `aria-current="page"`; the sparkle is decorative |
| **ChatBar tab** (ADD-17) | A phone bottom-bar tab: sparkle in a 34 px copper-tint disc and the label "AI". The bar is Home, Search, AI, Post, Me (5 equal columns); with the chat off the approved bar is used unchanged (Home, Search, Post raised, Saved, Me) | default, current page (ring on the disc and the approved copper mark above) | A link with `aria-label="AI Search"` and `aria-current` on the AI page; touch target is the full tab |

All use existing tokens; **no new colour, font, radius, shadow, spacing step or breakpoint** (breakpoints used: 640 for the approved card grid, 768 and 1024). New contrast pairs, measured from the real token values: ink on the forest tint 12.36, muted on ivory 5.87, muted on parchment 5.28, accent text on white 6.22, accent text on the copper tint 5.12, success on its tint 5.52, muted on white 6.33; input outlines 3.34 (non-text needs 3). All pass WCAG AA.

---

## 5. Copy deck (proposed; English)

Status: **New** = a proposal for gate G-G. **Reused** = approved wording already in the app or the approved UX. **ADR** = text the ADR already writes out, still to be approved as `en.json` wording.

| Screen / state                | Text                                                                                                                                       | Status                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| Chat · heading                | **Ask findsprop's AI assistant**                                                                                                           | New                                                              |
| Chat · line                   | "Ask about homes, projects and builders listed on findsprop, or work out an EMI. Write in English, Tamil or Tanglish."                      | New                                                              |
| Chat · prompts                | "3 BHK flat in Velachery under 1.5 crore" · "Tell me about Kadal Homes" · "EMI for an 80 lakh loan over 20 years"                          | New (samples)                                                    |
| Chat · prompts                | "வேளச்சேரியில் 3 BHK வீடு" · "Adyar la 2 BHK rent ku venum"                                                                                | Reused (approved `ai-search`)                                    |
| Chat · prompt help            | "Try one of these" · "Tap one to fill the box. Nothing is sent until you press Send."                                                      | "Try one of these" Reused; the rest New                          |
| Composer                      | Placeholder "Ask about a home or project" · button **Send** · "Your message is used to answer you. Don't include personal details here."   | New; the note is Reused from `ai-search` with "description" changed to "message" |
| Chat · title bar              | **findsprop's AI assistant**                                                                                                               | New (D11)                                                        |
| Searching                     | "Searching…"                                                                                                                               | ADR                                                              |
| Cap note                      | "I couldn't check everything. Here is what I found."                                                                                       | ADR                                                              |
| Fallback                      | "I couldn't finish that. Try a simpler question, or use the search filters."                                                               | ADR                                                              |
| Disclaimer                    | "This is general information, not legal or financial advice."                                                                              | New                                                              |
| Masked                        | "I removed personal details from your message."                                                                                            | ADR                                                              |
| Refusal (other sites)         | "I can only help with homes, projects and builders listed on findsprop, so I can't look at other property sites. I can search findsprop for something similar. Shall I try?" | New                                                |
| Scope reply                   | "I can help with homes, projects and builders listed on findsprop, and with EMI sums. I can't help with that. Want to look at some homes?" | New                                                              |
| How I am built                | "I'm findsprop's AI assistant. I look up homes, projects and builders listed on findsprop and can calculate EMIs. I can't share how the site or I am built. Want to look at some homes?" | ADR (section 6.2)                       |
| Tamil lines                   | "Tamil line: to be supplied by the owner (D12)" under each of the seven fixed replies above                                                | Placeholder, not wording                                         |
| Error                         | **We couldn't answer that** · "Something went wrong on our side. Your message is saved, so you can try again." · **Try again**             | New, adapted from the approved `ai-search` error                 |
| Too many messages             | **Too many messages in a short time** · "Please try again in 45 seconds. You can keep browsing with filters meanwhile." · **Use filters**  | New, adapted from the approved `ai-search` alert                 |
| Daily limit                   | **Too many messages for today** · "You've reached today's message limit. Please try again tomorrow, or keep browsing with filters."        | New                                                              |
| Unavailable                   | **The AI assistant is unavailable right now** · "It has reached its limit for today. Search by locality, type, bedrooms and budget instead." · **Search with filters** | New, adapted from the approved `ai-search` alert        |
| Kept draft                    | "We kept what you typed."                                                                                                                  | Reused (`sessionEnded.restored`)                                 |
| Gate                          | **Sign in to keep chatting** · "You've used your 2 free messages. Sign in with your mobile number and we'll bring you back to this conversation." · "Your next message, not sent yet" · **Sign in** · "We'll send a 6-digit code to your phone." | Title ADR; the rest New |
| Returned                      | **You're signed in** · "Your conversation is back. We kept what you typed."                                                                | Title New; second sentence Reused                                |
| Sign-in card                  | The approved ADD-01 card, plus **Sign in to keep chatting** · "We will take you straight back to your conversation."                       | Card Reused; the blue line New                                   |
| Confirm · enquiry             | Assistant: "I've written an enquiry for you to check. Nothing is sent until you press Send." · **Send this enquiry?** · "Not sent yet" · "Your name" · "Your phone" · "Verified" · "Message" · **Send enquiry** · "Nothing is sent until you press Send." | New, except **Send enquiry** (Reused) |
| Confirm · consent             | "The owner will see your name, phone number and message so they can reply. We don't show your details to anyone else." · Privacy Policy    | Reused (`enquiry.consent`)                                       |
| Confirm · visit               | Assistant: "I've prepared a site visit request for Kadal Vista. Nothing is sent until you press Send." · **Request this site visit?** · "Visit date" · **Request a site visit** · "Your name, phone number and message go to Kadal Homes and findsprop so they can contact you." | New, except **Request a site visit** (Reused); the consent line is the approved one with "Find Prop" changed to findsprop (D11) |
| Confirm · sent                | **Enquiry sent** · "The owner can now see your details and message. The reply status will show in your dashboard." · **View my enquiries** | Reused (`enquiry.sent`)                                          |
| Confirm · failed              | **We couldn't send your enquiry** · "Nothing was lost: your details are still here. Try again in a moment."                                 | Reused (`enquiry.failed`)                                        |
| Confirm · already             | **You already contacted this owner** · "Your earlier enquiry is in My enquiries, with its reply status."                                   | Reused (`enquiry.already`)                                       |
| Confirm · limit               | **Please wait a little** · "You can send a limited number of enquiries per day. Try again later."                                          | Reused (`enquiry.rateLimit`)                                     |
| Confirm · signed out          | **Sign in to send this enquiry** · "Sign in to send an enquiry. We will bring you back to this chat afterwards." · "Your message, kept" · **Sign in to send** | New, adapted from `enquiry.gate.leadIn`                |
| Confirm · session ended       | **Your session has ended** · "Sign in again to send this. What you typed will be kept." · **Sign in again**                                | Reused (`sessionEnded`)                                          |
| Navigation (ADD-17)           | Phone tab label **AI** · header link **AI Search** (unchanged)                                                                             | Tab label New; header link Reused                                |

The assistant's other replies on the screens (the answers, the EMI sum, the "I can't call you" line) are **sample model output**, not wording to approve. The model is told what to say; only the fixed lines above are fixed text in `en.json` under the `ai` area (ADR section 10).

---

## 6. Accessibility notes (focus order, announcements, keyboard)

| Screen / state       | Focus order and behaviour                                                                                                                                                                                 | Announcements                                                                          |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Empty                | Skip link → header → prompts (buttons) → composer → Send. Choosing a prompt fills the box and moves focus to it; nothing is sent                                                                          | —                                                                                      |
| Sending a message    | Focus stays in the composer. The new message is added to the thread; Send is disabled until the answer ends                                                                                               | "Searching…" is a polite status, once                                                  |
| Streaming            | The answer is written into a node that is `aria-busy` and not read sentence by sentence; when the answer ends the node is read once and cards are added                                                   | "Answer ready" polite status when it ends (proposal; confirm with a screen reader test) |
| Cards                | Each card keeps its approved focus order (link, heart, Compare). Cards are in the page's reading order after the text that introduces them                                                                | —                                                                                      |
| Notes and fixed replies | Read as part of the message; notes use `role="note"`                                                                                                                                                   | The masked notice is a polite status                                                   |
| Error                | Focus moves to the alert; Try again is the first control; the message is kept                                                                                                                            | `role="alert"`                                                                         |
| Limits               | The alert is read on load of the state; the composer is disabled with its reason in text; when the wait ends the composer is enabled and a polite status says so                                          | `role="alert"` for the limits; `role="status"` for "unavailable"                       |
| Gate                 | Heading receives focus; the quoted draft is read before the button; "Sign in" leaves for `/auth?redirect=/ai-search`                                                                                      | —                                                                                      |
| Returned             | Focus lands in the composer, which holds the restored draft; the success alert is a status                                                                                                                | "You're signed in" polite status                                                       |
| Confirm card         | When the card appears, focus moves to its heading; then the facts (plain text), the consent link, Send. Send is the only control that sends; Enter in the composer never confirms a card                  | Sending: `aria-busy` on the button; sent, failed, limit and already are read as status or alert |
| Signed out / ended   | Heading receives focus; the kept message is read before the button                                                                                                                                        | Session ended is a polite status                                                       |
| Navigation (ADD-17)  | Header: AI Search is one of the main links, in reading order, with `aria-current="page"` on the AI page. Bottom bar: Home, Search, AI, Post, Me in order; the AI link's name is "AI Search". With the chat on no heart is announced or tabbable; with the chat off the approved header and bar apply | — |

Keyboard: every control is reachable and operable with Tab, Shift+Tab, Enter and Space; Enter sends the composer and Shift+Enter adds a line (proposal, to confirm). The focus ring is the approved single ring. **Reduced motion** turns the caret and the spinner into static shapes. Touch targets follow the approved system (40 to 44 px; the composer Send is 52 px square on phones). The thread is plain text plus the approved cards: no `dangerouslySetInnerHTML`, no model-written links (R-FE-14, R-SEC-10).

---

## 7. How this was checked

**Automated (`node tools/check.mjs --only ai-chat,ai-chat-limits,ai-chat-confirm,nav-chat`):** **70 page loads** (every state at 390 and 1440; the first state of each screen also at 820, 1024 and 1280). Result: **0 problems**: no console errors or exceptions, no horizontal overflow, no broken images, no text under 11 px, no duplicate ids, no dead links. 28 informational notes: inline text links inside sentences are shorter than 36 px at 390 (allowed as inline text).

**Copper buttons (script over all 29 states at 390 and 1440, 58 views):** never more than one visible copper button per view. In states with no enabled copper action the only copper button is the composer's disabled Send.

**By eye:** the empty state (desktop), an answer with property cards (phone), an answer with project cards (desktop), the fixed refusals (desktop), the typed state (phone), the sign-in gate (desktop), the limits state (phone), the enquiry card (desktop and phone) the sent card (desktop), the new navigation board (desktop and phone) and the enquiry card with the new phone bar (phone). Real viewport screenshots at 390 and 1440 confirmed that the composer sticks directly above the bottom bar on phones and at the bottom edge on desktop. Defects found and fixed: the current-page ring on the AI tab overlapped its label (now drawn inside the disc), the phone composer placeholder and typed text were clipped (shorter placeholder, taller typed box), the kept draft was clipped in the disabled composer at 390 (shorter sample draft).

**Known artefact:** full-page images (the render tool) show the sticky composer where the first screen ends, over the content. A real browser shows it fixed to the bottom of the screen. The renders are not committed.

**Not done:** real browsers other than Chrome; Safari and Firefox; real phones and the on-screen keyboard (the composer and bottom bar together are not tested with a keyboard open); screen reader or keyboard runs on assistive technology; usability testing; real streaming, auto-growing text and focus management (the prototype shows states, not behaviour); **Tamil rendering** beyond the one reused Tamil prompt, and no Tamil text was written; all assistant answers are sample text.

---

## 8. Not covered

The Design Lab entries, components and production code (P5-T01). The Tamil wording of the fixed replies (the owner supplies it, D12). The example loan rate. The application-wide rename from "Find Prop" to "findsprop". The items in decision 12 and open question 9. "Ask about this home" buttons on property and project pages (ADR section 10: later). The mobile menu drawer is not changed by ADD-17. The approved screens `final-ux/screens/ai-search.html` and ADD-01 to ADD-12 are not changed.

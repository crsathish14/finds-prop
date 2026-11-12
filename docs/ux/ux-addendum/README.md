# Find Prop · UX addendum

**Status: batches 1, 2 and 3 are built and waiting for your review. No production code has been written.** Only ADD-13 (PG and hostels) is not built, because it is gated until the requirement exists.

The approved package in `../final-ux/` was designed for email and Google sign-in and an AI search. The architecture (29 Oct 2026) changed that: customers sign in with a **phone code**, builders and the administrator use **email or Google plus a second step**, **AI search is deferred**, and places come from an **address search** instead of a fixed list. This folder adds only the screens that change or are missing. It is built from the approved tokens and components; **`final-ux` was not modified** (it is read from this folder through relative links).

Brief and priorities: `../property-platform-implementation-plan/stage-0/02-ux-addendum-brief.md`.

**Update 2 Nov 2026:** the owner decided on 1 Nov that builders, agents and the administrator sign in with **Google only**: no password, no reset and no second step in the app. The two new screens above, **approved by the owner on 2 Nov 2026**, replace the staff sign-in, second-factor and set-password screens, which are marked superseded and kept for history. They are not rendered yet (the counts below are the original batch totals).

**Update 3 Nov 2026:** the owner **approved ADD-01 to ADD-04** (the five customer sign-in screens: phone, code, email, email prompts, name). The approval covers layout, states and components. Text still flagged *To confirm*, *Wording to confirm* or *Duration to confirm* on those screens is not approved yet.

**Batch 4 (Nov 2026): the AI chat assistant, ADD-14 to ADD-16.** Drafted for task AI-P0-T03 from ADR-128. **Proposed, not approved:** the owner approves the screens (gate G-F) and, separately, the new wording (gate G-G). Nothing is built from them. Unlike batches 1 to 3, this batch was drafted in this repository, so this copy is its source. Read `design-handoff-chat.md`.

## Start here

1. Open **[index.html](index.html)** in a desktop browser. It lists every screen with thumbnails and state chips.
2. Click a screen to open the working prototype. Resize the window to see tablet and phone layouts. Add `#state` to the address (for example `screens/auth-otp.html#wrong`) or use the chips.
3. `renders/` has the same screens as images: `<screen>--<state>--<d|t|m>.webp` at **1440 · 820 · 390**.
4. Read **[design-handoff-addendum.md](design-handoff-addendum.md)** for decisions, open questions, new components, copy and accessibility notes.

## What is in it

### Batch 1 (priority P1, plus the AI-off navigation)

| ID | Screens | Files |
|---|---|---|
| ADD-01 | Sign in or create an account with a phone number (10 states, approved by the owner 3 Nov 2026) | `screens/auth-phone.html` |
| ADD-02 | Enter the 6-digit code (12 states, approved by the owner 3 Nov 2026) | `screens/auth-otp.html` |
| ADD-03 | Add and verify email (8 states) · dashboard prompt, reminder and posting gate (4 states), approved by the owner 3 Nov 2026 | `screens/verify-email.html`, `screens/email-prompts.html` |
| ADD-04 | What should we call you? (5 states, approved by the owner 3 Nov 2026) | `screens/profile-name.html` |
| ADD-05 | Builder and agent sign in, **Google only** (6 states, approved by the owner 2 Nov 2026) | `screens/staff-signin-google.html` |
| ADD-06 | Administrator sign in, **Google only** (6 states, approved by the owner 2 Nov 2026) | `screens/admin-login-google.html` |
| ADD-05 | **Superseded 2 Nov 2026**, kept for history: builder sign in with Google (8 states) · second factor (12 states) · set password and reset (6 states) | `screens/staff-signin.html`, `screens/staff-2fa.html`, `screens/staff-password.html` |
| ADD-06 | **Superseded 2 Nov 2026**, kept for history: administrator sign in (5 states) | `screens/admin-login.html` |
| ADD-10 | Homepage A, B and fallback, search results and a navigation board, all without AI search | `screens/home-*-noai.html`, `screens/search-noai.html`, `screens/nav-noai.html` |

### Batches 2 and 3 (priority P2 and P3)

| ID | Screens | Files |
|---|---|---|
| ADD-07 | Place suggestions: idle, typing, loading, results, no results, service down, rate limited, chosen, stacked search card, filter rail; phone sheet (10 states) | `screens/place-suggest.html` |
| ADD-12 | Privacy, Terms and Cookie pages in one reading layout (4 states) · consent text under six forms and the optional cookie notice and settings (3 states) | `screens/legal-page.html`, `screens/consent-snippets.html` |
| ADD-08 | Post a property, step 1 address and a draggable location pin, with the manual route, outside-Tamil-Nadu, map-failed and error states, and the review step (10 states) | `screens/post-address.html` |
| ADD-11 | Admin hero layout and sponsor manager with the four-image drawer and its validation states (11 states) · homepage localities editor (7 states) | `screens/admin-sponsors.html`, `screens/admin-localities.html` |
| ADD-09 | Map view for search results, optional (12 states) | `screens/map-view.html` |

**Totals:** 21 screens, 133 states, 200 rendered images (batch 1: 14 screens, 76 states, 119 renders; batches 2 and 3: 7 screens, 57 states, 81 renders).

### Batch 4 (the AI chat assistant, proposed, not approved)

| ID | Screens | Files |
|---|---|---|
| ADD-14 | The conversation: empty with example prompts, typing, searching, streaming, answers with property and project cards, cap note, fixed fallback, disclaimer, personal details removed, fixed refusal, "how I am built" reply, error with retry (13 states) | `screens/ai-chat.html` |
| ADD-15 | Limits and sign-in: too many messages, today's limit, unavailable right now, the sign-in gate after 2 free messages, back in the conversation, the sign-in card with a chat line (6 states) | `screens/ai-chat-limits.html` |
| ADD-16 | Confirm card for an enquiry or site visit: enquiry, visit, sending, sent, failed, already, daily limit, signed out, session ended (9 states) | `screens/ai-chat-confirm.html` |

**Batch 4 totals:** 3 screens, 28 states. Tamil lines for the fixed replies are placeholders until the owner supplies them. No renders are committed.

### Not built

- **ADD-13** PG and hostels: gated until requirements exist.

## Conventions

- **State by URL hash**, exactly as `final-ux` (`#wrong`, `#sent`, …).
- **Proposed / To confirm** tags and the dashed banner at the top of each screen are review aids and never ship.
- **All people, numbers, emails and codes are fictional.** The QR code and recovery codes are samples drawn for layout only. The "human check" box is a placeholder for the provider's widget.
- **Imagery** is the approved illustrated placeholder art. **Maps are illustrated placeholder art** with invented place positions, not real geography; the real map is built with MapLibre.
- **Legal and consent wording is placeholder** until your legal text exists. Sponsor banners shown are approved sample images standing in for advertiser files (SVG is not accepted in production).
- Fonts load from Google Fonts like the approved prototypes; offline, system fonts are used and spacing shifts slightly.

## Folder map

```
ux-addendum/
├── index.html               review gallery
├── README.md, design-handoff-addendum.md, design-handoff-chat.md
├── screens/                 24 prototype pages
├── renders/                 200 images
├── assets/
│   ├── addendum.css         batch 1 layout and component shapes (no new tokens)
│   ├── addendum2.css        batches 2 and 3: suggestions, map, pin, sponsors, localities, legal, consent
│   ├── addendum3.css        batch 4: the AI chat (messages, composer, status, notes, gate, confirm card)
│   ├── addendum.js          AI-off switch, link rewrite to final-ux, sample QR, illustrated map, suggestion panel
│   └── manifest.js          every screen and state (drives the tools and the gallery)
└── tools/                   render.mjs · check.mjs · cdp.mjs (no installs; Node 22+ and Chrome or Edge)
```

Regenerate: `node tools/render.mjs [--only id] [--vp d,m]` and `node tools/check.mjs [--quick]` (console errors, overflow at five widths, broken images, text under 11 px, duplicate ids, dead links).

## What happens next

Nothing is built from these screens until you approve them. Stage 3 (auth) uses the batch 1 screens as the visual source of truth; the place search, post-property address, sponsor and localities screens belong to the stages that build those features.

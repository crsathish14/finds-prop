# Design handoff · UX addendum, batches 1 to 3

Companion to `../final-ux/design-handoff.md`. It lists what this batch decides, what it leaves open, the new components, the copy, and the accessibility notes engineering needs. Everything here is **Proposed** until you approve it.

**Scope:** ADD-01 to ADD-12 from `../property-platform-implementation-plan/stage-0/02-ux-addendum-brief.md` (ADD-13 PG and hostels stays gated): **21 screens, 133 states, 200 renders**.

- **Batch 1** (ADD-01 to ADD-06, ADD-10): 14 screens, 76 states, 119 renders.
- **Batches 2 and 3** (ADD-07, ADD-08, ADD-09, ADD-11, ADD-12): 7 screens, 57 states, 81 renders.

---

## 1. Traceability

| Brief item | Screen file | States |
|---|---|---|
| ADD-01 Phone sign-in / sign-up | `auth-phone.html` | default · invalid · sending · gate · gate-enquiry · captcha · captchafail · ratelimited · unavailable · unsupported |
| ADD-02 Code entry | `auth-otp.html` | default · typing · filled · verifying · wrong · expired · locked · resend · resent · ratelimited · unavailable · success |
| ADD-03 Email verification | `verify-email.html` | entry · invalid · sending · sent · resent · verified · expired · taken |
| ADD-03 Prompt, reminder, gate | `email-prompts.html` | prompt · banner · gate · gate-sent |
| ADD-04 Name | `profile-name.html` | default · error · saving · required-post · required-enquire |
| ADD-05 Builder sign-in | `staff-signin.html` | signin · google-mismatch · denied · errors · forgot · forgotsent · busy · ratelimited |
| ADD-05 Second factor | `staff-2fa.html` | A: enrol · enrol-wrong · recovery · challenge · wrong · locked · use-recovery · lost · admin-challenge. B: sms · sms-wrong · sms-add-phone |
| ADD-05 Set password / reset | `staff-password.html` | welcome · mismatch · short · success · expired · reset |
| ADD-06 Administrator sign-in | `admin-login.html` | default · errors · notauth · ratelimited · busy |
| ADD-10 AI search off | `home-a-noai`, `home-b-noai`, `home-none-noai`, `search-noai` (empty, default), `nav-noai` | default · empty |

| ADD-07 Place suggestions | `place-suggest.html` | idle · typing · loading · results · noresults · degraded · ratelimited · selected · stacked · rail |
| ADD-12 Legal pages | `legal-page.html` | privacy · terms · cookies · toc-open |
| ADD-12 Consent text and cookie notice | `consent-snippets.html` | default (board of six placements) · banner · prefs |
| ADD-08 Post property, address and pin | `post-address.html` | search · results · selected · selected-approx · manual · pin-outside · map-failed · unavailable · errors · step5 |
| ADD-11 Hero layout and sponsors | `admin-sponsors.html` | hero · layout-split · no-eligible · empty · drawer · drawer-edit · drawer-near · drawer-bad · confirm-delete · saving · saved |
| ADD-11 Homepage localities | `admin-localities.html` | default · add · errors · empty · max · saving · saved |
| ADD-09 Map view (optional) | `map-view.html` | default · selected · approx · search-area · cluster · loading · tiles-failed · no-results · too-many · outside · m-list · m-map |

Not built: ADD-13 (PG/hostels), gated until the requirement exists.

---

## 2. Decisions this batch makes (please confirm or change)

| # | Decision | Where | Linked |
|---|---|---|---|
| 1 | **One flow for sign-in and sign-up.** A new number creates the account; no "Create account" tab. Button says **Send code** | `auth-phone` | ARC |
| 2 | **Human check sits under the number field.** The usual case is invisible and shows a quiet **Verified** line; visible states exist for checking and failure | `auth-phone` | `DEC-23` |
| 3 | **Code is one logical input with six display cells**, paste fills all, the sixth digit submits. Defaults used for the copy: **code lasts 5 minutes, resend after 60 s, 3 wrong attempts then a 15-minute pause** | `auth-otp` | `DEC-31` (values to confirm) |
| 4 | **Name is asked once after the first code**, skippable for browsing, **required before posting or enquiring** | `profile-name` | — |
| 5 | **Email is a non-blocking prompt**, with a persistent reminder once a link was requested, and a **gate only before posting a property** (nothing typed is lost) | `email-prompts` | `DEC-07` |
| 6 | **The "email taken" message does not say why** ("We couldn't use that email") to avoid revealing other people's accounts | `verify-email#taken` | security |
| 7 | **Email link lasts 1 hour** in the copy | `verify-email` | to confirm |
| 8 | **Builders: Google first, then email and password.** A mismatch state tells the person which Google account was invited | `staff-signin` | `DEC-05`, S3-SPK-01 |
| 9 | **Second step: authenticator app is the main design** (QR + manual key + 10 recovery codes); **SMS is a thin variant** reusing the code input. Engineering chooses after the spike | `staff-2fa` | `DEC-05` |
| 10 | **Lost device = contact Find Prop** (no self-service reset in v1) | `staff-2fa#lost` | to confirm |
| 11 | **Administrator page is quiet**: no side panel, no footer, never indexed, route `/admin/login` | `admin-login` | `DEC-06` |
| 12 | **Invited builders see a welcome page** to set their password, with the option to skip it by using Google | `staff-password#welcome` | — |
| 13 | **AI search is removed everywhere it was linked** (header, drawer, footer, search card, empty results) by the same components with one switch, so nothing is redesigned when it returns | ADD-10 | C-03, C-19 |
| 14 | **Region-neutral side-panel headline** ("Find the place that fits your life.") because the launch region wording is undecided | `auth-phone` | `DEC-14` |
| 15 | **One place combobox everywhere** (search card wide and stacked, results filter rail, post wizard, localities editor). Type 3 characters, choose from a list, "Tamil Nadu only for now". On phones it opens as a full-screen sheet | `place-suggest` | ADD-07 |
| 16 | **Provider attribution is always visible**: "Powered by Ola Maps" and "© OpenStreetMap contributors · ODbL" in the panel footer, and a short notice under the address field. Wording and placement follow the Ola terms review | `place-suggest`, `consent-snippets` | `S0-T05` |
| 17 | **Suggestions fail softly.** If the service is down or rate-limited, the field still works as a keyword search ("Search for “…” as a keyword"); nothing blocks searching | `place-suggest#degraded` | RISK |
| 18 | **Post wizard step 1 now holds the address**: place search, editable address lines, a **draggable pin** and a manual route ("I can't find it") that asks the person to tap the map. Locality, city and pincode stay editable; State is read-only (Tamil Nadu) | `post-address` | ADD-08 |
| 19 | **Pin visibility has two wordings** (A: exact spot shown, B: area shown, pin about 100 m off, projects always exact). Both are designed; the screen shows one at a time | `post-address`, `map-view#approx` | **`DEC-35`** |
| 20 | **No map, no block.** If the map fails to load the person can continue without a pin; the listing just won't appear on the map view | `post-address#map-failed` | ADD-08 |
| 21 | **The hero layout setting is real**: Search Desk (strip banner under the search) or Split (search left, larger panel banner right). A sponsor only appears in a layout if it supplied that format | `admin-sponsors` | ADD-11 |
| 22 | **Banners are finished images, four slots per sponsor** (strip desktop 970 × 90, strip phone 320 × 100, panel desktop 524 × 494, panel phone 640 × 320), supplied at twice the size. Validation is shown per slot: fills the slot, shown whole on a plain background (8 to 30 percent off shape), rejected (wrong shape, too small, too large, wrong type) | `admin-sponsors` drawer states | `DEC-15` |
| 23 | **SVG is not accepted** for banners (can carry scripts). The sample banners in the prototype are stand-ins only | `admin-sponsors#drawer-bad` | security |
| 24 | **No rotation, scheduling, billing or reports.** Several sponsors show in order with a manual pager. With no eligible sponsor, **nothing is rendered**: no frame, label or gap | `admin-sponsors`, preview | scope |
| 25 | **Localities are curated in the admin**: label, a place chosen from the search, radius, order. The first four also become the Popular chips in the search card. Default limit **8**; with none, the section and the chips are hidden | `admin-localities` | `DEC-13` (limit to confirm) |
| 26 | **One legal reading layout** for Privacy, Terms and Cookies: contents list on the left (a dropdown list on phones), one reading column, placeholder text highlighted so it is obvious what you still need to supply | `legal-page` | `DEC-25` |
| 27 | **Consent text sits directly under the button it relates to** on six forms, with the Privacy link. A cookie notice exists in the design but is **only needed if analytics or other non-essential cookies are added** | `consent-snippets` | `DEC-25` |
| 28 | **Map view is optional and last**: list and map side by side on desktop, a List / Map switch on phones. The list is the accessible equivalent and always complete; nothing exists only on the map | `map-view` | `DEC-34`, RISK-28 |

## 3. Open questions

1. **Variant A or B** for the second step (`DEC-05`)? Both are designed; A is free, B is a billed add-on.
2. **Lockout and expiry numbers** (code 5 min, 3 attempts, 15-minute pause, link 1 hour): acceptable as defaults (`DEC-31`)?
3. Should the **name be asked at sign-up** (as designed) or only at first post/enquiry?
4. **Consent wording** under "Send code" and the Terms/Privacy links are placeholders until your legal text exists (`DEC-25`).
5. **Lost second-step process** (who resets, how identity is confirmed).
6. Should customers see a **"Builder? Sign in"** link on the phone screen (designed) or keep builder entry only in the footer?
7. **Pin wording A or B** (`DEC-35`): show the exact spot, or only the area (about 100 m off)? This also decides whether the map view shows dashed "approximate" pins.
8. **Banner file limits** (150 KB each, JPG, PNG or WEBP, twice the display size) and the **near-miss tolerance** (8 to 30 percent) are defaults to confirm (`DEC-15`).
9. **Localities**: is a limit of **8** right, and what should the **default radius** be (3 km shown)?
10. **Ola Maps terms**: the attribution and the "what you type is sent to Ola Maps" notice must match what Ola's terms require (`S0-T05`). Wording changes only; layout stays.
11. **Cookie notice**: will analytics or any other non-essential cookie be used at launch? If not, the notice and settings are not built.
12. **Map view** (optional): build it after the core release, or drop it from v1? It needs the India boundary check (RISK-28).
13. **Sponsor images**: who supplies the finished images and checks the alt text, and does Find Prop need to see them before they go live (an approve step is not designed)?

---

## 4. New components (built from approved tokens only)

| Component | Anatomy | States | Accessibility |
|---|---|---|---|
| **PhoneField** | Standard input with a fixed **+91** prefix tab inside the field | default, focus, error, read-only prefix | `type=tel`, `inputmode=tel`, `autocomplete=tel-national`; prefix is decorative text and repeated in the hint; error linked by `aria-describedby` |
| **OtpInput** | One real input (opacity 0, full size) over six `aria-hidden` cells; caret in the next empty cell | empty, typing, filled, verifying, error (shake only without reduced motion), verified, disabled | One labelled field for screen readers; `autocomplete=one-time-code`, `inputmode=numeric`, `maxlength=6`; errors with `role=alert`; focus returns to the field |
| **HumanCheck placeholder** | Box with checkbox/spinner/check + "Security check (provider widget)" | verified, checking, failed | Provider widget decides its own markup; our wrapper announces status politely |
| **ResendRow** | "Resend code in 0:42" + text button | counting, available, sent, blocked | Countdown announced at 30 s, 10 s and at zero, not every second |
| **NumberedSteps** | Numbered discs with title and one sentence | — | Ordered list semantics |
| **QrPanel + KeyBox** | QR in a framed square; copyable key under "Can't scan?" | default, copied | QR has a text alternative; the key is selectable and has a Copy button |
| **RecoveryCodes** | Two-column list of ten codes, Copy and Download, "I have saved these" checkbox gating Continue | unchecked (Continue disabled), checked | List semantics; codes selectable; Continue's disabled state explained by the checkbox label |
| **ContextChip** | Thumbnail + title + locality/price of what the person was doing | — | Plain text; not a link |
| **PromptCard** | Title, one sentence, inline email form, "Later" | default | Form labelled; dismiss is a button |
| **QuietSignIn layout** | Centered card without side panel or footer | default | `noindex` |
| **Button link** (`btn-link`) | Underlined text button, 44 px target | default, hover, disabled | Real `<button>` |
| **PlaceCombobox + SuggestPanel** | Input with clear (x) button; panel with rows (icon, place, area and pincode), keyword fallback row, footer with provider attribution. Phone: full-screen sheet with back button | idle, typing, loading (skeleton rows), results, no results, degraded, rate limited, selected | `role=combobox` with `aria-expanded`, `aria-autocomplete=list`, `aria-activedescendant`; panel `role=listbox`, rows `role=option`; result count in a polite status; Escape closes, Enter picks |
| **PlaceCard** | Pin disc, place name, "Tamil Nadu 600042", **Change** button | default | Plain text plus a real button |
| **PinPicker** | Map with one draggable pin and a halo, zoom buttons, attribution strip | placed, no pin yet, outside Tamil Nadu, map failed | Region labelled and described; the pin moves with the arrow keys when focused, Enter confirms; zoom buttons are real buttons |
| **VisibilityNote** | Eye icon, "What visitors see" and one or two sentences | wording A, wording B | Plain text |
| **MapBox** (view only) | Illustrated map in the prototype; real MapLibre in the build. Price pins, featured and project pins, approximate area ring, cluster discs, controls, attribution | default, selected, approximate, clustered, loading, tiles failed | Skip link to the list; pins are also reachable as list cards; controls are buttons; map region is `role=application` with a label and a pointer to the list |
| **MapCard** | Thumbnail, price, title, locality line, save heart | default | Dialog with a label; focus moves to it on selection, Escape closes |
| **SearchThisArea** | Floating pill on the map | visible after the map moves | Real button; result count updates in a status line |
| **SponsorSlot** | Slot title and required size, preview at true ratio, status line, Replace / Remove or Choose file | empty, filled, near-miss (shown whole), rejected (shape, size, type, weight), saving | Status is text plus icon, never colour alone; rejected messages use `role=alert` |
| **LayoutCards** | Two selectable cards with a small picture | Search Desk, Split | `role=radiogroup` with `aria-checked`; the description names the format needed |
| **LocalityRow** | Drag grip, label, place (combobox or PlaceCard), radius select, up, down, Remove | default, new row with suggestions, error, disabled arrows at the ends | Each control is labelled by row; the arrows are the keyboard way to reorder |
| **LegalLayout** | Contents list (sticky on desktop, a collapsible list on phones), reading column at about 68 characters, highlighted placeholder text | privacy, terms, cookies | Landmarks: nav "On this page", main, headings in order |
| **ConsentLine** | Small muted sentence under a button, with links | default | Plain text; links are real links with the approved underline |
| **CookieNotice + Settings** (optional) | Bottom-left card (bottom sheet on phones) with Accept all, Essential only, Choose; settings dialog with switches | banner, settings | `role=region` for the notice; settings is a modal dialog with focus trap; Essential is on and disabled with a spoken reason |

All use existing tokens; **no new colour, font, radius, shadow, spacing step or breakpoint**. New contrast pairs, measured from the real token values: muted on parchment 5.28, ink on parchment 12.48, success on its tint 5.52, forest on its tint 8.29, white on forest 10.02, accent text on white 6.22; input outlines 3.34 (non-text needs 3). All pass WCAG AA.

---

## 5. Copy deck (final English, short and whole sentences)

| Screen / state | Text |
|---|---|
| Phone · title | **Sign in or create your account** · "Enter your mobile number and we'll text you a 6-digit code. New to Find Prop? We'll set up your account." |
| Phone · field | Label **Mobile number** · hint "Indian mobile numbers only for now. We use it to sign you in." · button **Send code** |
| Phone · consent | "By continuing you agree to our Terms and Privacy Policy. We'll send you one text message; your carrier may charge for it." (wording to confirm) |
| Phone · invalid | "Enter a 10-digit mobile number that starts with 6, 7, 8 or 9." |
| Phone · unsupported | "We can only send codes to Indian (+91) mobile numbers right now." |
| Phone · rate limited | **Too many codes requested** · "For your security, please try again in 14 minutes." |
| Phone · unavailable | **We can't send codes right now** · "Nothing is wrong with your number. Please try again in a few minutes." |
| Phone · human check failed | **We couldn't confirm you're a person** · "Check your connection and run the check again." |
| Code · title | **Enter the 6-digit code** · "We sent a text message to +91 98••• ••412. Change number" |
| Code · wrong | **That code isn't right** · "Check the message and try again. You have 3 attempts left." |
| Code · expired | **This code has expired** · "Codes work for 5 minutes. Request a new one to continue." |
| Code · locked | **Too many wrong codes** · "For your security, entering codes is paused. Try again in 15 minutes, or use a different number." |
| Code · resent | **New code sent** · "It may take a minute to arrive. Use the newest message." |
| Code · success | **Number verified** · "Welcome to Find Prop. Taking you back to what you were doing…" |
| Email · entry | **Add your email** · "We'll send you a link to confirm it. You need a verified email to post a property. Saving homes and sending enquiries work without it." |
| Email · sent | **Check your email** · "We sent a link to … Open it on this phone or computer to finish." · "Can't see it? Look in your spam folder. The link works for 1 hour." |
| Email · verified | **Email verified** · "Thanks, … is confirmed. You can post a property and we can tell you when it is reviewed." |
| Email · expired | **This link has expired or was already used** · "Links work once and for a short time. Send yourself a new one to continue." |
| Email · taken | "We couldn't use that email. Try a different address." |
| Email · prompt | **Add your email to post a property and get updates** · "We'll send a link to confirm it. It takes a minute." |
| Email · gate | **Verify your email to post a property** · "We use it to tell you when your listing is reviewed and to keep your account safe." · "Nothing you've entered is lost. You'll come back to this step of your listing." |
| Name | **What should we call you?** · "Your name appears on the enquiries you send and on the listings you post. You can change it later." · error "Enter your name, at least 2 characters." |
| Builder · sign in | **Builder sign in** · "Use the email you were invited with. After signing in you'll enter a second-step code." |
| Builder · Google mismatch | **That Google account isn't the one we invited** · "You chose …. Your invitation went to …. Choose that Google account, or sign in with your email and password." |
| Builder · denied (approved text kept) | **This account doesn't have active builder access** · "If you think this is a mistake, contact Find Prop. You have been signed out." |
| Second step · set up | **Set up your authenticator app** · steps: Install an authenticator app · Scan this code with the app (or enter the key) · Enter the 6-digit code from the app |
| Second step · recovery | **Save your recovery codes** · "If you lose your phone, each code lets you sign in once. Keep them somewhere safe, not only on the same phone. We show them only now." |
| Second step · challenge | **Enter your code** · "Open your authenticator app and enter the 6-digit code for Find Prop." |
| Second step · lost | **Lost your device?** · "If you have a recovery code, use it to sign in and set up a new device. If not, Find Prop can reset your second step after confirming it's you." |
| Admin · not authorised | **This account isn't authorised** · "You have been signed out. Only the Find Prop administrator account can use this area." |
| Set password | **Welcome to Find Prop, Kadal Homes** · "Set a password to finish creating your builder account. You'll use it, or your Google account, to sign in." |
| Place · idle | **Type at least 3 characters** · "Start with an area, a street or a landmark, for example “Velachery”." · "Suggestions cover Tamil Nadu only for now." |
| Place · no results | **No places found for “…”** · "Check the spelling or try a nearby area." · row: Search for “…” as a keyword |
| Place · degraded | **Suggestions aren't available right now** · "Type the area and press Search. We'll match it by name." |
| Place · rate limited | **Too many searches in a moment** · "Wait a few seconds and keep typing." |
| Place · attribution | Powered by Ola Maps · © OpenStreetMap contributors · ODbL (wording to match the provider's terms) |
| Post · address | **Where is the property?** · hint "Start typing and choose from the list. Tamil Nadu only for now." · link **I can't find it. Enter the address myself** |
| Post · confirm pin | **Confirm the location** · "Drag the pin to the exact entrance if it is in the wrong place. Use the + and − buttons to zoom." |
| Post · pin outside | **That spot is outside Tamil Nadu** · "We only list homes in Tamil Nadu for now. Move the pin, or check the address above." |
| Post · map failed | **We couldn't load the map** · "You can continue without a pin. Your listing will not appear on the map view until you add one." |
| Post · visibility A | **What visitors see** · "The pin shows exactly where you place it. Drag it to the entrance, or to the nearest road if you'd rather not show the exact spot." |
| Post · visibility B | **What visitors see** · "Visitors see the area, not the exact spot: the pin is shown within about 100 metres of where you place it. Your phone number is never shown." |
| Post · errors | **Please fix 3 things before you continue** · "Add the street or building." · "Enter the 6-digit pincode." · **Place the pin on the map**: "We need a location to show your home on the map." |
| Sponsors · empty | **No sponsors yet** · "The homepage shows no banner and no empty space. Add a sponsor to show a banner under the search (Search Desk) or beside it (Split)." |
| Sponsors · layout warning | **2 of 3 sponsors don't have the Split format** · "They won't be shown while Split is live. Add a Panel image to each in Sponsors below." |
| Sponsors · near miss | **Will be shown whole on a plain background** · "The shape is 8 to 30 percent away from the slot, so we don't crop it. For the best result supply 640 × 200." |
| Sponsors · rejected | **Rejected: wrong shape** · **Rejected: SVG isn't accepted** · **Rejected: too small** · **Rejected: 412 KB is too large** (each with one sentence saying what to do) |
| Sponsors · delete | **Delete Sample Builder?** · "This removes the sponsor and its images. Visitors stop seeing it straight away. This can't be undone." |
| Localities · intro | "Tiles shown under the search. The first 4 also appear as Popular chips in the search card. Visitors who click one see homes within the radius." |
| Localities · limit | **You've reached the limit of 8 localities** · "Remove one to add another." |
| Localities · empty | **No localities yet** · "The “Explore by locality” section is hidden on the homepage until you add one, and the Popular chips in the search card are left out. No empty space is shown." |
| Map · too many | **Too many homes to show as pins** · "Zoom in to see them one by one." |
| Map · no results | **No homes in this area** · "Zoom out or move the map." |
| Map · outside | **This area is outside Tamil Nadu** · "We only list homes in Tamil Nadu for now." · button Back to Tamil Nadu |
| Map · tiles failed | **We couldn't load the map** · "The list still works. Check your connection and try again." |
| Consent · enquiry | "The owner will see your name, phone number and message so they can reply. We don't show your details to anyone else." (wording to confirm) |
| Consent · listing | "I confirm this listing is accurate and I have the right to advertise this property." · "We show the locality and your photos publicly. Your phone number is never shown; it is shared only with people who enquire about this listing." (wording to confirm) |
| Cookies · notice | **We use cookies to keep you signed in and to improve Find Prop** · "Essential cookies are always on. We'd also like to use optional ones to see which pages help people most." · Accept all · Essential only · Choose |

---

## 6. Accessibility notes (focus order, announcements, keyboard)

| Screen | Focus order and behaviour | Announcements |
|---|---|---|
| Phone | Skip link → header → number field → human check → Send code → Terms/Privacy links → builder link. Invalid: focus moves to the number field | Errors `role=alert`; "Sending code" via `aria-busy` on the button |
| Code | Focus lands in the code field on load; paste or typing fills cells; on error focus stays in the field; Resend becomes focusable when the countdown ends | Wrong/expired/locked `role=alert`; "New code sent" `role=status`; countdown announced politely at 30 s, 10 s, 0 |
| Email | Field → Send link → "Not now"; on "sent" the heading receives focus | "Check your email" is a status; resend countdown polite |
| Gate | Heading receives focus; the form follows; the saved-draft note is read after the button | status |
| Name | Field → Continue → Skip; error focus returns to the field | alert |
| Builder sign-in | Google → email → password (show/hide button) → Sign in → Forgot password; mismatch alert is read first | alert |
| Second step | Steps in reading order; QR has a text alternative; code field then submit; recovery checkbox must be checked before Continue is enabled | wrong code alert; "Copied" status after Copy |
| Admin | Same as builder; the not-authorised alert is read on load | alert |
| Navigation board | Same landmarks as approved; skip link first | — |
| Place combobox | Focus stays in the input while arrow keys move the highlighted row; Enter chooses; Escape closes and keeps the typed text; on phones the sheet takes focus and returns it to the field when closed | Result count (or "No places found") in a polite status; loading is announced once |
| Post · address and pin | Place field → manual link → address lines → pin region → Continue. After choosing a place, focus moves to the address line; the pin region can be moved with arrow keys and has a text description | Pin moves and "outside Tamil Nadu" are announced as status or alert |
| Admin · sponsors | Layout cards → Add sponsor → table rows (Order arrows, Edit). The drawer traps focus; closing returns focus to the button that opened it | Per-slot results are announced when a file is chosen; saving is `aria-busy` on the button |
| Admin · localities | Add locality → each row in order (label, place, radius, arrows, Remove); reordering moves the row and announces its new position | Validation summary at the top is an alert and links to the rows |
| Legal pages | Skip link → contents list → article; headings in order; each section heading is an anchor target | — |
| Map view | Skip link to the list first; map is one tab stop with the controls inside; selecting a pin moves focus to the card; **the list holds every home** | Count and "map moved" are a polite status |
| Cookie notice | Not a modal: it does not trap focus and does not block the page; settings is a modal dialog | Settings states are read with each switch |

Keyboard: every control is reachable and operable with Tab, Shift+Tab, Enter and Space; focus ring is the approved single ring; reduced motion removes the code-cell shake and spinner animation. Touch targets follow the approved system (40 to 44 px on touch; the only smaller targets are inline text links inside sentences).

---

## 7. How this was checked

**Automated (`node tools/check.mjs`)**, final run over all three batches: **329 page loads** (every state at 390 and 1440, default states also at 820, 1024 and 1280). Result: **0 problems**: no console errors or exceptions, no horizontal overflow, no broken images, no text under 11 px, no duplicate ids, no dead links. 19 informational notes: inline text links inside sentences are shorter than 36 px (allowed as inline text).

**By eye (batch 1):** the phone sign-in, code entry (wrong), authenticator set-up (desktop), recovery codes (phone), email prompt and gate, builder Google mismatch (phone), administrator not-authorised (phone), homepage B and the navigation board. Six layout defects found and fixed: the manual key wrapping beside the QR code, recovery codes colliding on phones, the prompt-card input stretching, inline bold breaking an alert sentence, an empty bottom-bar preview and a clipped drawer in the navigation board.

**By eye (batches 2 and 3):** place suggestions (results on desktop and phone, filter rail, stacked search card, no results), post-property address (results, chosen place), legal page (privacy), sponsors (hero, rejected-image drawer), localities (add, errors), map view (selected, phone map), cookie notice. Defects found and fixed: the suggestion list clipped by the hero and hidden under the phone header and bottom bar, a suggestion list placed inside a sticky side column, horizontal overflow on the phone legal page from the table, contents numbers appearing on non-list links, the sponsors and localities tables squeezed by the preview column (both now full width), place rows with overlapping text, the map card's save button stretching into an oval over the card, related legal links run together, and sample suggestions that did not match the typed text.

**Not done:** real browsers other than Chrome; Safari and Firefox; real phones; screen reader or keyboard run on assistive technology; usability testing; the human-check and SMS-code fields were not tested with real autofill (iOS and Android one-time-code suggestions); Tamil text; **real map tiles, India-boundary behaviour and real place data** (the maps are illustrations); drag and drop of the pin, banner upload and locality reordering are shown as states, not as working interactions.

---

## 8. Not covered

PG and hostels (ADD-13, gated until the requirement exists). The approved screens for areas not listed in the traceability table stay as they are. **Maps in the prototype are illustrated placeholder art** (fictional geography), not real tiles; real maps, India-boundary behaviour and place data are checked in the build.

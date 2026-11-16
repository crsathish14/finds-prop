# AI chat: draft changes to the privacy policy, cookie policy and processors list

**OWNER APPROVAL NEEDED. DRAFT, NOT REVIEWED BY A LAWYER. NOT PUBLISHED.** Written by an AI agent in task AI-P8-T03 (16 Nov 2026) from how the code behaves today. The live pages read their text from `src/features/legal/content/privacy.ts` and `cookies.ts`, not from `en.json`, so **nothing here is on the site**: the legal wording is the owner's (and the legal reviewer's) to approve and put there. Facts below are from the code and `docs/runbooks/ai-chat.md`; check each one again before approving.

## What is true (the facts the wording rests on)

- The AI chat is behind `FLAG_AI_SEARCH` (off by default). When on, a visitor's typed messages go to the model provider (OpenAI, model `gpt-6-luna`) to produce an answer.
- **Sent to the provider:** the system instructions, the conversation so far as the browser sends it (within the app's limits), the results of the app's own search tools for that message (public listing data), and the customer's message text. Phone numbers, email addresses and similar personal details typed into a message are masked before the model sees them (the input check). The enquiry and visit cards are filled in by the app, and **nothing is sent to a builder or owner until the customer presses Send** on the card.
- **Not sent:** the customer's account details, phone number or email from their profile, saved homes, or other users' data.
- **What the app stores about a message** (`ai_usage_events`): time, whether signed in or anonymous, the user id (signed in) or a one-way hash of address and browser (anonymous), prompt version, model, outcome, which tools ran, token counts, duration, rule tags. **No message text and no answer text is stored.** Rows are kept 12 months (provisional, `docs/runbooks/retention.md`); deleting an account removes the user id and keeps the row as an anonymous fact.
- **In the browser:** the conversation is kept in `sessionStorage` for that tab only and disappears when the tab closes (it goes nowhere except back with the next message). **Cookie `fp_ai_anon`:** a random first-party id, `HttpOnly`, `Secure`, `SameSite=Lax`, kept one year, used only to count the free trial of 2 messages per browser; not used for advertising or tracking.
- The provider's retention, training-use and data-location terms were accepted by the owner on 16 Nov 2026. **The agent did not read them; the owner's reviewer must state the actual retention period and location in the wording below.**

## Draft: privacy policy, new section "AI assistant"

> **[DRAFT, owner approval needed]**
> **AI assistant.** If you use the AI assistant on Find Prop, the messages you type are sent to our AI provider, OpenAI, so that it can write a reply. We also send it the public listing information the assistant looks up to answer you. We do not send it your account details, and we remove phone numbers and email addresses you type before they reach the provider. Please do not type sensitive personal information into the assistant.
> We keep a record of each message that tells us when it was sent, whether you were signed in, how much of the service it used and whether it worked. We do not keep the text of your messages or of the replies on our servers. While you use the assistant, your conversation is held in your browser tab and is removed when you close it.
> OpenAI processes the messages for us under its terms. **[Owner/legal: state OpenAI's retention period, whether it may use the messages to train its models, and where it processes them, from the accepted terms.]** If you ask the assistant to send an enquiry or request a visit, nothing is sent until you press Send, and then it is handled like any other enquiry.
> **[Owner/legal: lawful basis, how to ask for deletion or access, and the 12-month retention of usage records.]**

## Draft: cookie policy, new rows

| Name                                   | What it does                                               | Lifetime             | Draft wording (**owner approval needed**)                                                                                                               |
| -------------------------------------- | ---------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fp_ai_anon`                           | Counts the free trial of the AI assistant for your browser | 1 year               | "A random code that lets us count how many free AI assistant messages this browser has used. It is not used for advertising and does not identify you." |
| Browser tab storage (`sessionStorage`) | Keeps your AI conversation while the tab is open           | Until the tab closes | "Your conversation with the AI assistant is kept in this tab only and is deleted when you close it."                                                    |

Open question for the legal reviewer: whether `fp_ai_anon` is "strictly necessary" (it enforces a usage limit and abuse protection) or needs consent.

## Draft: processors list (privacy policy, and the "Third-party processors" row of `docs/engineering/security.md`)

Add: **OpenAI** (AI assistant): receives the text of messages typed into the assistant and the public listing facts looked up for the reply; no account details. **[Owner/legal: legal entity, location of processing, transfer basis, retention.]** The security.md row is left unchanged until the owner approves this wording.

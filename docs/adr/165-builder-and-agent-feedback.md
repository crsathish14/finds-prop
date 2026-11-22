# ADR-165 · Builder and agent feedback to the super admin

- Status: Accepted (owner's change request, 22 Nov 2026; wording of labels is draft for the owner to confirm)
- Date: 2026-11-22
- Related: ADR-092 (builder portal frame), ADR-094 (builder edits and their rate limit), S7-T05 (builders and agents), `docs/engineering/security.md` (rate limits)
- Class: C2 (new table, new functions, new pages)

## Decision

- **Message only.** A builder or an agent writes a plain-text message of 1 to 1000 characters on a **Feedback** page of the builder portal. No attachment, no subject, no reply. Text is drawn as text, never as HTML.
- **One table, no direct access.** `builder_feedback` (id, builder, message, reviewed_at, created_at) has no grants and no policies for visitors or signed-in people. Everything goes through four functions that check the caller: `submit_builder_feedback` (an active builder or agent; the sender is the session, never an argument), `admin_feedback_list` (page of at most 100, filter all, not reviewed or reviewed, newest first), `admin_feedback_counts`, `admin_set_feedback_reviewed` (super admin only). The sender cannot read their own message afterwards.
- **Review flag.** `reviewed_at` is empty for "not reviewed". Marking again keeps the first date; the flag can be switched back.
- **Audit.** Triggers write `feedback.created`, `feedback.reviewed` and `feedback.unreviewed` with the message id and the sender's builder id, never the text.
- **Rate limit.** New scope `builder_feedback`: 5 messages per person per hour. Marking reviewed uses `admin_edit`.
- **Superadmin view.** `/admin/feedback` lists who (name), role (Builder or Agent), when and the message, with filters (Not reviewed is the default, All, Reviewed), 25 per page with Previous and Next, and a button to mark each message. The sidebar shows the number not reviewed beside Feedback.
- **No notification.** The repository sends no email or push to admins (DEC-27); the count in the sidebar is the notice.

## Consequences

- Retention of old messages is not decided; they stay until the owner asks for a rule.
- Draft wording (labels, toasts, empty states) is in `en.json` under `builderPortal.feedback` and `admin.feedback`, for the owner's approval.

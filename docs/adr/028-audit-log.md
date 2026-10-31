# ADR-028 · Audit log

- Status: Accepted
- Date: 2026-10-29
- Related: Proposed; approval: Inform; stage S3

> Approved with the architecture review on 29 Oct 2026 (DEC-01).

## Record

- **Decision:** `audit_log(id, at, actor_id, actor_role, action, entity_type, entity_id, diff jsonb, request_id, ip_hash)` written by SECURITY DEFINER triggers for moderation, role and builder changes, CRM secret changes, CMS publish, and by actions for sign-in events of staff. Read-only to admin; no UI in v1 beyond a SQL-backed list (optional).

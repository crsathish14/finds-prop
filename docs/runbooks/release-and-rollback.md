# Release, rollback and incident procedures

> Copied from the implementation plan on 31 Oct 2026 and now maintained here (HD-11). References to plan documents (`06`, `07` and so on) point to the archived plan.

### 8.1 Release checklist (each production release)

1. `develop` green on full E2E and Lighthouse; no open Sev-1/2 bugs; dependency audit clean.
2. Release PR lists requirements shipped, migrations, config changes, flags, known issues.
3. Staging/preview rehearsal passed (migration dry-run on prod-shaped DB).
4. Backup confirmed; reviewer approves `production` environment.
5. Migrate → deploy → smoke → monitor 30 minutes → announce.

### 8.2 Rollback decision tree

| Symptom                                      | Action                                                                                                                                   |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| App bug, DB unchanged or backward compatible | Vercel **instant rollback** to the previous deployment (minutes)                                                                         |
| App bug caused by a migration                | Feature-flag off if possible; ship a forward-fix migration; if data is being damaged, stop traffic (maintenance flag), restore per below |
| Bad data change                              | Use reviewed rollback script; for destructive loss restore from backup/PITR into a new project and re-point (runbook), accepting RPO     |
| Failed migration mid-deploy                  | Pipeline already stopped; app untouched; fix and re-run                                                                                  |
| Third-party outage (MSG91/Resend/Ola)        | OTP: communicate, consider temporary alternate provider via adapter; places: degraded mode (manual locality text); CRM: queue continues  |

### 8.3 Incident handling

Severity: **Sev-1** sign-in or listing pages down, data exposure; **Sev-2** major feature broken; **Sev-3** degraded. Steps: acknowledge, assign lead, mitigate (rollback/flag), communicate, preserve evidence (logs by request id), fix, write a short post-incident note with action items. **Suspected data exposure** → rotate keys (`07` §9), review `audit_log`, assess notification duties with counsel (DPDP).

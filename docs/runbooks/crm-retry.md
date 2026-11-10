# Sending form submissions to a CRM, and retrying them

A form can send each submission to a CRM (the form's "CRM integration" box). The server sends it right after the visitor's answer. If the CRM does not accept it, the submission is tried again after 1, 5, 30, 120 and 720 minutes, up to six attempts in all (BR-66). The retries are run by a job in the database that calls the site once a minute. The job is **armed by the site itself** when a delivery fails, and turns itself off when nothing is waiting, so there is nothing to start by hand. It can only work if the two settings below exist (ADR-116).

## Set it up (once per environment, the owner)

You need the site's public address and a secret token. Run these in the project's **SQL Editor** (dev first). Pick your own token of at least 32 random characters; do not paste it anywhere else.

1. The address the job calls, if it is not set yet (the media sweep uses the same setting). Use the address people reach the site on, with no trailing slash:

   ```sql
   insert into public.app_config (key, value)
   values ('app.public_url', 'https://YOUR-SITE-ADDRESS')
   on conflict (key) do update set value = excluded.value;
   ```

2. The token:

   ```sql
   insert into public.internal_cron_tokens (name, token)
   values ('crm_retry', 'YOUR-RANDOM-TOKEN-OF-AT-LEAST-32-CHARACTERS')
   on conflict (name) do update set token = excluded.token;
   ```

Until both exist, a failed delivery is recorded and its next try is scheduled, but nothing runs the retries: the site's log shows `the crm retry job could not be changed`. The admin's "Retry delivery now" works without them. Once they are set, the next failed delivery (or saving a connection as active) arms the job.

## Check it

- The job exists while something waits: `select jobname, schedule, active from cron.job where jobname = 'crm-retry';` (every minute). No row means nothing is waiting, or it was never armed.
- It ran: `select status, return_message, start_time from cron.job_run_details where jobid = (select jobid from cron.job where jobname = 'crm-retry') order by start_time desc limit 5;`. A `succeeded` row means the request was sent; the site's log line `crm retry done` says how many submissions were taken (`claimed`), sent and failed. A `crm retry refused: token missing or wrong` line means the token in the table is not the one the job sent: arm again (below).
- What is waiting: `select id, form_name, crm_status, crm_attempts, next_retry_at, last_error from public.form_submissions where crm_status in ('pending', 'failed') and crm_integration_id is not null order by created_at;`. A failed row with no `next_retry_at` has used its six attempts: use "Retry delivery now" on the leads page, or see below.
- The delivery log (what was sent where, and the CRM's answer, cut and with secrets blanked out): `select created_at, integration_name, form_name, outcome, http_status, attempt, response_snippet from public.crm_api_logs order by created_at desc limit 20;`.

## Arm or stop it by hand

```sql
select public.arm_crm_retry();      -- starts the once-a-minute job (replaces it if it exists)
select public.disarm_crm_retry();   -- stops it
```

Arming says `crm_retry.not_configured` if step 1 or 2 is missing. Rotate the token by repeating step 2 and arming again.

## When the CRM is down

- Leave it. Each failed submission follows the schedule on its own and stops after six attempts; nothing is lost, and every attempt is in the delivery log.
- To stop sending while the CRM is down, switch the connection off on the CRM page. Submissions on an inactive connection wait, are not sent and are not lost; they go out within a minute of switching it on again: saving a connection as active arms the job, which sends what waits and turns itself off.
- When the CRM is back, press "Retry delivery now" on a failed submission. It is sent at once and the schedule starts again from attempt 1, even if all six attempts were used.

## Rules

- The token is a secret: the route answers anything else with a plain 401 and nothing more.
- A connection that was deleted cannot be sent to: its submissions are marked "not applicable" with the reason "The connection was deleted." and the delivery history is kept.
- A result is recorded after the call. If the site stops between the call and the record, the lease on the submission ends after five minutes and the job sends it again, so a CRM can in that rare case receive the same lead twice.

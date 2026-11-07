# Sweeping photo files nobody claimed

A listing photo lands in the `listing-photos` bucket before the server has looked at it. If the upload is never finished, the owner removes the photo, or a listing is deleted, the file is left behind with no `listing_media` row. An hourly job removes such files once they are 24 hours old (ADR-058). Nothing breaks if the job is not running; unclaimed files just pile up.

## Arm it (once per environment, the owner)

You need the site's public address and a secret token. Run these in the project's **SQL Editor** (dev first). Pick your own token of at least 32 random characters; do not paste it anywhere else.

1. The address the job calls, if it is not set yet (the CRM retry uses the same setting). Use the address people reach the site on, with no trailing slash:

   ```sql
   insert into public.app_config (key, value)
   values ('app.public_url', 'https://YOUR-SITE-ADDRESS')
   on conflict (key) do update set value = excluded.value;
   ```

2. The token:

   ```sql
   insert into public.internal_cron_tokens (name, token)
   values ('media_sweep', 'YOUR-RANDOM-TOKEN-OF-AT-LEAST-32-CHARACTERS')
   on conflict (name) do update set token = excluded.token;
   ```

3. Start the job:

   ```sql
   select public.arm_media_sweep();
   ```

   Arming again replaces the job, so it is safe to repeat after changing the address or the token. If it says `media_sweep.not_configured`, step 1 or 2 is missing.

## Check it

- The job exists: `select jobname, schedule, active from cron.job where jobname = 'media-sweep';` (hourly, at minute 17).
- It ran: `select status, return_message, start_time from cron.job_run_details where jobid = (select jobid from cron.job where jobname = 'media-sweep') order by start_time desc limit 5;`. A `succeeded` row means the request was sent; the site's log line `sweep done` says how many files were removed (`removed`). A `sweep refused: token missing or wrong` line means the token in the table is not the one the job sent, so arm again.
- What would be removed right now: `select * from public.orphan_listing_photos();` (files older than 24 hours with no photo row). Use `public.orphan_listing_photos(0)` to see every unclaimed file.

## Stop it

```sql
select public.disarm_media_sweep();
```

## Rules

- The token is a secret: the route answers anything else with a plain 401. Rotate it by repeating step 2 and step 3.
- The job removes only files in `listing-photos` that have no row. It never touches a photo that belongs to a listing.
- Photo files of the fictional seed are safe: the seed script records each file's row right after uploading it.

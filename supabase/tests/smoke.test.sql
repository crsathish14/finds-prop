-- Proves the pgTAP wiring (`supabase test db`). Real tests arrive with the migrations in Stage 3.
begin;
select plan(1);
select ok(true, 'pgTAP is running');
select * from finish();
rollback;

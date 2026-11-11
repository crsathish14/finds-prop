-- S8-T04 authorization verification, part 1: who may run each public function (ADR-125).
-- Tests: DB-PRIV-function-catalogue.
-- Every function in the public schema is either open to visitors (a short list of read-only helpers and the search),
-- open to signed-in people (the helpers the policies call and the functions the portals use, each of which checks the
-- caller itself), or for the server only (the service role and the database's own jobs). The lists below are that
-- decision written down: a new function that is not in them, or a changed grant, fails here until it is looked at.
-- Event-trigger functions (the hosted project's own `rls_auto_enable`, which is not in the migrations) are left out:
-- PostgreSQL refuses to run them as ordinary functions.
begin;
select plan(5);

create function pg_temp.who_runs(role_name text) returns text
language sql
as $$
  select coalesce(string_agg(distinct proc.proname::text, ', ' order by proc.proname::text), '')
  from pg_proc as proc
  where proc.pronamespace = 'public'::regnamespace
    and proc.prokind = 'f'
    and proc.prorettype <> 'event_trigger'::regtype
    and has_function_privilege(role_name, proc.oid, 'execute')
$$;

select is(
  pg_temp.who_runs('anon'),
  'listing_is_public, listing_label, project_is_live, public_project_form, search_properties',
  'visitors can run only the public read helpers and the search'
);

select is(
  pg_temp.who_runs('authenticated'),
  'admin_builder_overview, admin_builders, admin_crm_integrations, admin_forms, admin_listing_counts, '
  || 'admin_listing_localities, admin_listing_queue, admin_overview, admin_project_overview, admin_projects, '
  || 'admin_properties, assert_open_listing_room, builder_insights, close_listing, current_builder_id, has_role, '
  || 'has_verified_phone, is_reserved_admin_email, is_super_admin, listing_is_editable, listing_is_public, '
  || 'listing_label, moderate_listing, moderate_project, my_builder, my_projects, my_properties, owns_property, '
  || 'project_is_live, project_is_mine, public_project_form, save_crm_integration, save_project_price_trends, '
  || 'search_properties, storage_listing_path_ok, storage_project_path_ok, submit_listing',
  'signed-in people can run the visitors'' list and the helpers and portal functions that check the caller themselves'
);

select is(
  (select coalesce(string_agg(proc.proname::text, ', ' order by proc.proname::text), '')
   from pg_proc as proc
   where proc.pronamespace = 'public'::regnamespace
     and proc.prorettype = 'trigger'::regtype
     and (has_function_privilege('anon', proc.oid, 'execute')
          or has_function_privilege('authenticated', proc.oid, 'execute'))),
  '',
  'no trigger function can be run by a visitor or a signed-in person'
);

select is(
  (select coalesce(string_agg(proc.proname::text, ', ' order by proc.proname::text), '')
   from pg_proc as proc
   where proc.pronamespace = 'public'::regnamespace
     and proc.prokind = 'f'
     and proc.proname in (
       'run_retention', 'audit_record', 'audit_write', 'rate_limit_hit', 'record_form_submission',
       'submit_enquiry', 'submit_project_lead', 'track_project_event', 'record_crm_delivery',
       'claim_crm_deliveries', 'finalize_listing_media', 'orphan_listing_photos', 'arm_crm_retry',
       'disarm_crm_retry', 'arm_media_sweep', 'disarm_media_sweep'
     )
     and not has_function_privilege('service_role', proc.oid, 'execute')),
  '',
  'the server-only functions can be run by the service role'
);

select is(
  (select coalesce(string_agg(proc.proname::text, ', ' order by proc.proname::text), '')
   from pg_proc as proc
   where proc.pronamespace = 'public'::regnamespace
     and proc.prokind = 'f'
     and proc.proname in (
       'run_retention', 'audit_record', 'audit_write', 'rate_limit_hit', 'record_form_submission',
       'submit_enquiry', 'submit_project_lead', 'track_project_event', 'record_crm_delivery',
       'claim_crm_deliveries', 'finalize_listing_media', 'orphan_listing_photos', 'arm_crm_retry',
       'disarm_crm_retry', 'arm_media_sweep', 'disarm_media_sweep'
     )
     and (has_function_privilege('anon', proc.oid, 'execute')
          or has_function_privilege('authenticated', proc.oid, 'execute'))),
  '',
  'and by nobody who holds a visitor''s or a signed-in person''s role'
);

select * from finish();
rollback;

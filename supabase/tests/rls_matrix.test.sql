-- S8-T04 authorization verification, part 1: the database matrix (ADR-125).
-- Tests: DB-RLS-matrix, DB-RLS-grants, DB-RLS-inventory.
-- Three layers over every public table, written from the policy table in plan 07 section 5:
--   1. the privileges each client role holds (anon, authenticated, service_role) on each table;
--   2. which of the known rows each of seven people can see: a visitor, two customers (A and B, both with a verified
--      phone), two active builders (A and B), an inactive builder (C) and the admin;
--   3. which writes each of them can make (a change that would succeed for the right person is tried, so a refusal is
--      the policy's and not a typing mistake). A write that fails for any reason, or changes no row, is "no".
-- The tables are also compared with the list below, so a new public table cannot ship without a row in the matrix.
-- The fixtures are the only rows the matrix looks at (each is found by its own id), whatever else the database holds.
begin;

-- Who is acting. `become` switches to a person (and back to the test's own role with 'postgres').
create function pg_temp.become(who text) returns void
language plpgsql
as $$
declare
  claims text;
begin
  reset role;
  claims := case who
    when 'anon' then ''
    when 'postgres' then ''
    when 'ca' then '{"sub": "00000000-0000-4000-8000-0000000000c1", "role": "authenticated", "phone": "919100000001"}'
    when 'cb' then '{"sub": "00000000-0000-4000-8000-0000000000c2", "role": "authenticated", "phone": "919100000002"}'
    when 'ba' then '{"sub": "00000000-0000-4000-8000-0000000000b1", "role": "authenticated"}'
    when 'bb' then '{"sub": "00000000-0000-4000-8000-0000000000b2", "role": "authenticated"}'
    when 'bc' then '{"sub": "00000000-0000-4000-8000-0000000000b3", "role": "authenticated"}'
    when 'ad' then '{"sub": "00000000-0000-4000-8000-0000000000ad", "role": "authenticated"}'
  end;
  perform set_config('request.jwt.claims', claims, true);
  if who = 'anon' then
    set local role anon;
  elsif who <> 'postgres' then
    set local role authenticated;
  end if;
end;
$$;

-- The names used in the cases below stand for the fixtures' ids.
create temp table alias (name text primary key, value text not null);
insert into alias values
  ('{uAD}', '00000000-0000-4000-8000-0000000000ad'), ('{uC1}', '00000000-0000-4000-8000-0000000000c1'),
  ('{uC2}', '00000000-0000-4000-8000-0000000000c2'), ('{uB1}', '00000000-0000-4000-8000-0000000000b1'),
  ('{uB2}', '00000000-0000-4000-8000-0000000000b2'), ('{uB3}', '00000000-0000-4000-8000-0000000000b3'),
  ('{p1}', '00000000-0000-4000-9000-000000000001'), ('{p2}', '00000000-0000-4000-9000-000000000002'),
  ('{p3}', '00000000-0000-4000-9000-000000000003'), ('{p4}', '00000000-0000-4000-9000-000000000004'),
  ('{m1}', '00000000-0000-4000-aa00-000000000001'), ('{m2}', '00000000-0000-4000-aa00-000000000002'),
  ('{e1}', '00000000-0000-4000-e100-000000000001'), ('{e2}', '00000000-0000-4000-e100-000000000002'),
  ('{e3}', '00000000-0000-4000-e100-000000000003'),
  ('{BA}', '00000000-0000-4000-b000-000000000001'), ('{BB}', '00000000-0000-4000-b000-000000000002'),
  ('{BC}', '00000000-0000-4000-b000-000000000003'),
  ('{pr1}', '00000000-0000-4000-c000-000000000001'), ('{pr2}', '00000000-0000-4000-c000-000000000002'),
  ('{pr3}', '00000000-0000-4000-c000-000000000003'), ('{pr4}', '00000000-0000-4000-c000-000000000004'),
  ('{pr5}', '00000000-0000-4000-c000-000000000005'),
  ('{u1}', '00000000-0000-4000-d000-000000000001'), ('{u2}', '00000000-0000-4000-d000-000000000002'),
  ('{u3}', '00000000-0000-4000-d000-000000000003'),
  ('{t1}', '00000000-0000-4000-e200-000000000001'), ('{t2}', '00000000-0000-4000-e200-000000000002'),
  ('{l1}', '00000000-0000-4000-a000-000000000001'), ('{l3}', '00000000-0000-4000-a000-000000000003'),
  ('{f1}', '00000000-0000-4000-f100-000000000001'), ('{f2}', '00000000-0000-4000-f100-000000000002'),
  ('{ci1}', '00000000-0000-4000-f000-000000000001'), ('{fs1}', '00000000-0000-4000-d100-000000000001'),
  ('{cl1}', '00000000-0000-4000-d200-000000000001');

create function pg_temp.fill(stmt text) returns text
language plpgsql
as $$
declare
  one record;
begin
  for one in select name, value from pg_temp.alias loop
    stmt := replace(stmt, one.name, one.value);
  end loop;
  return stmt;
end;
$$;

-- ad is the reserved admin; c1 and c2 are customers with a verified phone; b1 and b2 are active builders and b3 an
-- inactive one.
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000000ad', 'support@drizzlemarketings.com', now()),
  ('00000000-0000-4000-8000-0000000000b1', 'a@builders.example', now()),
  ('00000000-0000-4000-8000-0000000000b2', 'b@builders.example', now()),
  ('00000000-0000-4000-8000-0000000000b3', 'c@builders.example', now());
insert into auth.users (id, phone, phone_confirmed_at) values
  ('00000000-0000-4000-8000-0000000000c1', '919100000001', now()),
  ('00000000-0000-4000-8000-0000000000c2', '919100000002', now());
insert into public.user_roles (user_id, role) values
  ('00000000-0000-4000-8000-0000000000b1', 'builder'),
  ('00000000-0000-4000-8000-0000000000b2', 'builder'),
  ('00000000-0000-4000-8000-0000000000b3', 'builder');
insert into public.builders (id, user_id, email, name, active) values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-8000-0000000000b1', 'a@builders.example', 'Builder A', true),
  ('00000000-0000-4000-b000-000000000002', '00000000-0000-4000-8000-0000000000b2', 'b@builders.example', 'Builder B', true),
  ('00000000-0000-4000-b000-000000000003', '00000000-0000-4000-8000-0000000000b3', 'c@builders.example', 'Builder C', false);

-- Listings: p1 (customer A, approved, two photos), p2 (A, draft, one photo), p3 (customer B, approved), p4 (B, pending).
create function pg_temp.new_listing(listing uuid, owner uuid, listing_status text default 'draft') returns uuid
language sql
as $$
  insert into public.properties (
    id, owner_id, status, listing_type, property_type, title, description, price, area_sqft,
    locality, city, state, pincode, address
  ) values (
    listing, owner, listing_status, 'sale', 'apartment', 'Sea view apartment',
    'A bright two bedroom flat near the sea.', 8500000, 950, 'Adyar', 'Chennai', 'Tamil Nadu',
    '600020', '12 Beach Road'
  ) returning id
$$;
select pg_temp.new_listing('00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-0000000000c1');
select pg_temp.new_listing('00000000-0000-4000-9000-000000000002', '00000000-0000-4000-8000-0000000000c1');
select pg_temp.new_listing('00000000-0000-4000-9000-000000000003', '00000000-0000-4000-8000-0000000000c2', 'approved');
select pg_temp.new_listing('00000000-0000-4000-9000-000000000004', '00000000-0000-4000-8000-0000000000c2', 'pending');
insert into public.listing_media (id, listing_id, storage_path, mime, bytes, width, height, position) values
  ('00000000-0000-4000-aa00-000000000001', '00000000-0000-4000-9000-000000000001', 'matrix/p1-one.webp', 'image/webp', 50000, 1600, 1200, 0),
  ('00000000-0000-4000-aa00-000000000003', '00000000-0000-4000-9000-000000000001', 'matrix/p1-two.webp', 'image/webp', 50000, 1600, 1200, 1),
  ('00000000-0000-4000-aa00-000000000002', '00000000-0000-4000-9000-000000000002', 'matrix/p2-one.webp', 'image/webp', 50000, 1600, 1200, 0);
-- p1 goes through review to approved, as a real listing does.
update public.properties set status = 'pending' where id = '00000000-0000-4000-9000-000000000001';
update public.properties set status = 'approved' where id = '00000000-0000-4000-9000-000000000001';

-- Enquiries: e1 (customer B to A's listing p1), e2 (A to B's listing p3), e3 (builder A to B's listing p3).
insert into public.enquiries (id, property_id, user_id, name, phone) values
  ('00000000-0000-4000-e100-000000000001', '00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-0000000000c2', 'Matrix One', '9841000001'),
  ('00000000-0000-4000-e100-000000000002', '00000000-0000-4000-9000-000000000003', '00000000-0000-4000-8000-0000000000c1', 'Matrix Two', '9841000002'),
  ('00000000-0000-4000-e100-000000000003', '00000000-0000-4000-9000-000000000003', '00000000-0000-4000-8000-0000000000b1', 'Matrix Three', '9841000003');
-- Saved homes: customer A saved p3, customer B saved p1.
insert into public.saved_properties (user_id, property_id) values
  ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-9000-000000000003'),
  ('00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-9000-000000000001');

-- Projects: pr1 (builder A, live), pr2 (A, pending), pr3 (B, live), pr4 (C, pending: C is inactive), pr5 (B, pending).
insert into public.projects (id, slug, name, builder_id, locality, moderation, published, moderated_at) values
  ('00000000-0000-4000-c000-000000000001', 'matrix-one', 'Matrix One', '00000000-0000-4000-b000-000000000001', 'OMR Navalur', 'approved', true, now()),
  ('00000000-0000-4000-c000-000000000003', 'matrix-three', 'Matrix Three', '00000000-0000-4000-b000-000000000002', 'Adyar', 'approved', true, now());
insert into public.projects (id, slug, name, builder_id, locality, moderation, published) values
  ('00000000-0000-4000-c000-000000000002', 'matrix-two', 'Matrix Two', '00000000-0000-4000-b000-000000000001', 'Adyar', 'pending', false),
  ('00000000-0000-4000-c000-000000000004', 'matrix-four', 'Matrix Four', '00000000-0000-4000-b000-000000000003', 'Adyar', 'pending', false),
  ('00000000-0000-4000-c000-000000000005', 'matrix-five', 'Matrix Five', '00000000-0000-4000-b000-000000000002', 'Adyar', 'pending', false);
insert into public.project_units (id, project_id, unit_number) values
  ('00000000-0000-4000-d000-000000000001', '00000000-0000-4000-c000-000000000001', 'A-1'),
  ('00000000-0000-4000-d000-000000000002', '00000000-0000-4000-c000-000000000002', 'B-1'),
  ('00000000-0000-4000-d000-000000000003', '00000000-0000-4000-c000-000000000003', 'C-1');
insert into public.project_price_trends (id, project_id, month, price_per_sqft) values
  ('00000000-0000-4000-e200-000000000001', '00000000-0000-4000-c000-000000000001', '2026-10-01', 9000),
  ('00000000-0000-4000-e200-000000000002', '00000000-0000-4000-c000-000000000002', '2026-10-01', 9000);
insert into public.project_leads (id, project_id, kind, name, phone) values
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-c000-000000000001', 'enquiry', 'Matrix Lead One', '9841000011'),
  ('00000000-0000-4000-a000-000000000003', '00000000-0000-4000-c000-000000000003', 'enquiry', 'Matrix Lead Three', '9841000013');
insert into public.project_events (project_id, event_type, visitor_hash) values
  ('00000000-0000-4000-c000-000000000001', 'view', repeat('1', 40)),
  ('00000000-0000-4000-c000-000000000003', 'view', repeat('3', 40));

-- Forms, a CRM connection with a secret, a submission and a log line, a setting, and the service-only tables.
insert into public.forms (id, name, slug, kind, active) values
  ('00000000-0000-4000-f100-000000000001', 'Matrix form', 'matrix-form', 'contact', true),
  ('00000000-0000-4000-f100-000000000002', 'Matrix hidden form', 'matrix-hidden-form', 'contact', false);
insert into public.crm_integrations (id, name, base_url)
values ('00000000-0000-4000-f000-000000000001', 'Matrix CRM', 'https://crm.example.test');
insert into public.crm_integration_secrets (integration_id, api_key)
values ('00000000-0000-4000-f000-000000000001', 'not-a-real-key');
insert into public.form_submissions (id, form_name) values ('00000000-0000-4000-d100-000000000001', 'Matrix form');
insert into public.crm_api_logs (id, integration_name, outcome) values ('00000000-0000-4000-d200-000000000001', 'Matrix CRM', 'success');
insert into public.site_settings (key, value) values ('matrix_probe', '{"matrix": 1}');
insert into public.app_config (key, value) values ('matrix.probe', 'x');
insert into public.internal_cron_tokens (name, token) values ('matrix_probe', repeat('x', 40));
insert into public.idempotency_keys (scope, subject, key) values ('matrix_probe', 'x', gen_random_uuid());
insert into public.public_rate_limits (scope, subject_hash, window_start, hits) values ('matrix_probe', 'aaaaaaaaaaaaaaaa', now(), 1);

-- Layer 1: the privileges each role holds on each table (S select, I insert, U update, D delete, T truncate; select,
-- insert and update count when held on any column, as the column grants are).
create temp table exp_grants (t text primary key, anon text, authed text, service text);
insert into exp_grants values
  ('app_config', '', '', 'S,I,U,D'),
  ('audit_log', '', 'S', 'S'),
  ('builders', 'S', 'S,U', 'S,I,U,D'),
  ('crm_api_logs', '', 'S', 'S,I,U,D'),
  ('crm_integration_secrets', '', '', 'S,I,U,D'),
  ('crm_integrations', '', 'S,I,U,D', 'S,I,U,D'),
  ('enquiries', '', 'S,U', 'S,I,U,D'),
  ('form_submissions', '', 'S', 'S,I,U,D'),
  ('forms', 'S', 'S,I,U,D', 'S,I,U,D'),
  ('idempotency_keys', '', '', 'S,I,U,D'),
  ('internal_cron_tokens', '', '', 'S,I,U,D'),
  ('listing_media', 'S', 'S,U,D', 'S,I,U,D'),
  ('profiles', '', 'S,U', 'S,I,U,D'),
  ('project_events', '', 'S', 'S,I,U,D'),
  ('project_leads', '', 'S,U', 'S,I,U,D'),
  ('project_price_trends', 'S', 'S,I,U,D', 'S,I,U,D'),
  ('project_units', 'S', 'S,I,U,D', 'S,I,U,D'),
  ('projects', 'S', 'S,I,U,D', 'S,I,U,D'),
  ('properties', 'S', 'S,I,U,D', 'S,I,U,D'),
  ('public_rate_limits', '', '', 'S,I,U,D'),
  ('saved_properties', '', 'S,I,D', 'S,I,U,D'),
  ('site_settings', 'S', 'S,I,U', 'S,I,U,D'),
  ('user_roles', '', 'S,I,U,D', 'S,I,U,D');

create function pg_temp.privileges(who text, tbl text) returns text
language sql
as $$
  select concat_ws(',',
    case when has_any_column_privilege(who, c.oid, 'SELECT') then 'S' end,
    case when has_any_column_privilege(who, c.oid, 'INSERT') then 'I' end,
    case when has_any_column_privilege(who, c.oid, 'UPDATE') then 'U' end,
    case when has_table_privilege(who, c.oid, 'DELETE') then 'D' end,
    case when has_table_privilege(who, c.oid, 'TRUNCATE') then 'T' end)
  from pg_class as c
  where c.oid = ('public.' || tbl)::regclass
$$;

-- Layer 2: what each person can see. A probe is a fixture found by its own id; the expected list for a table is the
-- probes each of the seven people can see, in the order anon, A, B, builder A, builder B, builder C, admin.
create temp table probe (t text not null, label text not null, pred text not null);
insert into probe values
  ('properties', 'p1', 'id = ''{p1}'''), ('properties', 'p2', 'id = ''{p2}'''),
  ('properties', 'p3', 'id = ''{p3}'''), ('properties', 'p4', 'id = ''{p4}'''),
  ('listing_media', 'm1', 'id = ''{m1}'''), ('listing_media', 'm2', 'id = ''{m2}'''),
  ('enquiries', 'e1', 'id = ''{e1}'''), ('enquiries', 'e2', 'id = ''{e2}'''), ('enquiries', 'e3', 'id = ''{e3}'''),
  ('saved_properties', 's1', 'user_id = ''{uC1}'' and property_id = ''{p3}'''),
  ('saved_properties', 's2', 'user_id = ''{uC2}'' and property_id = ''{p1}'''),
  ('profiles', 'u1', 'id = ''{uC1}'''), ('profiles', 'u2', 'id = ''{uC2}'''), ('profiles', 'u3', 'id = ''{uB1}'''),
  ('user_roles', 'r1', 'user_id = ''{uC1}'' and role = ''customer'''),
  ('user_roles', 'r2', 'user_id = ''{uC2}'' and role = ''customer'''),
  ('user_roles', 'r3', 'user_id = ''{uB1}'' and role = ''builder'''),
  ('builders', 'g1', 'id = ''{BA}'''), ('builders', 'g2', 'id = ''{BB}'''), ('builders', 'g3', 'id = ''{BC}'''),
  ('projects', 'pr1', 'id = ''{pr1}'''), ('projects', 'pr2', 'id = ''{pr2}'''), ('projects', 'pr3', 'id = ''{pr3}'''),
  ('projects', 'pr4', 'id = ''{pr4}'''), ('projects', 'pr5', 'id = ''{pr5}'''),
  ('project_units', 'u1', 'id = ''{u1}'''), ('project_units', 'u2', 'id = ''{u2}'''), ('project_units', 'u3', 'id = ''{u3}'''),
  ('project_price_trends', 't1', 'id = ''{t1}'''), ('project_price_trends', 't2', 'id = ''{t2}'''),
  ('project_leads', 'l1', 'id = ''{l1}'''), ('project_leads', 'l3', 'id = ''{l3}'''),
  ('project_events', 'v1', 'project_id = ''{pr1}'''), ('project_events', 'v3', 'project_id = ''{pr3}'''),
  ('forms', 'f1', 'id = ''{f1}'''), ('forms', 'f2', 'id = ''{f2}'''),
  ('site_settings', 'k1', 'key = ''matrix_probe'''),
  ('form_submissions', 'x1', 'id = ''{fs1}'''), ('crm_api_logs', 'x1', 'id = ''{cl1}'''),
  ('crm_integrations', 'x1', 'id = ''{ci1}'''), ('crm_integration_secrets', 'x1', 'integration_id = ''{ci1}'''),
  ('audit_log', 'x1', 'action = ''builder.created'''),
  ('app_config', 'x1', 'key = ''matrix.probe'''), ('internal_cron_tokens', 'x1', 'name = ''matrix_probe'''),
  ('idempotency_keys', 'x1', 'scope = ''matrix_probe'''), ('public_rate_limits', 'x1', 'scope = ''matrix_probe''');

create function pg_temp.sees(who text, tbl text) returns text
language plpgsql
as $$
declare
  labels text[];
  preds text[];
  seen boolean;
  found_labels text[] := '{}';
begin
  select array_agg(label order by label), array_agg(pg_temp.fill(pred) order by label)
  into labels, preds from pg_temp.probe where t = tbl;
  perform pg_temp.become(who);
  for i in 1..coalesce(array_length(labels, 1), 0) loop
    begin
      execute format('select exists (select 1 from public.%I where %s)', tbl, preds[i]) into seen;
    exception when insufficient_privilege then
      seen := false;
    end;
    if seen then found_labels := found_labels || labels[i]; end if;
  end loop;
  perform pg_temp.become('postgres');
  return array_to_string(found_labels, ',');
end;
$$;

create temp table exp_vis (t text not null, who text not null, seen text not null);
insert into exp_vis
select x.t, r.who, x.by_who[r.n]
from (values
  ('properties', array['p1,p3', 'p1,p2,p3', 'p1,p3,p4', 'p1,p3', 'p1,p3', 'p1,p3', 'p1,p2,p3,p4']),
  ('listing_media', array['m1', 'm1,m2', 'm1', 'm1', 'm1', 'm1', 'm1,m2']),
  ('enquiries', array['', 'e1,e2', 'e1,e2,e3', 'e3', '', '', 'e1,e2,e3']),
  ('saved_properties', array['', 's1', 's2', '', '', '', 's1,s2']),
  ('profiles', array['', 'u1', 'u2', 'u3', '', '', 'u1,u2,u3']),
  ('user_roles', array['', 'r1', 'r2', 'r3', '', '', 'r1,r2,r3']),
  ('builders', array['g1,g2', 'g1,g2', 'g1,g2', 'g1,g2', 'g1,g2', 'g1,g2', 'g1,g2,g3']),
  ('projects', array['pr1,pr3', 'pr1,pr3', 'pr1,pr3', 'pr1,pr2,pr3', 'pr1,pr3,pr5', 'pr1,pr3', 'pr1,pr2,pr3,pr4,pr5']),
  ('project_units', array['u1,u3', 'u1,u3', 'u1,u3', 'u1,u2,u3', 'u1,u3', 'u1,u3', 'u1,u2,u3']),
  ('project_price_trends', array['t1', 't1', 't1', 't1,t2', 't1', 't1', 't1,t2']),
  ('project_leads', array['', '', '', 'l1', 'l3', '', 'l1,l3']),
  ('project_events', array['', '', '', 'v1', 'v3', '', 'v1,v3']),
  ('forms', array['f1', 'f1', 'f1', 'f1', 'f1', 'f1', 'f1,f2']),
  ('site_settings', array['k1', 'k1', 'k1', 'k1', 'k1', 'k1', 'k1']),
  ('form_submissions', array['', '', '', '', '', '', 'x1']),
  ('crm_api_logs', array['', '', '', '', '', '', 'x1']),
  ('crm_integrations', array['', '', '', '', '', '', 'x1']),
  ('audit_log', array['', '', '', '', '', '', 'x1']),
  ('crm_integration_secrets', array['', '', '', '', '', '', '']),
  ('app_config', array['', '', '', '', '', '', '']),
  ('internal_cron_tokens', array['', '', '', '', '', '', '']),
  ('idempotency_keys', array['', '', '', '', '', '', '']),
  ('public_rate_limits', array['', '', '', '', '', '', ''])
) as x(t, by_who)
cross join unnest(array['anon', 'ca', 'cb', 'ba', 'bb', 'bc', 'ad']) with ordinality as r(who, n);

-- Layer 3: what each person can write. The statement is run as that person and always undone; "yes" is a change to at
-- least one row, "no" is an error or no row changed (what the policy hid). The result is also in the test's name.
create function pg_temp.try(who text, stmt text) returns text
language plpgsql
as $$
declare
  changed bigint;
  code text;
  detail text;
begin
  -- The names are replaced first: the alias table is the test's own, and the person tried could not read it.
  stmt := pg_temp.fill(stmt);
  perform pg_temp.become(who);
  begin
    execute stmt;
    get diagnostics changed = row_count;
    raise exception 'undo' using errcode = 'P0001', detail = changed::text;
  exception when others then
    get stacked diagnostics code = returned_sqlstate, detail = pg_exception_detail;
    perform pg_temp.become('postgres');
    if code = 'P0001' and detail ~ '^[0-9]+$' then
      return case when detail::bigint > 0 then 'yes' else 'no:0 rows' end;
    end if;
    return 'no:' || code;
  end;
end;
$$;

create temp table exp_write (n serial, label text not null, who text not null, stmt text not null, expected text not null);
insert into exp_write (label, who, stmt, expected) values
  -- properties: only the owner changes or deletes a listing; the admin goes through moderation, not a direct edit
  ('properties: the owner edits their draft', 'ca', $q$update public.properties set title = 'Matrix edit' where id = '{p2}'$q$, 'yes'),
  ('properties: another customer edits it', 'cb', $q$update public.properties set title = 'Matrix edit' where id = '{p2}'$q$, 'no'),
  ('properties: a visitor edits it', 'anon', $q$update public.properties set title = 'Matrix edit' where id = '{p2}'$q$, 'no'),
  ('properties: the admin does not edit it directly', 'ad', $q$update public.properties set title = 'Matrix edit' where id = '{p2}'$q$, 'no'),
  ('properties: the owner deletes their draft', 'ca', $q$delete from public.properties where id = '{p2}'$q$, 'yes'),
  ('properties: another customer deletes it', 'cb', $q$delete from public.properties where id = '{p2}'$q$, 'no'),
  ('properties: a customer with a verified phone starts a draft', 'ca', $q$insert into public.properties (title) values ('Matrix draft')$q$, 'yes'),
  ('properties: a builder without a verified phone cannot', 'ba', $q$insert into public.properties (title) values ('Matrix draft')$q$, 'no'),
  ('properties: a visitor cannot start one', 'anon', $q$insert into public.properties (title) values ('Matrix draft')$q$, 'no'),
  ('properties: a customer cannot name the owner', 'ca', $q$insert into public.properties (owner_id, title) values ('{uC2}', 'Matrix draft')$q$, 'no'),
  -- listing_media: the owner edits and deletes their listing's photos; the admin may delete; nobody inserts from a client
  ('listing_media: the owner edits a photo of their listing', 'ca', $q$update public.listing_media set alt_text = 'Matrix' where id = '{m1}'$q$, 'yes'),
  ('listing_media: another customer edits it', 'cb', $q$update public.listing_media set alt_text = 'Matrix' where id = '{m1}'$q$, 'no'),
  ('listing_media: a visitor edits it', 'anon', $q$update public.listing_media set alt_text = 'Matrix' where id = '{m1}'$q$, 'no'),
  ('listing_media: the admin does not edit it', 'ad', $q$update public.listing_media set alt_text = 'Matrix' where id = '{m1}'$q$, 'no'),
  ('listing_media: the owner deletes a photo of their draft', 'ca', $q$delete from public.listing_media where id = '{m2}'$q$, 'yes'),
  ('listing_media: another customer deletes it', 'cb', $q$delete from public.listing_media where id = '{m2}'$q$, 'no'),
  ('listing_media: the admin deletes a photo', 'ad', $q$delete from public.listing_media where id = '{m1}'$q$, 'yes'),
  ('listing_media: nobody adds a photo from a client', 'ca', $q$insert into public.listing_media (listing_id, storage_path, mime, bytes, width, height) values ('{p2}', 'matrix/new.webp', 'image/webp', 1000, 1600, 1200)$q$, 'no'),
  -- enquiries: only the listing's owner moves one on; the sender, others and the admin do not; nobody inserts from a client
  ('enquiries: the listing owner moves an enquiry on', 'ca', $q$update public.enquiries set status = 'contacted' where id = '{e1}'$q$, 'yes'),
  ('enquiries: the sender cannot', 'cb', $q$update public.enquiries set status = 'contacted' where id = '{e1}'$q$, 'no'),
  ('enquiries: another signed-in person cannot', 'ba', $q$update public.enquiries set status = 'contacted' where id = '{e1}'$q$, 'no'),
  ('enquiries: the admin cannot', 'ad', $q$update public.enquiries set status = 'contacted' where id = '{e1}'$q$, 'no'),
  ('enquiries: a visitor cannot', 'anon', $q$update public.enquiries set status = 'contacted' where id = '{e1}'$q$, 'no'),
  ('enquiries: nobody sends one from a client', 'ca', $q$insert into public.enquiries (property_id, name, phone) values ('{p1}', 'Matrix', '9841000099')$q$, 'no'),
  -- saved_properties: a person keeps their own saves; a save needs a verified phone and a live listing
  ('saved_properties: a customer removes their own save', 'ca', $q$delete from public.saved_properties where property_id = '{p3}' and user_id = '{uC1}'$q$, 'yes'),
  ('saved_properties: another customer removes it', 'cb', $q$delete from public.saved_properties where property_id = '{p3}' and user_id = '{uC1}'$q$, 'no'),
  ('saved_properties: a visitor removes it', 'anon', $q$delete from public.saved_properties where property_id = '{p3}' and user_id = '{uC1}'$q$, 'no'),
  ('saved_properties: a customer saves a live listing', 'ca', $q$insert into public.saved_properties (property_id) values ('{p1}')$q$, 'yes'),
  ('saved_properties: without a verified phone, no', 'ba', $q$insert into public.saved_properties (property_id) values ('{p1}')$q$, 'no'),
  ('saved_properties: a listing that is not live, no', 'ca', $q$insert into public.saved_properties (property_id) values ('{p2}')$q$, 'no'),
  -- profiles: a person changes their own name only
  ('profiles: a customer changes their own name', 'ca', $q$update public.profiles set full_name = 'Matrix' where id = '{uC1}'$q$, 'yes'),
  ('profiles: another customer cannot', 'cb', $q$update public.profiles set full_name = 'Matrix' where id = '{uC1}'$q$, 'no'),
  ('profiles: a visitor cannot', 'anon', $q$update public.profiles set full_name = 'Matrix' where id = '{uC1}'$q$, 'no'),
  ('profiles: the admin cannot', 'ad', $q$update public.profiles set full_name = 'Matrix' where id = '{uC1}'$q$, 'no'),
  -- user_roles: only the admin grants a role, and never super_admin
  ('user_roles: the admin grants a role', 'ad', $q$insert into public.user_roles (user_id, role) values ('{uC1}', 'agent')$q$, 'yes'),
  ('user_roles: nobody grants super_admin', 'ad', $q$insert into public.user_roles (user_id, role) values ('{uC1}', 'super_admin')$q$, 'no'),
  ('user_roles: a customer cannot grant themselves a role', 'ca', $q$insert into public.user_roles (user_id, role) values ('{uC1}', 'agent')$q$, 'no'),
  ('user_roles: a customer cannot remove another person''s role', 'ca', $q$delete from public.user_roles where user_id = '{uC2}'$q$, 'no'),
  ('user_roles: a builder cannot remove their own role', 'ba', $q$delete from public.user_roles where user_id = '{uB1}' and role = 'builder'$q$, 'no'),
  -- site_settings: public to read, the admin alone writes
  ('site_settings: the admin changes a setting', 'ad', $q$update public.site_settings set value = '{"matrix": 2}' where key = 'matrix_probe'$q$, 'yes'),
  ('site_settings: a customer cannot', 'ca', $q$update public.site_settings set value = '{"matrix": 2}' where key = 'matrix_probe'$q$, 'no'),
  ('site_settings: a builder cannot', 'ba', $q$update public.site_settings set value = '{"matrix": 2}' where key = 'matrix_probe'$q$, 'no'),
  ('site_settings: a visitor cannot', 'anon', $q$update public.site_settings set value = '{"matrix": 2}' where key = 'matrix_probe'$q$, 'no'),
  ('site_settings: the admin adds a setting', 'ad', $q$insert into public.site_settings (key, value) values ('matrix_new', '{}')$q$, 'yes'),
  ('site_settings: a builder cannot add one', 'ba', $q$insert into public.site_settings (key, value) values ('matrix_new', '{}')$q$, 'no'),
  -- builders: an active builder edits their own record; the admin edits any; no one else
  ('builders: an active builder edits their own record', 'ba', $q$update public.builders set name = 'Builder A Ltd' where id = '{BA}'$q$, 'yes'),
  ('builders: another builder cannot', 'bb', $q$update public.builders set name = 'Builder A Ltd' where id = '{BA}'$q$, 'no'),
  ('builders: an inactive builder cannot even edit their own', 'bc', $q$update public.builders set name = 'Builder C Ltd' where id = '{BC}'$q$, 'no'),
  ('builders: a customer cannot', 'ca', $q$update public.builders set name = 'Builder A Ltd' where id = '{BA}'$q$, 'no'),
  ('builders: a visitor cannot', 'anon', $q$update public.builders set name = 'Builder A Ltd' where id = '{BA}'$q$, 'no'),
  ('builders: the admin edits a builder', 'ad', $q$update public.builders set name = 'Builder A Ltd' where id = '{BA}'$q$, 'yes'),
  -- projects: a builder works on their own; the admin on all; delete is the admin's; an inactive builder does nothing
  ('projects: a builder edits their own project', 'ba', $q$update public.projects set name = 'Matrix Edit' where id = '{pr1}'$q$, 'yes'),
  ('projects: another builder cannot', 'bb', $q$update public.projects set name = 'Matrix Edit' where id = '{pr1}'$q$, 'no'),
  ('projects: an inactive builder cannot edit their own', 'bc', $q$update public.projects set name = 'Matrix Edit' where id = '{pr4}'$q$, 'no'),
  ('projects: a customer cannot', 'ca', $q$update public.projects set name = 'Matrix Edit' where id = '{pr1}'$q$, 'no'),
  ('projects: a visitor cannot', 'anon', $q$update public.projects set name = 'Matrix Edit' where id = '{pr1}'$q$, 'no'),
  ('projects: the admin edits a project', 'ad', $q$update public.projects set name = 'Matrix Edit' where id = '{pr1}'$q$, 'yes'),
  ('projects: a builder cannot delete their own', 'ba', $q$delete from public.projects where id = '{pr2}'$q$, 'no'),
  ('projects: the admin deletes a project', 'ad', $q$delete from public.projects where id = '{pr2}'$q$, 'yes'),
  ('projects: a builder adds a project of their own', 'ba', $q$insert into public.projects (slug, name) values ('matrix-new', 'Matrix New')$q$, 'yes'),
  ('projects: an inactive builder cannot add one', 'bc', $q$insert into public.projects (slug, name) values ('matrix-new', 'Matrix New')$q$, 'no'),
  ('projects: a customer cannot add one', 'ca', $q$insert into public.projects (slug, name) values ('matrix-new', 'Matrix New')$q$, 'no'),
  ('projects: a builder cannot add one for another builder', 'bb', $q$insert into public.projects (slug, name, builder_id) values ('matrix-new', 'Matrix New', '{BA}')$q$, 'no'),
  -- project_units: a builder works on the units of their own projects only
  ('project_units: a builder edits a unit of their own project', 'ba', $q$update public.project_units set floor_number = 2 where id = '{u1}'$q$, 'yes'),
  ('project_units: another builder cannot', 'bb', $q$update public.project_units set floor_number = 2 where id = '{u1}'$q$, 'no'),
  ('project_units: an inactive builder cannot', 'bc', $q$update public.project_units set floor_number = 2 where id = '{u1}'$q$, 'no'),
  ('project_units: a customer cannot', 'ca', $q$update public.project_units set floor_number = 2 where id = '{u1}'$q$, 'no'),
  ('project_units: a visitor cannot', 'anon', $q$update public.project_units set floor_number = 2 where id = '{u1}'$q$, 'no'),
  ('project_units: a builder adds a unit to their own project', 'ba', $q$insert into public.project_units (project_id, unit_number) values ('{pr1}', 'Z-9')$q$, 'yes'),
  ('project_units: another builder cannot add one', 'bb', $q$insert into public.project_units (project_id, unit_number) values ('{pr1}', 'Z-9')$q$, 'no'),
  ('project_units: a builder deletes a unit of their own project', 'ba', $q$delete from public.project_units where id = '{u1}'$q$, 'yes'),
  ('project_units: a builder cannot delete another builder''s unit', 'ba', $q$delete from public.project_units where id = '{u3}'$q$, 'no'),
  -- project_price_trends: the admin alone writes (a builder saves through a function)
  ('project_price_trends: a builder cannot edit a trend directly', 'ba', $q$update public.project_price_trends set price_per_sqft = 9100 where id = '{t1}'$q$, 'no'),
  ('project_price_trends: the admin edits a trend', 'ad', $q$update public.project_price_trends set price_per_sqft = 9100 where id = '{t1}'$q$, 'yes'),
  ('project_price_trends: a builder cannot add one', 'ba', $q$insert into public.project_price_trends (project_id, month, price_per_sqft) values ('{pr1}', '2026-09-01', 9000)$q$, 'no'),
  ('project_price_trends: the admin adds one', 'ad', $q$insert into public.project_price_trends (project_id, month, price_per_sqft) values ('{pr1}', '2026-09-01', 9000)$q$, 'yes'),
  ('project_price_trends: a builder cannot delete one', 'ba', $q$delete from public.project_price_trends where id = '{t1}'$q$, 'no'),
  ('project_price_trends: the admin deletes one', 'ad', $q$delete from public.project_price_trends where id = '{t2}'$q$, 'yes'),
  -- project_leads: the builder (or the admin) changes the status of their own project's leads, and nothing else about them
  ('project_leads: a builder moves a lead of their project on', 'ba', $q$update public.project_leads set status = 'contacted' where id = '{l1}'$q$, 'yes'),
  ('project_leads: another builder cannot', 'bb', $q$update public.project_leads set status = 'contacted' where id = '{l1}'$q$, 'no'),
  ('project_leads: an inactive builder cannot', 'bc', $q$update public.project_leads set status = 'contacted' where id = '{l1}'$q$, 'no'),
  ('project_leads: a customer cannot', 'ca', $q$update public.project_leads set status = 'contacted' where id = '{l1}'$q$, 'no'),
  ('project_leads: a visitor cannot', 'anon', $q$update public.project_leads set status = 'contacted' where id = '{l1}'$q$, 'no'),
  ('project_leads: the admin moves a lead on', 'ad', $q$update public.project_leads set status = 'contacted' where id = '{l1}'$q$, 'yes'),
  ('project_leads: a builder cannot change a lead''s name', 'ba', $q$update public.project_leads set name = 'Matrix' where id = '{l1}'$q$, 'no'),
  -- project_events: written by the server only
  ('project_events: the admin cannot edit one', 'ad', $q$update public.project_events set event_type = 'view' where project_id = '{pr1}'$q$, 'no'),
  ('project_events: a builder cannot delete one', 'ba', $q$delete from public.project_events where project_id = '{pr1}'$q$, 'no'),
  ('project_events: a customer cannot add one', 'ca', $q$insert into public.project_events (project_id, event_type) values ('{pr1}', 'view')$q$, 'no'),
  ('project_events: a visitor cannot add one', 'anon', $q$insert into public.project_events (project_id, event_type) values ('{pr1}', 'view')$q$, 'no'),
  -- forms: the admin alone writes
  ('forms: the admin adds a form', 'ad', $q$insert into public.forms (name, slug, kind) values ('Matrix new form', 'matrix-new-form', 'contact')$q$, 'yes'),
  ('forms: a customer cannot add one', 'ca', $q$insert into public.forms (name, slug, kind) values ('Matrix new form', 'matrix-new-form', 'contact')$q$, 'no'),
  ('forms: a builder cannot add one', 'ba', $q$insert into public.forms (name, slug, kind) values ('Matrix new form', 'matrix-new-form', 'contact')$q$, 'no'),
  ('forms: a visitor cannot add one', 'anon', $q$insert into public.forms (name, slug, kind) values ('Matrix new form', 'matrix-new-form', 'contact')$q$, 'no'),
  ('forms: the admin edits a form', 'ad', $q$update public.forms set name = 'Matrix form two' where id = '{f1}'$q$, 'yes'),
  ('forms: a customer cannot edit one', 'ca', $q$update public.forms set name = 'Matrix form two' where id = '{f1}'$q$, 'no'),
  ('forms: the admin deletes a form', 'ad', $q$delete from public.forms where id = '{f2}'$q$, 'yes'),
  ('forms: a customer cannot delete one', 'ca', $q$delete from public.forms where id = '{f2}'$q$, 'no'),
  -- crm_integrations: the admin alone, and never through a table the admin has no grant on
  ('crm_integrations: the admin edits a connection', 'ad', $q$update public.crm_integrations set name = 'Matrix CRM two' where id = '{ci1}'$q$, 'yes'),
  ('crm_integrations: a builder cannot', 'ba', $q$update public.crm_integrations set name = 'Matrix CRM two' where id = '{ci1}'$q$, 'no'),
  ('crm_integrations: a customer cannot', 'ca', $q$update public.crm_integrations set name = 'Matrix CRM two' where id = '{ci1}'$q$, 'no'),
  ('crm_integrations: the admin adds a connection', 'ad', $q$insert into public.crm_integrations (name, base_url) values ('Matrix CRM new', 'https://crm-new.example.test')$q$, 'yes'),
  ('crm_integrations: a builder cannot add one', 'ba', $q$insert into public.crm_integrations (name, base_url) values ('Matrix CRM new', 'https://crm-new.example.test')$q$, 'no'),
  ('crm_integrations: the admin deletes a connection', 'ad', $q$delete from public.crm_integrations where id = '{ci1}'$q$, 'yes'),
  ('crm_integrations: a builder cannot delete one', 'ba', $q$delete from public.crm_integrations where id = '{ci1}'$q$, 'no'),
  -- tables only the server writes: not even the admin, through a client
  ('form_submissions: the admin cannot delete a submission', 'ad', $q$delete from public.form_submissions$q$, 'no'),
  ('crm_api_logs: the admin cannot change a log line', 'ad', $q$update public.crm_api_logs set outcome = 'failed'$q$, 'no'),
  ('audit_log: the admin cannot delete an entry', 'ad', $q$delete from public.audit_log$q$, 'no'),
  ('crm_integration_secrets: the admin cannot read them to change them', 'ad', $q$update public.crm_integration_secrets set api_key = 'x'$q$, 'no');

select plan((
  (select count(*) from exp_grants) * 3
  + 1
  + (select count(*) from exp_vis)
  + (select count(*) from exp_write)
)::int);

-- Layer 1
select is(
  pg_temp.privileges(c.who, c.t),
  c.expected,
  'privileges: ' || c.who || ' on ' || c.t
)
from (
  select g.t, r.who,
         case r.who when 'anon' then g.anon when 'authenticated' then g.authed else g.service end as expected
  from exp_grants as g
  cross join (values ('anon'), ('authenticated'), ('service_role')) as r(who)
  order by g.t, r.who
  offset 0
) as c;

-- Every public table is in the matrix, and the matrix names no table that is not there.
select is(
  (select coalesce(string_agg(name, ', ' order by name), '') from (
     (select tablename::text as name from pg_tables where schemaname = 'public'
      except select t from exp_grants)
     union all
     (select t from exp_grants
      except select tablename::text from pg_tables where schemaname = 'public')
   ) as different),
  '',
  'inventory: every public table has a row in the matrix, and no row names a table that is gone'
);

-- Layer 2
select is(
  pg_temp.sees(e.who, e.t),
  e.seen,
  'sees: ' || e.who || ' reads ' || e.t || ' [' || e.seen || ']'
)
from (
  select t, who, seen from exp_vis
  order by t, array_position(array['anon', 'ca', 'cb', 'ba', 'bb', 'bc', 'ad'], who)
  offset 0
) as e;

-- Layer 3
select is(
  case when w.result like 'no%' then 'no' else w.result end,
  w.expected,
  w.label || ' [' || w.who || ': ' || w.result || ']'
)
from (
  select n, label, who, expected, pg_temp.try(who, stmt) as result
  from (select * from exp_write order by n offset 0) as ordered
  offset 0
) as w;

select * from finish();
rollback;

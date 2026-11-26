-- Recommended agents (26 Nov 2026). Tests: DB-FN-public-agents, DB-FN-agent-contact.
-- public_agents() gives visitors only safe fields of active agents (never the phone or the email), counts live homes and
-- projects, lists the commonest localities, leaves builders and agents with nothing live off the home list, and agent_contact()
-- gives the phone only to a signed-in caller with a verified phone. Fictional data only.
begin;
select plan(10);

insert into auth.users (id, email, email_confirmed_at, phone, phone_confirmed_at) values
  ('00000000-0000-4000-8000-0000000000e1', 'agent1@example.test', now(), '919100000011', now()),
  ('00000000-0000-4000-8000-0000000000e2', 'agent2@example.test', now(), null, null),
  ('00000000-0000-4000-8000-0000000000e3', 'builder3@example.test', now(), null, null);
insert into public.user_roles (user_id, role) values
  ('00000000-0000-4000-8000-0000000000e1', 'builder'),
  ('00000000-0000-4000-8000-0000000000e2', 'builder'),
  ('00000000-0000-4000-8000-0000000000e3', 'builder');
insert into public.builders (id, user_id, email, name, phone, kind, established_year) values
  ('00000000-0000-4000-b000-0000000000e1', '00000000-0000-4000-8000-0000000000e1', 'agent1@example.test', 'Meena Realty', '+919100000011', 'agent', 2012),
  ('00000000-0000-4000-b000-0000000000e2', '00000000-0000-4000-8000-0000000000e2', 'agent2@example.test', 'Quiet Agent', '+919100000012', 'agent', null),
  ('00000000-0000-4000-b000-0000000000e3', '00000000-0000-4000-8000-0000000000e3', 'builder3@example.test', 'Plain Builder', '+919100000013', 'builder', null);

-- Agent 1 owns two approved homes in Adyar and one draft.
insert into public.properties (
  id, short_id, owner_id, status, listing_type, property_type, bhk, title, description, price, area_sqft,
  locality, city, state, pincode, address, location, published_at
)
select ('00000000-0000-4000-9000-00000000e00' || n::text)::uuid, 'agentaa' || (n + 1)::text, '00000000-0000-4000-8000-0000000000e1',
  case when n = 3 then 'draft' else 'approved' end, 'sale', 'apartment', 2, 'Agent home number ' || n,
  'A bright two bedroom flat.', 8500000, 950, 'Adyar', 'Chennai', 'Tamil Nadu', '600020', '12 Beach Road',
  extensions.st_setsrid(extensions.st_makepoint(80.2707, 13.0827), 4326)::extensions.geography, now()
from generate_series(1, 3) as n;

select is(
  (select jsonb_array_length(public.public_agents())),
  1,
  'the home list holds only the agent with something live (not the quiet agent, not the builder)'
);

set local role anon;
select is(
  (select (public.public_agents() -> 0 ->> 'listing_count')::integer),
  2,
  'only approved homes are counted, a draft is not'
);
select is(
  (select public.public_agents() -> 0 -> 'localities' ->> 0),
  'Adyar',
  'the agent''s commonest locality is listed'
);
select is(
  (select public.public_agents() -> 0 ->> 'established_year'),
  '2012',
  'the year started is public'
);
select ok(
  not (public.public_agents() -> 0) ? 'phone' and not (public.public_agents() -> 0) ? 'email',
  'no phone and no email in what a visitor reads'
);
select is(
  (select jsonb_array_length(public.public_agents('00000000-0000-4000-b000-0000000000e2'))),
  1,
  'an agent with nothing live still has a page'
);
select is(
  (select jsonb_array_length(public.public_agents('00000000-0000-4000-b000-0000000000e3'))),
  0,
  'a builder is not an agent: no page'
);
select throws_ok(
  $$select public.agent_contact('00000000-0000-4000-b000-0000000000e1')$$,
  '42501', null, 'a visitor cannot ask for the phone'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e2","role":"authenticated"}', true);
select throws_ok(
  $$select public.agent_contact('00000000-0000-4000-b000-0000000000e1')$$,
  '42501', null, 'a signed-in caller with no verified phone cannot ask for the phone'
);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated","phone":"919100000011"}', true);
select is(
  public.agent_contact('00000000-0000-4000-b000-0000000000e1'),
  '+919100000011',
  'a signed-in caller with a verified phone gets the agent''s phone'
);

select * from finish();
rollback;

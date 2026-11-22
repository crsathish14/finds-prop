-- Change request plan 6: builder and agent feedback. Tests: DB-FN-builder_feedback, DB-PRIV-builder_feedback,
-- DB-AUDIT-builder_feedback.
begin;
select plan(15);

-- ad is the reserved admin; b1 is a builder, a1 an agent; c1 is a customer.
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000000ad', 'support@drizzlemarketings.com', now()),
  ('00000000-0000-4000-8000-0000000000b1', 'sales@kadalhomes.example', now()),
  ('00000000-0000-4000-8000-0000000000a1', 'hello@nilahabitats.example', now());
insert into auth.users (id, phone, phone_confirmed_at) values
  ('00000000-0000-4000-8000-0000000000c1', '919100000001', now());
insert into public.user_roles (user_id, role) values
  ('00000000-0000-4000-8000-0000000000b1', 'builder'),
  ('00000000-0000-4000-8000-0000000000a1', 'builder');
insert into public.builders (id, user_id, email, name, kind) values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-8000-0000000000b1', 'sales@kadalhomes.example', 'Kadal Homes', 'builder'),
  ('00000000-0000-4000-b000-000000000002', '00000000-0000-4000-8000-0000000000a1', 'hello@nilahabitats.example', 'Nila Habitats', 'agent');

-- A builder sends a message; the sender is themselves
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000b1", "role": "authenticated"}', true);
select lives_ok(
  $$select public.submit_builder_feedback('  The unit table is slow to load.  ')$$,
  'a builder can send feedback'
);
select throws_ok(
  $$select public.submit_builder_feedback('   ')$$, '23514', 'feedback.invalid_message', 'an empty message is refused'
);
select throws_ok(
  $$select public.submit_builder_feedback(repeat('a', 1001))$$, '23514', 'feedback.invalid_message',
  'a message over 1000 characters is refused'
);
select throws_ok(
  $$select * from public.builder_feedback$$, '42501', null, 'a builder cannot read the table, not even their own message'
);
select is(
  (select count(*)::int from public.admin_feedback_list()), 0, 'a builder gets no rows from the admin list'
);

-- An agent sends one too
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000a1", "role": "authenticated"}', true);
select lives_ok($$select public.submit_builder_feedback('Please add a filter.')$$, 'an agent can send feedback');

-- A customer cannot
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000c1", "role": "authenticated", "phone": "919100000001"}', true);
select throws_ok(
  $$select public.submit_builder_feedback('Hello')$$, '42501', 'feedback.not_allowed', 'a customer cannot send feedback'
);
select throws_ok(
  $$select public.admin_set_feedback_reviewed('00000000-0000-4000-0000-000000000000', true)$$, '42501',
  'feedback.not_allowed', 'a customer cannot mark feedback'
);

-- The super admin reads everything, with who and what role
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000ad", "role": "authenticated"}', true);
select results_eq(
  $$select builder_name, builder_kind, message, reviewed_at is null, total_count::int
    from public.admin_feedback_list('all') order by builder_name desc$$,
  $$values ('Nila Habitats'::text, 'agent'::text, 'Please add a filter.'::text, true, 2),
           ('Kadal Homes'::text, 'builder'::text, 'The unit table is slow to load.'::text, true, 2)$$,
  'the super admin sees both messages with the sender and their role'
);
select results_eq(
  $$select total::int, not_reviewed::int from public.admin_feedback_counts()$$, $$values (2, 2)$$,
  'the counts show two, both not reviewed'
);
select is(
  public.admin_set_feedback_reviewed((select id from public.admin_feedback_list('all') where message like 'Please%'), true),
  true, 'the super admin can mark a message reviewed'
);
select results_eq(
  $$select message from public.admin_feedback_list('open')$$, $$values ('The unit table is slow to load.'::text)$$,
  'the not-reviewed filter leaves the reviewed one out'
);
select results_eq(
  $$select message from public.admin_feedback_list('reviewed')$$, $$values ('Please add a filter.'::text)$$,
  'the reviewed filter shows only it'
);
select is(
  public.admin_set_feedback_reviewed('00000000-0000-4000-0000-000000000000', true), false,
  'an unknown message is reported as not found'
);
reset role;

set local role anon;
select throws_ok(
  $$select public.submit_builder_feedback('Hello')$$, '42501', null, 'a visitor cannot call it (no execute grant)'
);
reset role;

select * from finish();
rollback;

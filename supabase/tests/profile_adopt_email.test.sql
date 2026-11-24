-- One address, not two (ADR-196): a confirmed account email becomes the private contact email when there is none.
-- Tests: DB-FN-adopt_verified_email_as_contact, DB-PRIV-adopt_verified_email_as_contact.
-- Fictional data only.
--   d1 confirmed email, no contact email.  d2 email not confirmed.  d3 confirmed email and a contact email of
--   their own choosing.  d4 phone only.  d5 a confirmed reserved admin address.  d6 another person, untouched.
--   d7 a confirmed email with capitals and spaces around it.
begin;
select plan(17);

insert into auth.users (id, phone, phone_confirmed_at, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000000d1', '919100000021', now(), 'first@example.test', now()),
  ('00000000-0000-4000-8000-0000000000d2', '919100000022', now(), 'second@example.test', null),
  ('00000000-0000-4000-8000-0000000000d3', '919100000023', now(), 'third@example.test', now()),
  ('00000000-0000-4000-8000-0000000000d4', '919100000024', now(), null, null),
  ('00000000-0000-4000-8000-0000000000d6', '919100000026', now(), 'sixth@example.test', now()),
  ('00000000-0000-4000-8000-0000000000d7', '919100000027', now(), '  Seventh@Example.Test ', now());
insert into auth.users (id, phone, phone_confirmed_at, email, email_confirmed_at)
values ('00000000-0000-4000-8000-0000000000d5', '919100000025', now(), 'support@drizzlemarketings.com', now());

update public.profiles set contact_email = 'chosen@example.test'
  where id = '00000000-0000-4000-8000-0000000000d3';

select ok(
  not has_function_privilege('anon', 'public.adopt_verified_email_as_contact()', 'execute'),
  'DB-PRIV-adopt_verified_email_as_contact: a visitor cannot run it'
);
select ok(
  has_function_privilege('authenticated', 'public.adopt_verified_email_as_contact()', 'execute'),
  'DB-PRIV-adopt_verified_email_as_contact: a signed-in person can run it'
);

-- d1: confirmed, no contact email: copied
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000d1", "role": "authenticated", "phone": "919100000021"}',
  true
);
select is((select public.adopt_verified_email_as_contact()), true, 'a confirmed email is copied when there is none');
select is(
  (select contact_email from public.profiles where id = '00000000-0000-4000-8000-0000000000d1'),
  'first@example.test',
  'the contact email is now the confirmed address'
);
select is(
  (select public.adopt_verified_email_as_contact()), false,
  'a second call does nothing: the address is already there'
);

-- d2: not confirmed: nothing
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000d2", "role": "authenticated", "phone": "919100000022"}',
  true
);
select is((select public.adopt_verified_email_as_contact()), false, 'an email that is not confirmed is not copied');
select is(
  (select contact_email from public.profiles where id = '00000000-0000-4000-8000-0000000000d2'),
  null,
  'and the contact email stays empty'
);

-- d3: has a contact email of their own: never overwritten
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000d3", "role": "authenticated", "phone": "919100000023"}',
  true
);
select is((select public.adopt_verified_email_as_contact()), false, 'a contact email the person chose is left alone');
select is(
  (select contact_email from public.profiles where id = '00000000-0000-4000-8000-0000000000d3'),
  'chosen@example.test',
  'and it is not overwritten'
);

-- d4: phone only, no email at all
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000d4", "role": "authenticated", "phone": "919100000024"}',
  true
);
select is((select public.adopt_verified_email_as_contact()), false, 'an account with no email copies nothing');

-- d5: a reserved admin address is never taken
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000d5", "role": "authenticated", "phone": "919100000025"}',
  true
);
select is((select public.adopt_verified_email_as_contact()), false, 'a reserved admin address is not copied');
select is(
  (select contact_email from public.profiles where id = '00000000-0000-4000-8000-0000000000d5'),
  null,
  'and the contact email stays empty for it'
);

-- d7: cleaned like set_contact_email does
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000d7", "role": "authenticated", "phone": "919100000027"}',
  true
);
select is((select public.adopt_verified_email_as_contact()), true, 'the address is trimmed and lower-cased');
select is(
  (select contact_email from public.profiles where id = '00000000-0000-4000-8000-0000000000d7'),
  'seventh@example.test',
  'as it is stored'
);

-- The phone rule is the same as for every owner write
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-0000000000d6", "role": "authenticated"}', true);
select throws_ok(
  $$select public.adopt_verified_email_as_contact()$$,
  '42501', 'profile.not_allowed',
  'an account with no verified phone is refused'
);
reset role;

-- Nobody else's row moved
select is(
  (select contact_email from public.profiles where id = '00000000-0000-4000-8000-0000000000d6'),
  null,
  'another person''s contact email is untouched'
);

set local role anon;
select throws_ok(
  $$select public.adopt_verified_email_as_contact()$$,
  '42501', null,
  'a visitor cannot call it'
);

select * from finish();
rollback;

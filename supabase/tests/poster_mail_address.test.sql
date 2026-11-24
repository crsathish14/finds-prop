-- Where the poster mail of a home goes (ADR-198). Tests: DB-FN-poster_mail_address, DB-PRIV-poster_mail_address.
-- The contact email wins; with none, the confirmed account email is used; an unconfirmed, empty, reserved or missing
-- one gives nothing; only the service role may ask. Fictional data only.
--   p1 contact email and a confirmed email.  p2 confirmed email only.  p3 unconfirmed email only.  p4 phone only.
--   p5 a confirmed reserved admin address.  p6 a confirmed email with capitals and spaces.
begin;
select plan(12);

insert into auth.users (id, phone, phone_confirmed_at, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000000f1', '919100000031', now(), 'account-one@example.test', now()),
  ('00000000-0000-4000-8000-0000000000f2', '919100000032', now(), 'account-two@example.test', now()),
  ('00000000-0000-4000-8000-0000000000f3', '919100000033', now(), 'account-three@example.test', null),
  ('00000000-0000-4000-8000-0000000000f4', '919100000034', now(), null, null),
  ('00000000-0000-4000-8000-0000000000f6', '919100000036', now(), '  Account-Six@Example.Test ', now());
insert into auth.users (id, phone, phone_confirmed_at, email, email_confirmed_at)
values ('00000000-0000-4000-8000-0000000000f5', '919100000035', now(), 'support@drizzlemarketings.com', now());

update public.profiles set contact_email = 'chosen@example.test'
  where id = '00000000-0000-4000-8000-0000000000f1';

select is(
  (select public.poster_mail_address('00000000-0000-4000-8000-0000000000f1')),
  'chosen@example.test',
  'the contact email wins over a confirmed account email'
);
select is(
  (select public.poster_mail_address('00000000-0000-4000-8000-0000000000f2')),
  'account-two@example.test',
  'with no contact email the confirmed account email is used'
);
select is(
  (select public.poster_mail_address('00000000-0000-4000-8000-0000000000f3')),
  null,
  'an account email that is not confirmed is never used'
);
select is(
  (select public.poster_mail_address('00000000-0000-4000-8000-0000000000f4')),
  null,
  'a phone-only account has no address'
);
select is(
  (select public.poster_mail_address('00000000-0000-4000-8000-0000000000f5')),
  null,
  'a reserved admin address is never used'
);
select is(
  (select public.poster_mail_address('00000000-0000-4000-8000-0000000000f6')),
  'account-six@example.test',
  'the account email is trimmed and lower-cased'
);
select is(
  (select public.poster_mail_address('00000000-0000-4000-8000-0000000000ee')),
  null,
  'a person who does not exist has no address'
);

-- Only the server may ask
select ok(
  has_function_privilege('service_role', 'public.poster_mail_address(uuid)', 'execute'),
  'DB-PRIV-poster_mail_address: the service role can run it'
);
select ok(
  not has_function_privilege('authenticated', 'public.poster_mail_address(uuid)', 'execute'),
  'DB-PRIV-poster_mail_address: a signed-in person cannot run it'
);
select ok(
  not has_function_privilege('anon', 'public.poster_mail_address(uuid)', 'execute'),
  'DB-PRIV-poster_mail_address: a visitor cannot run it'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000f2", "role": "authenticated", "phone": "919100000032"}',
  true
);
select throws_ok(
  $$select public.poster_mail_address('00000000-0000-4000-8000-0000000000f1')$$,
  '42501', null,
  'a signed-in person cannot read anyone''s address through it'
);
reset role;
set local role anon;
select throws_ok(
  $$select public.poster_mail_address('00000000-0000-4000-8000-0000000000f2')$$,
  '42501', null,
  'a visitor cannot read anyone''s address through it'
);

select * from finish();
rollback;

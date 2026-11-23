-- The poster's private contact email (ADR-184, enquiry email plan PR 2).
-- Tests: DB-COL-profiles-contact_email, DB-FN-set_contact_email, DB-RLS-profiles-contact_email, DB-PRIV-set_contact_email.
-- A person sets and reads their own address through set_contact_email() only; nobody else can read or write it,
-- a visitor can do neither, the super admin can read it, and the format, the length and the reserved admin
-- addresses are refused. Fictional data only.
--   u1 = ...0001 and u2 = ...0002 sign in by phone, ne = ...0003 has no phone claim in the token, ad = the admin.
begin;
select plan(29);

insert into auth.users (id, phone, phone_confirmed_at) values
  ('00000000-0000-4000-8000-000000000001', '919100000001', now()),
  ('00000000-0000-4000-8000-000000000002', '919100000002', now()),
  ('00000000-0000-4000-8000-000000000003', '919100000003', now());
insert into auth.users (id, email, email_confirmed_at)
values ('00000000-0000-4000-8000-0000000000ad', 'support@drizzlemarketings.com', now());

-- The column and the function
select has_column('public', 'profiles', 'contact_email', 'profiles has a contact_email column');
select col_is_null('public', 'profiles', 'contact_email', 'the contact email may be empty');
select is(
  (select count(*) from public.profiles where contact_email is not null)::int,
  0,
  'a new account has no contact email'
);
select ok(
  not has_function_privilege('anon', 'public.set_contact_email(text)', 'execute'),
  'DB-PRIV-set_contact_email: a visitor cannot run set_contact_email'
);
select ok(
  has_function_privilege('authenticated', 'public.set_contact_email(text)', 'execute'),
  'DB-PRIV-set_contact_email: a signed-in person can run set_contact_email'
);
select ok(
  not has_column_privilege('authenticated', 'public.profiles', 'contact_email', 'update'),
  'DB-COL-profiles-contact_email: a signed-in person has no update grant on the column'
);
select ok(
  has_column_privilege('authenticated', 'public.profiles', 'contact_email', 'select'),
  'a signed-in person can select the column (their own row, by policy)'
);
select ok(
  not has_column_privilege('anon', 'public.profiles', 'contact_email', 'select'),
  'a visitor has no select grant on the column'
);

-- The check on the column itself (the system role goes past the function)
select throws_ok(
  $$update public.profiles set contact_email = 'Upper@example.test' where id = '00000000-0000-4000-8000-000000000001'$$,
  '23514', null, 'a stored address must be lower case'
);
select throws_ok(
  $$update public.profiles set contact_email = 'no-at-sign.example.test' where id = '00000000-0000-4000-8000-000000000001'$$,
  '23514', null, 'a stored address must hold an @ and a dot after it'
);
select throws_ok(
  $$update public.profiles set contact_email = repeat('a', 250) || '@b.test' where id = '00000000-0000-4000-8000-000000000001'$$,
  '23514', null, 'a stored address is at most 254 characters'
);

-- u1 sets their own address
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-000000000001", "role": "authenticated", "phone": "919100000001"}',
  true
);
set local role authenticated;
select is(
  public.set_contact_email('  Owner.One@Example.Test '),
  'owner.one@example.test',
  'DB-FN-set_contact_email: the address is trimmed, lower-cased and answered'
);
select is(
  (select contact_email from public.profiles where id = '00000000-0000-4000-8000-000000000001'),
  'owner.one@example.test',
  'DB-RLS-profiles-contact_email: a person reads their own address'
);
select throws_ok(
  $$update public.profiles set contact_email = 'direct@example.test' where id = '00000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'a person cannot write the column with an update'
);
select throws_ok(
  $$select public.set_contact_email('not an address')$$,
  '22023', 'profile.contact_email_invalid', 'a value that is not an address is refused'
);
select throws_ok(
  $$select public.set_contact_email('two@@example.test')$$,
  '22023', 'profile.contact_email_invalid', 'an address with two @ signs is refused'
);
select throws_ok(
  $$select public.set_contact_email(repeat('a', 250) || '@b.test')$$,
  '22023', 'profile.contact_email_invalid', 'an address longer than 254 characters is refused'
);
select throws_ok(
  $$select public.set_contact_email('Developer@Findsprop.com')$$,
  '22023', 'profile.contact_email_reserved', 'a reserved admin address is refused, whatever its case'
);
select is(
  (select contact_email from public.profiles where id = '00000000-0000-4000-8000-000000000001'),
  'owner.one@example.test',
  'a refused value leaves the stored address as it was'
);
reset role;

-- u2 cannot read or change u1's address, and has their own
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-000000000002", "role": "authenticated", "phone": "919100000002"}',
  true
);
set local role authenticated;
select is(
  (select count(*) from public.profiles where id = '00000000-0000-4000-8000-000000000001')::int,
  0,
  'DB-RLS-profiles-contact_email: another person cannot read it'
);
select is(
  (select count(*) from public.profiles where contact_email is not null)::int,
  0,
  'another person finds no address by searching for one'
);
select is(
  public.set_contact_email('owner.two@example.test'),
  'owner.two@example.test',
  'the second person sets their own address'
);
reset role;
select is(
  (select contact_email from public.profiles where id = '00000000-0000-4000-8000-000000000001'),
  'owner.one@example.test',
  'setting one''s own address never changes another person''s'
);

-- A token with no verified phone cannot write
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-000000000003", "role": "authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select public.set_contact_email('nophone@example.test')$$,
  '42501', 'profile.not_allowed', 'a session with no verified phone cannot set an address'
);
reset role;

-- u1 clears it with an empty value
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-000000000001", "role": "authenticated", "phone": "919100000001"}',
  true
);
set local role authenticated;
select is(
  public.set_contact_email('   '),
  null,
  'an empty value clears the address and answers nothing'
);
reset role;
select is(
  (select contact_email from public.profiles where id = '00000000-0000-4000-8000-000000000001'),
  null,
  'the address is empty after clearing'
);

-- The admin reads every address
select set_config(
  'request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000ad", "role": "authenticated"}',
  true
);
set local role authenticated;
select is(
  (select contact_email from public.profiles where id = '00000000-0000-4000-8000-000000000002'),
  'owner.two@example.test',
  'DB-RLS-profiles-contact_email: the admin can read a person''s address'
);
reset role;

-- A visitor can do neither
set local role anon;
select throws_ok(
  $$select contact_email from public.profiles$$,
  '42501', null, 'a visitor cannot read the column'
);
select throws_ok(
  $$select public.set_contact_email('visitor@example.test')$$,
  '42501', null, 'a visitor cannot run set_contact_email'
);
reset role;

select * from finish();
rollback;

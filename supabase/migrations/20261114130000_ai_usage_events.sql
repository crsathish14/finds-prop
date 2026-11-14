-- AI chat P4-T05 (ADR-128 section 8, decision D8 option A): one row of usage metadata per customer message.
-- Facts about the call, never what was said: no message text, no phone, no email, no name, no search words.
-- Only the server writes and reads it (service role); RLS is on and no client role holds any privilege, the same as
-- public_rate_limits. `user_id` is set only for a signed-in caller and `visitor_hash` only for an anonymous one (an
-- HMAC cut to 40 hex characters, never the address); the two are never mixed (ADR-128 section 7.1).
-- The text-valued lists (rule tags, tool names) are names written as snake_case words, and a check refuses anything
-- with a space or punctuation in them, so a sentence cannot end up in the table by mistake.
-- Old rows are swept by the retention job (next migration, 12 months, provisional).
-- Rollback note: nothing else depends on this table, and the app tolerates a failed write (it logs and carries on).
-- To undo: `drop table public.ai_usage_events;` after taking the writer out of the app, or fix forward.

create table public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  request_id text not null check (char_length(request_id) between 1 and 128),
  -- When the message arrived (the application's clock), and when the row was written.
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  caller text not null check (caller in ('anonymous', 'signed_in')),
  -- A deleted account keeps its usage rows as anonymous facts, like enquiries do.
  user_id uuid references auth.users (id) on delete set null,
  visitor_hash text check (char_length(visitor_hash) between 8 and 128),
  provider text check (provider ~ '^[a-z][a-z0-9_]*$' and char_length(provider) <= 40),
  model text check (model ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]*$' and char_length(model) <= 100),
  prompt_version text not null check (char_length(prompt_version) between 1 and 64),
  outcome text not null check (
    outcome in ('answered', 'limit', 'refused', 'blocked', 'fallback', 'aborted', 'error', 'rate_limited')
  ),
  limited_by text check (limited_by ~ '^[a-z][a-z0-9_]*$' and char_length(limited_by) <= 40),
  input_tags text[] not null default '{}'
    check (cardinality(input_tags) <= 20 and array_to_string(input_tags, ',') ~ '^[a-z0-9_,]*$'),
  output_tags text[] not null default '{}'
    check (cardinality(output_tags) <= 20 and array_to_string(output_tags, ',') ~ '^[a-z0-9_,]*$'),
  -- How often each output rule fired: { "rule_name": count }.
  output_counts jsonb not null default '{}' check (jsonb_typeof(output_counts) = 'object'),
  number_ungrounded integer not null default 0 check (number_ungrounded >= 0),
  rounds integer not null default 0 check (rounds between 0 and 20),
  retried boolean not null default false,
  tool_calls_per_round integer[] not null default '{}' check (cardinality(tool_calls_per_round) <= 20),
  tools_ran text[] not null default '{}'
    check (cardinality(tools_ran) <= 50 and array_to_string(tools_ran, ',') ~ '^[a-z0-9_,]*$'),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  cached_input_tokens integer not null default 0 check (cached_input_tokens >= 0),
  agent_limit text check (agent_limit ~ '^[a-z][a-z0-9_]*$' and char_length(agent_limit) <= 40),
  fallback_reason text check (fallback_reason ~ '^[a-z][a-z0-9_]*$' and char_length(fallback_reason) <= 40),
  duration_ms integer not null default 0 check (duration_ms >= 0),
  -- A signed-in caller has no visitor hash and an anonymous one has no user.
  check (caller = 'signed_in' or user_id is null),
  check (caller = 'anonymous' or visitor_hash is null)
);

alter table public.ai_usage_events enable row level security;

-- No policy and no grant: not even the admin reads it through the API. The cost reports read it with the service role.
revoke all on table public.ai_usage_events from anon, authenticated;

-- The retention sweep, and "what does this cost per day".
create index ai_usage_events_by_time on public.ai_usage_events (occurred_at);
-- "Is anyone abusing it": a signed-in user's recent messages.
create index ai_usage_events_by_user on public.ai_usage_events (user_id, occurred_at desc) where user_id is not null;
-- "Is anyone abusing it": an anonymous caller's recent messages.
create index ai_usage_events_by_visitor on public.ai_usage_events (visitor_hash, occurred_at desc) where visitor_hash is not null;

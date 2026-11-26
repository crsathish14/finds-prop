-- Recommended agents on the home page, and the agent's public page (owner request, 26 Nov 2026).
-- An agent is a builders row with kind = 'agent' (migration 20261101160000). Three public reads need facts that visitors
-- cannot read from the tables directly, so they come through functions that return only safe fields:
--   public_agents(p_id, p_limit)  the agents for the home page (those with something live) or one agent's page, with the
--                                  name, tagline, picture path, year started, how many live listings they have (approved
--                                  homes they own plus approved, published projects) and their commonest localities.
--                                  The phone and the email are never part of it.
--   agent_contact(p_id)           the agent's phone, for a signed-in caller with a verified phone only (the same rule as an
--                                  enquiry). The number is never in a page; the visitor asks for it.
-- Rollback note: nothing here is destructive. Fix forward with a new migration (drop the two functions if needed).

create or replace function public.public_agents(p_id uuid default null, p_limit integer default 12)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with agents as (
    select builder.id, builder.name, builder.tagline, builder.description, builder.logo_path, builder.logo_url,
      builder.established_year, builder.user_id, builder.created_at
    from public.builders as builder
    where builder.kind = 'agent' and builder.active and (p_id is null or builder.id = p_id)
  ),
  places as (
    -- Every live listing of each agent with its locality: their homes and their projects.
    select agent.id as agent_id, home.locality, home.updated_at
    from agents as agent
    join public.properties as home on home.owner_id = agent.user_id and home.status = 'approved'
    where home.locality is not null
    union all
    select agent.id, project.locality, project.updated_at
    from agents as agent
    join public.projects as project on project.builder_id = agent.id and project.moderation = 'approved' and project.published
  ),
  counts as (
    select agent.id as agent_id,
      (select count(*) from public.properties as home where home.owner_id = agent.user_id and home.status = 'approved')
      + (select count(*) from public.projects as project
         where project.builder_id = agent.id and project.moderation = 'approved' and project.published) as listing_count
    from agents as agent
  ),
  top_places as (
    select ranked.agent_id, jsonb_agg(ranked.locality order by ranked.places desc, ranked.locality) as localities
    from (
      select place.agent_id, place.locality, count(*) as places,
        row_number() over (partition by place.agent_id order by count(*) desc, place.locality) as position
      from places as place
      group by place.agent_id, place.locality
    ) as ranked
    where ranked.position <= 4
    group by ranked.agent_id
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', agent.id, 'name', agent.name, 'tagline', agent.tagline, 'description', agent.description,
        'logo_path', agent.logo_path, 'logo_url', agent.logo_url, 'established_year', agent.established_year,
        'listing_count', count_row.listing_count, 'localities', coalesce(place_row.localities, '[]'::jsonb)
      )
      order by count_row.listing_count desc, agent.created_at, agent.id
    ),
    '[]'::jsonb
  )
  from (
    select agent_row.* from agents as agent_row
    join counts as listed on listed.agent_id = agent_row.id
    -- The home page shows agents with something live; an agent's own page opens for any active agent.
    where p_id is not null or listed.listing_count > 0
    order by listed.listing_count desc, agent_row.created_at, agent_row.id
    limit least(greatest(coalesce(p_limit, 12), 1), 24)
  ) as agent
  join counts as count_row on count_row.agent_id = agent.id
  left join top_places as place_row on place_row.agent_id = agent.id
$$;

-- The agent's phone: a caller who is signed in with a verified phone, and an active agent. Anyone else gets an error
-- (42501), never the number. The number is read here and returned, not stored in any page.
create or replace function public.agent_contact(p_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  found_phone text;
begin
  if (select auth.uid()) is null or not (select public.has_verified_phone()) then
    raise exception 'agent_contact.not_allowed' using errcode = '42501';
  end if;
  select builder.phone into found_phone
  from public.builders as builder
  where builder.id = p_id and builder.kind = 'agent' and builder.active;
  return found_phone;
end;
$$;

revoke execute on function public.public_agents(uuid, integer) from public;
revoke execute on function public.agent_contact(uuid) from public, anon;
grant execute on function public.public_agents(uuid, integer) to anon, authenticated, service_role;
grant execute on function public.agent_contact(uuid) to authenticated, service_role;

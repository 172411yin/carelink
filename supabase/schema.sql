create extension if not exists pgcrypto;

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table if not exists public.medicines (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null, type text not null default '家庭常备', purpose text not null default '',
  quantity integer not null default 0 check (quantity >= 0), unit text not null default '盒',
  expiry date not null, threshold integer not null default 0 check (threshold >= 0),
  location text not null default '家庭药箱', note text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.symptom_logs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  type text not null, created_at timestamptz not null default now(), severity integer not null check (severity between 1 and 10),
  duration text not null default '', note text not null default '', care text not null default '', medicine text
);

create or replace function public.is_household_member(target_household uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.household_members where household_id = target_household and user_id = auth.uid()) $$;

create or replace function public.create_household()
returns json language plpgsql security definer set search_path = public
as $$ declare new_household public.households; begin
  if auth.uid() is null then raise exception '请先登录'; end if;
  insert into public.households(created_by) values (auth.uid()) returning * into new_household;
  insert into public.household_members(household_id, user_id, role) values (new_household.id, auth.uid(), 'owner');
  return json_build_object('household_id', new_household.id, 'invite_code', new_household.invite_code);
end; $$;

create or replace function public.join_household(requested_code text)
returns json language plpgsql security definer set search_path = public
as $$ declare target public.households; begin
  if auth.uid() is null then raise exception '请先登录'; end if;
  select * into target from public.households where invite_code = upper(trim(requested_code)) for update;
  if target.id is null then raise exception '邀请码不存在'; end if;
  if exists (select 1 from public.household_members where household_id = target.id and user_id = auth.uid()) then
    return json_build_object('household_id', target.id);
  end if;
  if exists (select 1 from public.household_members where user_id = auth.uid()) then raise exception '此账号已加入其他家庭空间'; end if;
  if (select count(*) from public.household_members where household_id = target.id) >= 2 then raise exception '此家庭空间已满'; end if;
  insert into public.household_members(household_id, user_id, role) values (target.id, auth.uid(), 'member') on conflict do nothing;
  return json_build_object('household_id', target.id);
end; $$;

revoke execute on function public.create_household() from public;
grant execute on function public.create_household() to authenticated;
revoke execute on function public.join_household(text) from public;
grant execute on function public.join_household(text) to authenticated;
revoke execute on function public.is_household_member(uuid) from public;
grant execute on function public.is_household_member(uuid) to authenticated;

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.medicines enable row level security;
alter table public.symptom_logs enable row level security;

grant usage on schema public to authenticated;
grant select on public.households, public.household_members to authenticated;
grant select, insert, update, delete on public.medicines, public.symptom_logs to authenticated;

drop policy if exists "members can view households" on public.households;
drop policy if exists "members can view membership" on public.household_members;
drop policy if exists "members can read medicines" on public.medicines;
drop policy if exists "members can insert medicines" on public.medicines;
drop policy if exists "members can update medicines" on public.medicines;
drop policy if exists "members can delete medicines" on public.medicines;
drop policy if exists "members can read logs" on public.symptom_logs;
drop policy if exists "members can insert logs" on public.symptom_logs;
drop policy if exists "members can update logs" on public.symptom_logs;
drop policy if exists "members can delete logs" on public.symptom_logs;

create policy "members can view households" on public.households for select using (public.is_household_member(id));
create policy "members can view membership" on public.household_members for select using (public.is_household_member(household_id));
create policy "members can read medicines" on public.medicines for select using (public.is_household_member(household_id));
create policy "members can insert medicines" on public.medicines for insert with check (public.is_household_member(household_id));
create policy "members can update medicines" on public.medicines for update using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "members can delete medicines" on public.medicines for delete using (public.is_household_member(household_id));
create policy "members can read logs" on public.symptom_logs for select using (public.is_household_member(household_id));
create policy "members can insert logs" on public.symptom_logs for insert with check (public.is_household_member(household_id));
create policy "members can update logs" on public.symptom_logs for update using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "members can delete logs" on public.symptom_logs for delete using (public.is_household_member(household_id));

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'medicines') then
    alter publication supabase_realtime add table public.medicines;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'symptom_logs') then
    alter publication supabase_realtime add table public.symptom_logs;
  end if;
end $$;

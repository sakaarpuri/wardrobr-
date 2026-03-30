create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.member_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  preferred_gender text check (preferred_gender in ('women', 'men')),
  preferred_size text,
  preferred_shoe_size text,
  preferred_budget_label text,
  price_tier text check (price_tier in ('value', 'mid', 'premium', 'luxury')),
  favorite_categories text[] not null default '{}',
  favorite_colors text[] not null default '{}',
  favorite_stores text[] not null default '{}',
  avoided_stores text[] not null default '{}',
  style_modes text[] not null default '{}',
  formality_bias text,
  preferred_mission text check (preferred_mission in ('full_look', 'hero_piece', 'match_photo', 'style_existing')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.member_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null,
  board_id text,
  product_id text,
  store_name text,
  brand text,
  category text,
  price numeric,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.saved_boards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source_board_id text,
  title text not null,
  occasion text,
  board_payload jsonb not null,
  created_at timestamptz not null default now()
);

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute procedure public.handle_updated_at();

drop trigger if exists set_member_preferences_updated_at on public.member_preferences;
create trigger set_member_preferences_updated_at
before update on public.member_preferences
for each row execute procedure public.handle_updated_at();

create or replace function public.handle_new_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;

  insert into public.member_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_member();

alter table public.profiles enable row level security;
alter table public.member_preferences enable row level security;
alter table public.member_events enable row level security;
alter table public.saved_boards enable row level security;

drop policy if exists "members_manage_own_profile" on public.profiles;
create policy "members_manage_own_profile"
on public.profiles
for all
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "members_manage_own_preferences" on public.member_preferences;
create policy "members_manage_own_preferences"
on public.member_preferences
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "members_manage_own_events" on public.member_events;
create policy "members_manage_own_events"
on public.member_events
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "members_manage_own_saved_boards" on public.saved_boards;
create policy "members_manage_own_saved_boards"
on public.saved_boards
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

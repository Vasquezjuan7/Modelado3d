-- ========================================================
-- CodeCity Nexus 3D · esquema inicial
-- Perfiles, ajustes, repos recientes e historial de auditorías con RLS por usuario.
-- Aplicado en el proyecto qzhzlvhaqgpqxccblzvj.
-- ========================================================
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  full_name text,
  role text default 'Arquitecto de Software',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create table public.user_settings (
  user_id uuid primary key references auth.users on delete cascade,
  theme text not null default 'dark' check (theme in ('dark','light')),
  lang text not null default 'es' check (lang in ('es','en')),
  quality text not null default 'high' check (quality in ('high','low')),
  updated_at timestamptz not null default now()
);
alter table public.user_settings enable row level security;
create policy "settings_select_own" on public.user_settings for select to authenticated using ((select auth.uid()) = user_id);
create policy "settings_insert_own" on public.user_settings for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "settings_update_own" on public.user_settings for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'Arquitecto de Software'))
  on conflict (id) do nothing;
  insert into public.user_settings (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.recent_repos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  input text not null,
  files integer not null default 0,
  opened_at timestamptz not null default now(),
  unique (user_id, name)
);
create index recent_repos_user_opened_idx on public.recent_repos (user_id, opened_at desc);
alter table public.recent_repos enable row level security;
create policy "recents_select_own" on public.recent_repos for select to authenticated using ((select auth.uid()) = user_id);
create policy "recents_insert_own" on public.recent_repos for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "recents_update_own" on public.recent_repos for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "recents_delete_own" on public.recent_repos for delete to authenticated using ((select auth.uid()) = user_id);

create table public.code_audits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  repo_name text,
  file_path text not null,
  language text,
  provider text,
  model_name text,
  severity text,
  score numeric,
  issues_count integer not null default 0,
  critical_count integer not null default 0,
  high_count integer not null default 0,
  summary text,
  created_at timestamptz not null default now()
);
create index code_audits_user_created_idx on public.code_audits (user_id, created_at desc);
alter table public.code_audits enable row level security;
create policy "audits_select_own" on public.code_audits for select to authenticated using ((select auth.uid()) = user_id);
create policy "audits_insert_own" on public.code_audits for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "audits_delete_own" on public.code_audits for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update on public.profiles, public.user_settings to authenticated;
grant select, insert, update, delete on public.recent_repos to authenticated;
grant select, insert, delete on public.code_audits to authenticated;

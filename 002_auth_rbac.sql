-- EDGC237 OS v1.0 — Module Auth réelle (OTP)
-- À exécuter APRÈS 001_init_fondation.sql, dans Supabase SQL Editor.
--
-- Ce que ça change : app_users n'est plus un profil "déclaratif" (n'importe
-- qui pouvait donner n'importe quel numéro). Il est maintenant lié 1-pour-1
-- à un compte auth.users réel, vérifié par SMS via Supabase Auth.

-- ────────────────────────────────────────────
-- 1. Reconstruire app_users, lié à auth.users
-- ────────────────────────────────────────────
drop table if exists fascicule_attempts;
drop table if exists app_users;

create table app_users (
  id          uuid primary key references auth.users(id) on delete cascade,
  phone       text unique,
  full_name   text not null default '',
  role        text not null default 'STUDENT' check (role in ('STUDENT', 'ADMIN')),
  created_at  timestamptz not null default now()
);

create table fascicule_attempts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references app_users(id) on delete cascade,
  fascicule_id   uuid not null references fascicules(id) on delete cascade,
  score          integer not null check (score between 0 and 100),
  completed      boolean not null default false,
  time_minutes   integer,
  confidence     integer check (confidence between 0 and 100),
  created_at     timestamptz not null default now()
);

create index if not exists idx_attempts_user on fascicule_attempts(user_id);
create index if not exists idx_attempts_created on fascicule_attempts(created_at);

-- ────────────────────────────────────────────
-- 2. Auto-provisionnement du profil à la création du compte
--    (déclenché quand l'élève vérifie son code OTP pour la 1ère fois)
-- ────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.app_users (id, phone, full_name)
  values (
    new.id,
    new.phone,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ────────────────────────────────────────────
-- 3. RLS — chacun ne voit que ses propres données
-- ────────────────────────────────────────────
alter table app_users enable row level security;
alter table fascicule_attempts enable row level security;

drop policy if exists "own profile select" on app_users;
create policy "own profile select" on app_users
  for select using (auth.uid() = id);

drop policy if exists "own profile update" on app_users;
create policy "own profile update" on app_users
  for update using (auth.uid() = id);

drop policy if exists "own attempts select" on fascicule_attempts;
create policy "own attempts select" on fascicule_attempts
  for select using (auth.uid() = user_id);

-- Les écritures (insert de tentatives) passent uniquement par /api/attempt,
-- qui vérifie le token puis écrit via la clé service_role (contourne RLS
-- volontairement, après vérification serveur — jamais depuis le client).

-- ────────────────────────────────────────────
-- 4. Journal d'audit minimal (traçabilité des changements de rôle)
-- ────────────────────────────────────────────
create table if not exists admin_audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references app_users(id),
  action      text not null,
  target_id   uuid references app_users(id),
  payload     jsonb,
  created_at  timestamptz not null default now()
);
alter table admin_audit_log enable row level security;
-- Aucune policy publique : lecture/écriture uniquement via service_role (API admin future).

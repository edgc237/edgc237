-- EDGC237 OS v1.0 — Phase Fondation
-- Migration initiale : users, fascicules, tentatives d'auto-évaluation
-- À exécuter dans l'éditeur SQL de Supabase (Project → SQL Editor)

create extension if not exists "pgcrypto";

-- ────────────────────────────────────────────
-- USERS (élèves + un compte admin pour toi)
-- ────────────────────────────────────────────
create table if not exists app_users (
  id          uuid primary key default gen_random_uuid(),
  phone       text unique not null,
  full_name   text not null,
  role        text not null default 'STUDENT' check (role in ('STUDENT', 'ADMIN')),
  created_at  timestamptz not null default now()
);

-- ────────────────────────────────────────────
-- FASCICULES (catalogue simple, un enregistrement par fascicule DÉMASQUER)
-- ────────────────────────────────────────────
create table if not exists fascicules (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,           -- ex: "DÉMASQUER — GÉO BEPC — Dossier 3"
  subject     text not null,           -- Géographie / Histoire / ECM
  level       text not null,           -- 3ème / 1ère / Tle / etc.
  created_at  timestamptz not null default now()
);

-- ────────────────────────────────────────────
-- TENTATIVES (le cœur de la Learning Loop réelle)
-- ────────────────────────────────────────────
create table if not exists fascicule_attempts (
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
-- SÉCURITÉ — Row Level Security
-- ────────────────────────────────────────────
alter table app_users enable row level security;
alter table fascicules enable row level security;
alter table fascicule_attempts enable row level security;

-- Les fonctions serverless utilisent la clé "service_role" (contourne RLS,
-- côté serveur uniquement — jamais exposée au client). Aucune policy publique
-- n'est donc nécessaire pour l'instant : le client web ne parle jamais
-- directement à Supabase, seulement via /api/*.

-- ────────────────────────────────────────────
-- DONNÉES DE DÉPART — à adapter avec tes vrais fascicules
-- ────────────────────────────────────────────
insert into fascicules (title, subject, level) values
  ('DÉMASQUER — GÉO BEPC — Dossier 1', 'Géographie', '3ème'),
  ('DÉMASQUER — HIST BEPC — Dossier 1', 'Histoire', '3ème')
on conflict do nothing;

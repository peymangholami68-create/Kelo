-- KELO VPS authentication foundation
-- One commercial user account; only system roles are security roles.

create extension if not exists pgcrypto;

create table if not exists kelo_migrations (
  id text primary key,
  applied_at timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  phone varchar(11) not null unique,
  national_id varchar(10) not null unique,
  profile_completed boolean not null default false,
  profile jsonb not null default '{}'::jsonb,
  profile_location jsonb,
  system_roles text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash char(64) not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ip_address inet,
  user_agent text
);

create table if not exists audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_sessions_user on sessions(user_id);
create index if not exists idx_sessions_expiry on sessions(expires_at);
create index if not exists idx_audit_actor_created on audit_logs(actor_id, created_at desc);

create or replace function kelo_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_users_updated_at on users;
create trigger trg_users_updated_at
before update on users
for each row execute function kelo_set_updated_at();

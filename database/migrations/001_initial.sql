-- KELO production PostgreSQL schema
-- Target: self-hosted PostgreSQL + PostGIS on the Kelo VPS.
-- Commercial roles are NOT stored on users. A single account can create
-- requests and/or provide services. System roles are separate.

create extension if not exists pgcrypto;
create extension if not exists postgis;

create type system_role as enum ('admin', 'support', 'superadmin');
create type listing_status as enum ('draft', 'active', 'paused', 'blocked', 'expired');
create type request_status as enum ('created', 'matching', 'sent', 'pending', 'accepted', 'in_progress', 'completed', 'cancelled', 'expired');
create type recipient_status as enum ('pending', 'accepted', 'rejected', 'closed', 'expired', 'completed');
create type booking_status as enum ('confirmed', 'in_progress', 'completed', 'cancelled');
create type deal_status as enum ('agreed', 'paid', 'in_progress', 'completed', 'cancelled');
create type payment_status as enum ('pending', 'paid', 'failed', 'refunded');

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  national_id text unique,
  full_name text,
  province text,
  city text,
  village text,
  avatar_path text,
  profile_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists user_system_roles (
  user_id uuid not null references users(id) on delete cascade,
  role system_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table if not exists service_types (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists machines (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users(id) on delete restrict,
  name text,
  machine_type text not null,
  location geography(point, 4326),
  location_label text,
  rating numeric(3,2) not null default 0,
  completed_jobs integer not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists machine_photos (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null references machines(id) on delete cascade,
  storage_path text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists service_listings (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references users(id) on delete restrict,
  service_type_id uuid not null references service_types(id) on delete restrict,
  machine_id uuid references machines(id) on delete set null,
  machine_type text,
  capacity text,
  price numeric(14,2) not null,
  price_unit text not null,
  activity_area jsonb not null default '[]'::jsonb,
  location_label text,
  availability_start date,
  availability_end date,
  notes text,
  status listing_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (price >= 0),
  check (availability_end is null or availability_start is null or availability_end >= availability_start)
);

create table if not exists service_listing_photos (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references service_listings(id) on delete cascade,
  storage_path text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references users(id) on delete restrict,
  service_type_id uuid not null references service_types(id) on delete restrict,
  area_ha numeric(10,2),
  date_start date not null,
  date_end date,
  service_location geography(point, 4326),
  service_location_label text,
  data jsonb not null default '{}'::jsonb,
  note text,
  status request_status not null default 'created',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (area_ha is null or area_ha > 0),
  check (date_end is null or date_end >= date_start)
);

create table if not exists request_recipients (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete cascade,
  provider_id uuid not null references users(id) on delete restrict,
  machine_id uuid references machines(id) on delete set null,
  listing_id uuid references service_listings(id) on delete set null,
  unit_price numeric(14,2) not null default 0,
  price_unit text,
  total numeric(14,2) not null default 0,
  rating numeric(3,2),
  location_label text,
  status recipient_status not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  closed_at timestamptz,
  unique (request_id, provider_id, machine_id)
);

create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete restrict,
  requester_id uuid not null references users(id) on delete restrict,
  provider_id uuid not null references users(id) on delete restrict,
  machine_id uuid references machines(id) on delete set null,
  listing_id uuid references service_listings(id) on delete set null,
  start_date date not null,
  end_date date not null,
  status booking_status not null default 'confirmed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create table if not exists deals (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references requests(id) on delete restrict,
  booking_id uuid not null unique references bookings(id) on delete restrict,
  requester_id uuid not null references users(id) on delete restrict,
  provider_id uuid not null references users(id) on delete restrict,
  machine_id uuid references machines(id) on delete set null,
  service_type_id uuid not null references service_types(id) on delete restrict,
  total numeric(14,2) not null default 0,
  unit_price numeric(14,2) not null default 0,
  price_unit text,
  commission_rate numeric(6,3) not null default 3.000,
  commission_amount numeric(14,2) not null default 0,
  provider_amount numeric(14,2) not null default 0,
  payment_status payment_status not null default 'pending',
  status deal_status not null default 'agreed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz,
  completed_at timestamptz,
  check (total >= 0),
  check (commission_rate >= 0 and commission_rate <= 100),
  check (provider_amount >= 0)
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals(id) on delete restrict,
  payer_id uuid not null references users(id) on delete restrict,
  amount numeric(14,2) not null,
  gateway text,
  gateway_reference text,
  status payment_status not null default 'pending',
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  refunded_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  check (amount > 0)
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals(id) on delete cascade,
  reviewer_id uuid not null references users(id) on delete restrict,
  reviewee_id uuid not null references users(id) on delete restrict,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (deal_id, reviewer_id)
);

create table if not exists support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete restrict,
  category text not null,
  subject text not null,
  description text not null,
  status text not null default 'open',
  assigned_to uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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

create table if not exists app_settings (
  key text primary key,
  value_text text,
  value_num numeric(14,3),
  is_public boolean not null default false,
  updated_at timestamptz not null default now()
);

create index if not exists idx_machines_owner on machines(owner_id);
create index if not exists idx_machines_location on machines using gist(location);
create index if not exists idx_listings_provider_status on service_listings(provider_id, status);
create index if not exists idx_listings_service_status on service_listings(service_type_id, status);
create index if not exists idx_requests_requester on requests(requester_id);
create index if not exists idx_requests_service_status on requests(service_type_id, status);
create index if not exists idx_requests_location on requests using gist(service_location);
create index if not exists idx_recipients_provider_status on request_recipients(provider_id, status);
create index if not exists idx_bookings_machine_dates on bookings(machine_id, start_date, end_date);
create index if not exists idx_bookings_provider_dates on bookings(provider_id, start_date, end_date);
create index if not exists idx_notifications_user_read on notifications(user_id, read_at);
create index if not exists idx_audit_actor_created on audit_logs(actor_id, created_at);

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_users_updated_at on users;
create trigger trg_users_updated_at before update on users for each row execute function set_updated_at();
drop trigger if exists trg_machines_updated_at on machines;
create trigger trg_machines_updated_at before update on machines for each row execute function set_updated_at();
drop trigger if exists trg_listings_updated_at on service_listings;
create trigger trg_listings_updated_at before update on service_listings for each row execute function set_updated_at();
drop trigger if exists trg_requests_updated_at on requests;
create trigger trg_requests_updated_at before update on requests for each row execute function set_updated_at();
drop trigger if exists trg_bookings_updated_at on bookings;
create trigger trg_bookings_updated_at before update on bookings for each row execute function set_updated_at();
drop trigger if exists trg_deals_updated_at on deals;
create trigger trg_deals_updated_at before update on deals for each row execute function set_updated_at();
drop trigger if exists trg_support_tickets_updated_at on support_tickets;
create trigger trg_support_tickets_updated_at before update on support_tickets for each row execute function set_updated_at();
drop trigger if exists trg_app_settings_updated_at on app_settings;
create trigger trg_app_settings_updated_at before update on app_settings for each row execute function set_updated_at();

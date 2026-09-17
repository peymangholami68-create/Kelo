-- KELO production foundation schema
-- Commercial roles are NOT stored on profiles.
-- A user may create requests and/or service listings with the same account.
-- System roles (admin/support/superadmin) are separate and security-oriented.

create extension if not exists pgcrypto;
create extension if not exists postgis;

create type public.system_role as enum ('admin', 'support', 'superadmin');
create type public.listing_status as enum ('draft', 'active', 'paused', 'blocked', 'expired');
create type public.request_status as enum ('created', 'matching', 'sent', 'pending', 'accepted', 'in_progress', 'completed', 'cancelled', 'expired');
create type public.recipient_status as enum ('pending', 'accepted', 'rejected', 'closed', 'expired', 'completed');
create type public.booking_status as enum ('confirmed', 'in_progress', 'completed', 'cancelled');
create type public.deal_status as enum ('agreed', 'paid', 'in_progress', 'completed', 'cancelled');
create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded');

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text unique,
  national_id text unique,
  province text,
  city text,
  village text,
  avatar_path text,
  profile_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.system_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table if not exists public.service_types (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.machines (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict,
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

create table if not exists public.machine_photos (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null references public.machines(id) on delete cascade,
  storage_path text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.service_listings (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles(id) on delete restrict,
  service_type_id uuid not null references public.service_types(id) on delete restrict,
  machine_id uuid references public.machines(id) on delete set null,
  machine_type text,
  capacity text,
  price numeric(14,2) not null,
  price_unit text not null,
  activity_area jsonb not null default '[]'::jsonb,
  location_label text,
  availability_start date,
  availability_end date,
  notes text,
  status public.listing_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (price >= 0),
  check (availability_end is null or availability_start is null or availability_end >= availability_start)
);

create table if not exists public.service_listing_photos (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.service_listings(id) on delete cascade,
  storage_path text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete restrict,
  service_type_id uuid not null references public.service_types(id) on delete restrict,
  area_ha numeric(10,2),
  date_start date not null,
  date_end date,
  service_location geography(point, 4326),
  service_location_label text,
  data jsonb not null default '{}'::jsonb,
  note text,
  status public.request_status not null default 'created',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (area_ha is null or area_ha > 0),
  check (date_end is null or date_end >= date_start)
);

create table if not exists public.request_recipients (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  provider_id uuid not null references public.profiles(id) on delete restrict,
  machine_id uuid references public.machines(id) on delete set null,
  listing_id uuid references public.service_listings(id) on delete set null,
  unit_price numeric(14,2) not null default 0,
  price_unit text,
  total numeric(14,2) not null default 0,
  rating numeric(3,2),
  location_label text,
  status public.recipient_status not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  closed_at timestamptz,
  unique (request_id, provider_id, machine_id)
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete restrict,
  requester_id uuid not null references public.profiles(id) on delete restrict,
  provider_id uuid not null references public.profiles(id) on delete restrict,
  machine_id uuid references public.machines(id) on delete set null,
  listing_id uuid references public.service_listings(id) on delete set null,
  start_date date not null,
  end_date date not null,
  status public.booking_status not null default 'confirmed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.requests(id) on delete restrict,
  booking_id uuid not null unique references public.bookings(id) on delete restrict,
  requester_id uuid not null references public.profiles(id) on delete restrict,
  provider_id uuid not null references public.profiles(id) on delete restrict,
  machine_id uuid references public.machines(id) on delete set null,
  service_type_id uuid not null references public.service_types(id) on delete restrict,
  total numeric(14,2) not null default 0,
  unit_price numeric(14,2) not null default 0,
  price_unit text,
  commission_rate numeric(6,3) not null default 3.000,
  commission_amount numeric(14,2) not null default 0,
  provider_amount numeric(14,2) not null default 0,
  payment_status public.payment_status not null default 'pending',
  status public.deal_status not null default 'agreed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz,
  completed_at timestamptz,
  check (total >= 0),
  check (commission_rate >= 0 and commission_rate <= 100),
  check (provider_amount >= 0)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete restrict,
  payer_id uuid not null references public.profiles(id) on delete restrict,
  amount numeric(14,2) not null,
  gateway text,
  gateway_reference text,
  status public.payment_status not null default 'pending',
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  refunded_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  check (amount > 0)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete restrict,
  reviewee_id uuid not null references public.profiles(id) on delete restrict,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (deal_id, reviewer_id)
);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  category text not null,
  subject text not null,
  description text not null,
  status text not null default 'open',
  assigned_to uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_requests_requester on public.requests(requester_id);
create index if not exists idx_requests_service_status on public.requests(service_type_id, status);
create index if not exists idx_requests_location on public.requests using gist(service_location);
create index if not exists idx_listings_provider_status on public.service_listings(provider_id, status);
create index if not exists idx_recipients_provider_status on public.request_recipients(provider_id, status);
create index if not exists idx_bookings_machine_dates on public.bookings(machine_id, start_date, end_date);
create index if not exists idx_bookings_provider_dates on public.bookings(provider_id, start_date, end_date);
create index if not exists idx_notifications_user_read on public.notifications(user_id, read_at);
create index if not exists idx_audit_actor_created on public.audit_logs(actor_id, created_at);

insert into public.service_types (slug, name, description, sort_order)
values
  ('tractor', 'شخم و دیسک', 'آماده‌سازی زمین برای کاشت', 1),
  ('planting', 'کاشت', 'بذرپاشی، ردیف‌کاری و نشاکاری', 2),
  ('spray', 'سمپاشی', 'مبارزه با آفات، بیماری‌ها و علف‌های هرز', 3),
  ('harvest', 'برداشت', 'برداشت محصولات با ماشین‌آلات', 4)
on conflict (slug) do nothing;

create or replace function public.has_system_role(required_role public.system_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = required_role
  );
$$;

create or replace function public.accept_request_recipient(p_recipient_id uuid)
returns table (booking_id uuid, deal_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient public.request_recipients%rowtype;
  v_request public.requests%rowtype;
  v_booking public.bookings%rowtype;
  v_service_id uuid;
  v_existing uuid;
  v_total numeric(14,2);
  v_rate numeric(6,3) := 3.000;
begin
  select * into v_recipient
  from public.request_recipients
  where id = p_recipient_id
  for update;

  if not found then
    raise exception 'recipient_not_found';
  end if;

  if v_recipient.provider_id <> auth.uid() then
    raise exception 'not_allowed';
  end if;

  if v_recipient.status <> 'pending' then
    raise exception 'recipient_not_pending';
  end if;

  select * into v_request
  from public.requests
  where id = v_recipient.request_id
  for update;

  if v_request.status in ('accepted','in_progress','completed','cancelled','expired') then
    raise exception 'request_not_open';
  end if;

  select d.id into v_existing
  from public.deals d
  where d.request_id = v_request.id
    and d.status <> 'cancelled'
  limit 1;

  if v_existing is not null then
    raise exception 'request_already_agreed';
  end if;

  if v_recipient.machine_id is not null then
    if exists (
      select 1 from public.bookings b
      where b.machine_id = v_recipient.machine_id
        and b.status in ('confirmed','in_progress')
        and daterange(b.start_date, b.end_date, '[]')
            && daterange(v_request.date_start, coalesce(v_request.date_end, v_request.date_start), '[]')
      for share update
    ) then
      raise exception 'machine_unavailable';
    end if;
  end if;

  if exists (
    select 1 from public.deals d
    where d.provider_id = auth.uid()
      and d.status in ('agreed','paid','in_progress')
  ) then
    raise exception 'provider_has_unfinished_deal';
  end if;

  select service_type_id into v_service_id
  from public.requests where id = v_request.id;

  v_total := coalesce(v_recipient.total, 0);

  insert into public.bookings (
    request_id, requester_id, provider_id, machine_id, listing_id,
    start_date, end_date, status
  ) values (
    v_request.id, v_request.requester_id, auth.uid(), v_recipient.machine_id,
    v_recipient.listing_id, v_request.date_start,
    coalesce(v_request.date_end, v_request.date_start), 'confirmed'
  ) returning * into v_booking;

  insert into public.deals (
    request_id, booking_id, requester_id, provider_id, machine_id,
    service_type_id, total, unit_price, price_unit,
    commission_rate, commission_amount, provider_amount,
    payment_status, status
  ) values (
    v_request.id, v_booking.id, v_request.requester_id, auth.uid(), v_recipient.machine_id,
    v_service_id, v_total, v_recipient.unit_price, v_recipient.price_unit,
    v_rate, round(v_total * v_rate / 100, 2), v_total - round(v_total * v_rate / 100, 2),
    'pending', 'agreed'
  ) returning id into deal_id;

  update public.request_recipients
  set status = case when id = p_recipient_id then 'accepted'::public.recipient_status else 'closed'::public.recipient_status end,
      responded_at = case when id = p_recipient_id then now() else responded_at end,
      closed_at = case when id <> p_recipient_id then now() else closed_at end
  where request_id = v_request.id
    and status = 'pending';

  update public.requests
  set status = 'accepted', updated_at = now()
  where id = v_request.id;

  booking_id := v_booking.id;
  return next;
end;
$$;

revoke all on function public.accept_request_recipient(uuid) from public;
grant execute on function public.accept_request_recipient(uuid) to authenticated;

-- Enable RLS on application tables.
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.service_types enable row level security;
alter table public.machines enable row level security;
alter table public.machine_photos enable row level security;
alter table public.service_listings enable row level security;
alter table public.service_listing_photos enable row level security;
alter table public.requests enable row level security;
alter table public.request_recipients enable row level security;
alter table public.bookings enable row level security;
alter table public.deals enable row level security;
alter table public.payments enable row level security;
alter table public.notifications enable row level security;
alter table public.reviews enable row level security;
alter table public.support_tickets enable row level security;
alter table public.audit_logs enable row level security;

-- Profiles: a user can manage only their own profile; admins can read all.
create policy if not exists profiles_select_self on public.profiles
  for select to authenticated using (id = auth.uid() or public.has_system_role('admin'));
create policy if not exists profiles_insert_self on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy if not exists profiles_update_self on public.profiles
  for update to authenticated using (id = auth.uid() or public.has_system_role('admin'))
  with check (id = auth.uid() or public.has_system_role('admin'));

-- Publicly readable service catalog.
create policy if not exists service_types_select_active on public.service_types
  for select to anon, authenticated using (is_active = true or public.has_system_role('admin'));

-- Active listings/machines are visible; mutations belong to their owner.
create policy if not exists machines_select_visible on public.machines
  for select to anon, authenticated using (status = 'active' or owner_id = auth.uid() or public.has_system_role('admin'));
create policy if not exists machines_owner_write on public.machines
  for all to authenticated using (owner_id = auth.uid() or public.has_system_role('admin'))
  with check (owner_id = auth.uid() or public.has_system_role('admin'));

create policy if not exists listings_select_visible on public.service_listings
  for select to anon, authenticated using (status = 'active' or provider_id = auth.uid() or public.has_system_role('admin'));
create policy if not exists listings_owner_write on public.service_listings
  for all to authenticated using (provider_id = auth.uid() or public.has_system_role('admin'))
  with check (provider_id = auth.uid() or public.has_system_role('admin'));

create policy if not exists requests_owner_access on public.requests
  for all to authenticated using (requester_id = auth.uid() or public.has_system_role('admin'))
  with check (requester_id = auth.uid() or public.has_system_role('admin'));

create policy if not exists recipients_participant_read on public.request_recipients
  for select to authenticated using (
    provider_id = auth.uid()
    or exists (select 1 from public.requests r where r.id = request_id and r.requester_id = auth.uid())
    or public.has_system_role('admin')
  );
create policy if not exists recipients_provider_insert on public.request_recipients
  for insert to authenticated with check (
    exists (select 1 from public.requests r where r.id = request_id and r.requester_id = auth.uid())
    or public.has_system_role('admin')
  );

create policy if not exists bookings_participant_access on public.bookings
  for select to authenticated using (requester_id = auth.uid() or provider_id = auth.uid() or public.has_system_role('admin'));
create policy if not exists deals_participant_access on public.deals
  for select to authenticated using (requester_id = auth.uid() or provider_id = auth.uid() or public.has_system_role('admin'));

create policy if not exists payments_payer_access on public.payments
  for select to authenticated using (payer_id = auth.uid() or public.has_system_role('admin'));
create policy if not exists notifications_owner_access on public.notifications
  for all to authenticated using (user_id = auth.uid() or public.has_system_role('admin'))
  with check (user_id = auth.uid() or public.has_system_role('admin'));
create policy if not exists reviews_public_read on public.reviews
  for select to anon, authenticated using (true);
create policy if not exists reviews_reviewer_write on public.reviews
  for all to authenticated using (reviewer_id = auth.uid() or public.has_system_role('admin'))
  with check (reviewer_id = auth.uid() or public.has_system_role('admin'));
create policy if not exists support_owner_access on public.support_tickets
  for all to authenticated using (user_id = auth.uid() or assigned_to = auth.uid() or public.has_system_role('support') or public.has_system_role('admin'))
  with check (user_id = auth.uid() or assigned_to = auth.uid() or public.has_system_role('support') or public.has_system_role('admin'));
create policy if not exists audit_admin_read on public.audit_logs
  for select to authenticated using (public.has_system_role('admin') or public.has_system_role('superadmin'));

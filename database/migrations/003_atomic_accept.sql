-- Atomic first-valid-acceptance transaction.
-- IMPORTANT: this function is called by the trusted backend after authentication.
-- The API must pass the authenticated provider_id; clients never get direct DB access.

create or replace function accept_request_recipient(
  p_recipient_id uuid,
  p_provider_id uuid
)
returns table (booking_id uuid, deal_id uuid)
language plpgsql
as $$
declare
  v_recipient request_recipients%rowtype;
  v_request requests%rowtype;
  v_service_id uuid;
  v_booking bookings%rowtype;
  v_existing uuid;
  v_total numeric(14,2);
  v_rate numeric(6,3);
begin
  select request_id
    into v_recipient.request_id
    from request_recipients
   where id = p_recipient_id;

  if v_recipient.request_id is null then
    raise exception using errcode = 'P0002', message = 'recipient_not_found';
  end if;

  -- Lock the shared request first. This is the serialization point for
  -- competing providers accepting the same request.
  select * into v_request
    from requests
   where id = v_recipient.request_id
   for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'request_not_found';
  end if;

  select * into v_recipient
    from request_recipients
   where id = p_recipient_id
   for update;

  if v_recipient.provider_id <> p_provider_id then
    raise exception using errcode = '42501', message = 'not_allowed';
  end if;

  if v_recipient.status <> 'pending' then
    raise exception using errcode = 'P0001', message = 'recipient_not_pending';
  end if;

  if v_request.status in ('accepted','in_progress','completed','cancelled','expired') then
    raise exception using errcode = 'P0001', message = 'request_not_open';
  end if;

  select id into v_existing
    from deals
   where request_id = v_request.id
     and status <> 'cancelled'
   limit 1;

  if v_existing is not null then
    raise exception using errcode = 'P0001', message = 'request_already_agreed';
  end if;

  if v_recipient.machine_id is not null then
    if exists (
      select 1
        from bookings b
       where b.machine_id = v_recipient.machine_id
         and b.status in ('confirmed','in_progress')
         and daterange(b.start_date, b.end_date, '[]')
             && daterange(v_request.date_start, coalesce(v_request.date_end, v_request.date_start), '[]')
    ) then
      raise exception using errcode = 'P0001', message = 'machine_unavailable';
    end if;
  end if;

  if exists (
    select 1
      from deals d
     where d.provider_id = p_provider_id
       and d.status in ('agreed','paid','in_progress')
  ) then
    raise exception using errcode = 'P0001', message = 'provider_has_unfinished_deal';
  end if;

  select service_type_id into v_service_id from requests where id = v_request.id;
  select coalesce(value_num, 3.000) into v_rate from app_settings where key = 'commission_rate';
  v_rate := coalesce(v_rate, 3.000);
  v_total := greatest(coalesce(v_recipient.total, 0), 0);

  insert into bookings (
    request_id, requester_id, provider_id, machine_id, listing_id,
    start_date, end_date, status
  ) values (
    v_request.id, v_request.requester_id, p_provider_id, v_recipient.machine_id,
    v_recipient.listing_id, v_request.date_start,
    coalesce(v_request.date_end, v_request.date_start), 'confirmed'
  ) returning * into v_booking;

  insert into deals (
    request_id, booking_id, requester_id, provider_id, machine_id,
    service_type_id, total, unit_price, price_unit,
    commission_rate, commission_amount, provider_amount,
    payment_status, status
  ) values (
    v_request.id, v_booking.id, v_request.requester_id, p_provider_id, v_recipient.machine_id,
    v_service_id, v_total, v_recipient.unit_price, v_recipient.price_unit,
    v_rate, round(v_total * v_rate / 100, 2), v_total - round(v_total * v_rate / 100, 2),
    'pending', 'agreed'
  ) returning id into deal_id;

  update request_recipients
     set status = case when id = p_recipient_id then 'accepted'::recipient_status else 'closed'::recipient_status end,
         responded_at = case when id = p_recipient_id then now() else responded_at end,
         closed_at = case when id <> p_recipient_id then now() else closed_at end
   where request_id = v_request.id
     and status = 'pending';

  update requests
     set status = 'accepted'
   where id = v_request.id;

  insert into notifications (user_id, type, title, body, data)
  values (
    v_request.requester_id,
    'deal_agreed',
    'درخواست شما توافق شد',
    'یک ارائه‌دهنده درخواست شما را پذیرفت.',
    jsonb_build_object('requestId', v_request.id, 'dealId', deal_id)
  );

  insert into audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    p_provider_id,
    'accept_request_recipient',
    'deal',
    deal_id,
    jsonb_build_object('requestId', v_request.id, 'recipientId', p_recipient_id)
  );

  booking_id := v_booking.id;
  return next;
end;
$$;

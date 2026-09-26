-- Kelo proposal architecture: a proposal is between two users around any request.
-- The existing request_recipients table is kept for compatibility with the UI/API.

DO $$ BEGIN
  CREATE TYPE request_kind AS ENUM ('need','provide');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE requests ADD COLUMN IF NOT EXISTS request_kind request_kind NOT NULL DEFAULT 'need';

ALTER TABLE request_recipients ADD COLUMN IF NOT EXISTS proposer_id uuid REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE request_recipients ADD COLUMN IF NOT EXISTS recipient_id uuid REFERENCES users(id) ON DELETE RESTRICT;

UPDATE request_recipients rr
SET proposer_id = COALESCE(rr.proposer_id, r.requester_id),
    recipient_id = COALESCE(rr.recipient_id, rr.provider_id)
FROM requests r
WHERE r.id = rr.request_id;

ALTER TABLE request_recipients ALTER COLUMN proposer_id SET NOT NULL;
ALTER TABLE request_recipients ALTER COLUMN recipient_id SET NOT NULL;

DROP INDEX IF EXISTS idx_recipients_provider_status;
-- The original UNIQUE(request_id, provider_id, machine_id) may be a constraint-backed index.
-- Remove the constraint itself so proposals are unique by proposer/recipient, not only provider.
ALTER TABLE request_recipients DROP CONSTRAINT IF EXISTS request_recipients_request_id_provider_id_machine_id_key;
DROP INDEX IF EXISTS request_recipients_request_id_provider_id_machine_id_key;

CREATE INDEX IF NOT EXISTS idx_recipients_recipient_status ON request_recipients(recipient_id, status);
CREATE INDEX IF NOT EXISTS idx_recipients_proposer_status ON request_recipients(proposer_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_request_proposals_pair
ON request_recipients(request_id, proposer_id, recipient_id, COALESCE(machine_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Keep provider_id as a compatibility mirror for the existing frontend/API contract.
UPDATE request_recipients SET provider_id = recipient_id WHERE provider_id IS DISTINCT FROM recipient_id;

DROP FUNCTION IF EXISTS accept_request_recipient(uuid, uuid);

CREATE OR REPLACE FUNCTION accept_request_recipient(p_recipient_id uuid, p_user_id uuid)
RETURNS TABLE (booking_id uuid, deal_id uuid)
LANGUAGE plpgsql AS $$
DECLARE
  v_rec request_recipients%rowtype;
  v_req requests%rowtype;
  v_booking bookings%rowtype;
  v_existing uuid;
  v_total numeric(14,2);
  v_rate numeric(6,3);
  v_provider uuid;
  v_customer uuid;
BEGIN
  SELECT * INTO v_rec FROM request_recipients WHERE id=p_recipient_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'recipient_not_found'; END IF;
  IF v_rec.recipient_id <> p_user_id THEN RAISE EXCEPTION 'not_allowed'; END IF;

  SELECT * INTO v_req FROM requests WHERE id=v_rec.request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request_not_found'; END IF;
  IF v_rec.status <> 'pending' THEN RAISE EXCEPTION 'recipient_not_pending'; END IF;
  IF v_req.status IN ('accepted','in_progress','completed','cancelled','expired') THEN RAISE EXCEPTION 'request_not_open'; END IF;

  SELECT id INTO v_existing FROM deals WHERE request_id=v_req.id AND status<>'cancelled' LIMIT 1;
  IF v_existing IS NOT NULL THEN RAISE EXCEPTION 'request_already_agreed'; END IF;

  IF v_req.request_kind='need' THEN
    v_customer := v_req.requester_id;
    v_provider := CASE WHEN v_rec.proposer_id = v_req.requester_id THEN v_rec.recipient_id ELSE v_rec.proposer_id END;
  ELSE
    v_provider := v_req.requester_id;
    v_customer := CASE WHEN v_rec.proposer_id = v_req.requester_id THEN v_rec.recipient_id ELSE v_rec.proposer_id END;
  END IF;

  IF v_rec.machine_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM bookings b WHERE b.machine_id=v_rec.machine_id AND b.status IN ('confirmed','in_progress')
    AND daterange(b.start_date,b.end_date,'[]') && daterange(v_req.date_start,coalesce(v_req.date_end,v_req.date_start),'[]')
  ) THEN RAISE EXCEPTION 'machine_unavailable'; END IF;

  IF EXISTS (SELECT 1 FROM deals d WHERE d.provider_id=v_provider AND d.status IN ('agreed','paid','in_progress')) THEN
    RAISE EXCEPTION 'provider_has_unfinished_deal';
  END IF;

  SELECT coalesce(value_num,3.000) INTO v_rate FROM app_settings WHERE key='commission_rate';
  v_rate := coalesce(v_rate,3.000);
  v_total := greatest(coalesce(v_rec.total,0),0);

  INSERT INTO bookings(request_id,requester_id,provider_id,machine_id,listing_id,start_date,end_date,status)
  VALUES(v_req.id,v_customer,v_provider,v_rec.machine_id,v_rec.listing_id,v_req.date_start,coalesce(v_req.date_end,v_req.date_start),'confirmed')
  RETURNING * INTO v_booking;

  INSERT INTO deals(request_id,booking_id,requester_id,provider_id,machine_id,service_type_id,total,unit_price,price_unit,commission_rate,commission_amount,provider_amount,payment_status,status)
  VALUES(v_req.id,v_booking.id,v_customer,v_provider,v_rec.machine_id,v_req.service_type_id,v_total,v_rec.unit_price,v_rec.price_unit,v_rate,round(v_total*v_rate/100,2),v_total-round(v_total*v_rate/100,2),'pending','agreed')
  RETURNING id INTO deal_id;

  UPDATE request_recipients SET status=CASE WHEN id=p_recipient_id THEN 'accepted'::recipient_status ELSE 'closed'::recipient_status END,
    responded_at=CASE WHEN id=p_recipient_id THEN now() ELSE responded_at END,
    closed_at=CASE WHEN id<>p_recipient_id THEN now() ELSE closed_at END
  WHERE request_id=v_req.id AND status='pending';

  UPDATE requests SET status='accepted' WHERE id=v_req.id;

  INSERT INTO notifications(user_id,type,title,body,data)
  VALUES(v_customer,'deal_agreed','درخواست شما توافق شد','یک پیشنهاد برای درخواست شما پذیرفته شد.',jsonb_build_object('requestId',v_req.id,'dealId',deal_id));

  INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,metadata)
  VALUES(p_user_id,'accept_request_recipient','deal',deal_id,jsonb_build_object('requestId',v_req.id,'recipientId',p_recipient_id));

  booking_id := v_booking.id;
  RETURN NEXT;
END;
$$;

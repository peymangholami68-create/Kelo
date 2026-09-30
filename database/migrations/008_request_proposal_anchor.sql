-- A proposal can originate from a specific "provide" request while
-- request_id remains the exact target "need" request used for booking/deal.
ALTER TABLE request_recipients
  ADD COLUMN IF NOT EXISTS anchor_request_id uuid REFERENCES requests(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_recipients_anchor_status
  ON request_recipients(anchor_request_id, status);

CREATE INDEX IF NOT EXISTS idx_recipients_request_pair_status
  ON request_recipients(request_id, proposer_id, recipient_id, status);

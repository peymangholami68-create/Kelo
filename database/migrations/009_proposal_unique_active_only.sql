-- Allow re-sending a proposal after cancel/reject/close.
-- Old unique index blocked ANY second row for the same pair regardless of status.
DROP INDEX IF EXISTS uq_request_proposals_pair;

CREATE UNIQUE INDEX IF NOT EXISTS uq_request_proposals_pair_active
ON request_recipients (
  request_id,
  proposer_id,
  recipient_id,
  COALESCE(machine_id, '00000000-0000-0000-0000-000000000000'::uuid)
)
WHERE status IN ('pending', 'accepted');

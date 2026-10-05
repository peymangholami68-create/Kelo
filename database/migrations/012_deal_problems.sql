-- Deal problem reports (farmer / provider)
CREATE TABLE IF NOT EXISTS deal_problems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL,
  reason text NOT NULL DEFAULT '',
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deal_problems_deal ON deal_problems(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_problems_reporter ON deal_problems(reporter_id);

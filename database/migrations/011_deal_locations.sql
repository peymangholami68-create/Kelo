-- Live location sharing for active deals (last point only)
CREATE TABLE IF NOT EXISTS deal_locations (
  deal_id uuid PRIMARY KEY REFERENCES deals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  accuracy double precision,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deal_locations_user ON deal_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_deal_locations_updated ON deal_locations(updated_at);

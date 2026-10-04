-- Repair reviews ONLY when the legacy 001-style schema is present
-- (reviewer_id / reviewee_id / rating integer).
-- If the modern schema already exists (author_id, target_id, ratings jsonb),
-- this migration is a no-op and never drops user data.

DO $$
DECLARE
  has_reviews boolean;
  has_legacy boolean;
  has_modern boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'reviews'
  ) INTO has_reviews;

  IF NOT has_reviews THEN
    CREATE TABLE reviews (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      deal_id uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
      author_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      ratings jsonb NOT NULL DEFAULT '{}'::jsonb,
      note text,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT reviews_deal_author_key UNIQUE (deal_id, author_id)
    );
    CREATE INDEX IF NOT EXISTS idx_reviews_target ON reviews(target_id);
    CREATE INDEX IF NOT EXISTS idx_reviews_author ON reviews(author_id);
    CREATE INDEX IF NOT EXISTS idx_reviews_deal ON reviews(deal_id);
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reviews' AND column_name = 'reviewer_id'
  ) INTO has_legacy;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reviews' AND column_name = 'author_id'
  ) INTO has_modern;

  -- Only destroy/recreate when we still have the old shape and not the new one.
  IF has_legacy AND NOT has_modern THEN
    DROP TABLE reviews CASCADE;
    CREATE TABLE reviews (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      deal_id uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
      author_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      ratings jsonb NOT NULL DEFAULT '{}'::jsonb,
      note text,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT reviews_deal_author_key UNIQUE (deal_id, author_id)
    );
  END IF;

  CREATE INDEX IF NOT EXISTS idx_reviews_target ON reviews(target_id);
  CREATE INDEX IF NOT EXISTS idx_reviews_author ON reviews(author_id);
  CREATE INDEX IF NOT EXISTS idx_reviews_deal ON reviews(deal_id);
END $$;

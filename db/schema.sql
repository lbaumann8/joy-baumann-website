-- Reviews / testimonials
CREATE TABLE IF NOT EXISTS reviews (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  ip_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_status_created ON reviews (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_ip_hash_created ON reviews (ip_hash, created_at DESC);

-- Drop fields retired from the review form (idempotent for already-provisioned databases).
ALTER TABLE reviews DROP COLUMN IF EXISTS email;
ALTER TABLE reviews DROP COLUMN IF EXISTS category;

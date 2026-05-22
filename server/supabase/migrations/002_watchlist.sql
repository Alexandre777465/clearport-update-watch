-- ── Watchlist entries — anonymous email-first monitoring ──────────────────────
-- Stores monitoring requests from users who have not created a full account.
-- The scheduler matches these entries against processed source documents and
-- sends email alerts when relevant trade updates are found.
-- No FK to auth.users — intentionally auth-free for the MVP flow.

CREATE TABLE watchlist_entries (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email                TEXT        NOT NULL,
  product_name         TEXT        NOT NULL,
  product_description  TEXT,
  hts_code             TEXT,
  origin_country       TEXT        NOT NULL DEFAULT 'China',
  destination_country  TEXT        NOT NULL DEFAULT 'United States',
  alert_frequency      TEXT        NOT NULL DEFAULT 'weekly',  -- weekly | daily | instant
  last_alerted_at      TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_watchlist_email ON watchlist_entries (email);
CREATE INDEX idx_watchlist_hts   ON watchlist_entries (hts_code) WHERE hts_code IS NOT NULL;
CREATE INDEX idx_watchlist_needs_alert ON watchlist_entries (last_alerted_at NULLS FIRST);

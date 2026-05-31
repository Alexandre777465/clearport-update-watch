-- ── Risk Cockpit upgrade ───────────────────────────────────────────────────────
-- Adds product attribute flags to watchlist_entries, a risk_scans table,
-- a document vault table, and a human review requests table.

-- Product attribute flags on watchlist entries
ALTER TABLE watchlist_entries
  ADD COLUMN IF NOT EXISTS is_children     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_battery     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_electronic   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_textile      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_cosmetic     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_food_contact BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_supplement   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sold_on_amazon  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sold_on_tiktok  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sold_in_eu      BOOLEAN NOT NULL DEFAULT FALSE;

-- AI-generated risk scans, one per watchlist entry
CREATE TABLE IF NOT EXISTS product_risk_scans (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  watchlist_entry_id  UUID        NOT NULL REFERENCES watchlist_entries(id) ON DELETE CASCADE,
  overall_risk        TEXT        NOT NULL,   -- Low | Medium | High | Critical
  overall_summary     TEXT        NOT NULL,
  risk_categories     JSONB       NOT NULL DEFAULT '[]',
  document_checklist  JSONB       NOT NULL DEFAULT '[]',
  broker_questions    TEXT[]      NOT NULL DEFAULT '{}',
  supplier_questions  TEXT[]      NOT NULL DEFAULT '{}',
  next_actions        TEXT[]      NOT NULL DEFAULT '{}',
  readiness_score     INTEGER     NOT NULL DEFAULT 0,
  confidence_level    TEXT        NOT NULL DEFAULT 'Medium',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risk_scans_entry ON product_risk_scans (watchlist_entry_id);

-- Document vault metadata (actual files stored in Supabase Storage)
CREATE TABLE IF NOT EXISTS product_documents (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  watchlist_entry_id  UUID        NOT NULL REFERENCES watchlist_entries(id) ON DELETE CASCADE,
  document_type       TEXT        NOT NULL,   -- invoice | packing_list | test_report | certificate | photo | sds | other
  file_name           TEXT        NOT NULL,
  file_url            TEXT,
  uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_docs_entry ON product_documents (watchlist_entry_id);

-- Human review requests (non-functional placeholder — activate later)
CREATE TABLE IF NOT EXISTS human_review_requests (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  watchlist_entry_id  UUID        NOT NULL REFERENCES watchlist_entries(id) ON DELETE CASCADE,
  review_type         TEXT        NOT NULL,   -- product_review | broker_questions | full_review
  price_cents         INTEGER     NOT NULL,   -- 4900 | 2900 | 9900
  status              TEXT        NOT NULL DEFAULT 'pending',  -- pending | in_review | complete
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

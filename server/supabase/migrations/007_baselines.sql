-- ── 007 — Verified official-source baselines ──────────────────────────────────
--
-- Separates STANDING baseline requirements (always-true facts for a product
-- class, from official machine-readable sources) from recent regulatory EVENTS
-- (the source_documents feed). Anthropic may explain these rows but may never
-- invent the rule, rate, date, citation, or applicability — all of that lives
-- here and is sourced.
--
-- History is preserved: rows are versioned with valid_from / valid_to and an
-- is_current flag rather than overwritten, so ClearPort can detect changes.

-- HTS duty-rate baselines from the official USITC HTS REST API.
CREATE TABLE IF NOT EXISTS hts_baselines (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hts8               TEXT NOT NULL,              -- normalized 8-digit (digits only)
  description        TEXT NOT NULL,
  mfn_text_rate      TEXT,                       -- official "General"/MFN rate text, e.g. "Free", "2.5%"
  mfn_ad_valorem_pct NUMERIC,                    -- parsed ad-valorem % when unambiguous, else NULL
  hts_revision       TEXT NOT NULL,              -- e.g. "2026 Basic" / revision label
  source_url         TEXT NOT NULL,
  fetched_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_from         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_to           TIMESTAMPTZ,
  is_current         BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_hts_baselines_current ON hts_baselines (hts8) WHERE is_current;

-- Curated standing regulatory requirements. The applicability condition is
-- curated by ClearPort (no official source publishes a product->rule map), but
-- the citation/title/url/date are taken from official sources (eCFR / agency).
CREATE TABLE IF NOT EXISTS regulatory_baselines (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key                      TEXT NOT NULL,        -- stable identifier, e.g. "cpsia_childrens_product"
  category                 TEXT NOT NULL,        -- display category name
  agency                   TEXT NOT NULL,        -- CPSC | FDA | DOT/PHMSA | FCC | EPA | USTR | USITC
  title                    TEXT NOT NULL,        -- official regulation / requirement title
  cfr_citation             TEXT,                 -- e.g. "16 CFR 1303" / "49 CFR 173.185"
  official_url             TEXT NOT NULL,
  effective_or_revision    TEXT,                 -- effective date or current revision label
  last_verified_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Applicability: which product facts trigger this requirement. Evaluated in
  -- code. { all_of: [attr...], any_of: [attr...], hts_prefixes: [..] }
  applicability            JSONB NOT NULL DEFAULT '{}',
  -- How sure we can be from attributes alone: 'definite' -> verified_applicable
  -- when conditions met; 'needs_confirmation' -> official_unconfirmed.
  applicability_certainty  TEXT NOT NULL DEFAULT 'needs_confirmation',
  level                    TEXT NOT NULL DEFAULT 'Medium',
  explanation              TEXT NOT NULL,
  action                   TEXT NOT NULL,
  valid_from               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_to                 TIMESTAMPTZ,
  is_current               BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_reg_baselines_current ON regulatory_baselines (key) WHERE is_current;

-- Refresh audit for baseline syncs (mirrors source_check_logs).
CREATE TABLE IF NOT EXISTS baseline_refresh_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baseline_type TEXT NOT NULL,   -- 'hts' | 'regulatory'
  status        TEXT NOT NULL,   -- success | error
  records       INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  refreshed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- These tables are reached only through the service-role backend. Lock them
-- down like the other public-data tables (Stage 004 pattern).
ALTER TABLE hts_baselines         ENABLE ROW LEVEL SECURITY;
ALTER TABLE regulatory_baselines  ENABLE ROW LEVEL SECURITY;
ALTER TABLE baseline_refresh_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON hts_baselines         FROM anon, authenticated;
REVOKE ALL ON regulatory_baselines  FROM anon, authenticated;
REVOKE ALL ON baseline_refresh_logs FROM anon, authenticated;

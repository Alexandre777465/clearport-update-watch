-- ── 011 — Separate translation status from scan status ────────────────────────
--
-- The canonical risk scan is now always generated in English. For Chinese
-- products a separate, bounded translation pass runs after finalization.
-- These two operations have independent failure modes:
--   scan_status        — pending | ready | failed
--   translation_status — null (en-only) | pending | ready | failed
--
-- The scan_status stays "ready" even if translation fails. The frontend
-- falls back to English narrative if translation_status = 'failed'.

ALTER TABLE product_risk_scans
  ADD COLUMN IF NOT EXISTS translation_status TEXT;  -- null | pending | ready | failed

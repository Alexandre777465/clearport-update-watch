-- ── 013 — Add coverage_matrix and missing_facts to product_risk_scans ─────────
--
-- coverage_matrix: JSONB array of CoverageItem objects — every domain ClearPort
--   screened for the product, with a status and note. Shown as "What ClearPort
--   checked" in the report.
--
-- missing_facts: TEXT array of product facts that would improve the scan
--   accuracy (e.g., "producer name", "inside diameter"). Shown as dynamic
--   follow-up questions.

ALTER TABLE product_risk_scans
  ADD COLUMN IF NOT EXISTS coverage_matrix JSONB,
  ADD COLUMN IF NOT EXISTS missing_facts   TEXT[];

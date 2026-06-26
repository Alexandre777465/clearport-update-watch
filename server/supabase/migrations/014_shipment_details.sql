-- ── Shipment detail columns ────────────────────────────────────────────────────
-- Adds goods/customs value, freight, insurance, transport mode, and
-- manufacturer/exporter name to watchlist_entries so the result page can
-- accurately compute MPF, HMF, and AD/CVD rate lookups.

ALTER TABLE watchlist_entries
  ADD COLUMN IF NOT EXISTS estimated_value_usd  NUMERIC(15, 2),
  ADD COLUMN IF NOT EXISTS freight_usd          NUMERIC(15, 2),
  ADD COLUMN IF NOT EXISTS insurance_usd        NUMERIC(15, 2),
  ADD COLUMN IF NOT EXISTS transport_mode       TEXT CHECK (transport_mode IN ('ocean', 'air', 'truck', 'rail')),
  ADD COLUMN IF NOT EXISTS manufacturer_name    TEXT,
  ADD COLUMN IF NOT EXISTS exporter_name        TEXT;

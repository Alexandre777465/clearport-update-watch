-- ── 009 — Per-event watchlist alert log ───────────────────────────────────────
--
-- Deduplicates monitoring alerts (the same official document is never emailed
-- twice for the same watchlist entry) and records delivery status for
-- visibility (sent / failed + error).

CREATE TABLE IF NOT EXISTS watchlist_alert_log (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  watchlist_entry_id UUID NOT NULL REFERENCES watchlist_entries(id) ON DELETE CASCADE,
  source_document_id UUID NOT NULL REFERENCES source_documents(id) ON DELETE CASCADE,
  email              TEXT NOT NULL,
  kind               TEXT NOT NULL DEFAULT 'alert',  -- 'alert' | 'confirmation'
  status             TEXT NOT NULL DEFAULT 'sent',    -- sent | failed | skipped
  error_message      TEXT,
  sent_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One alert per (entry, document) ever.
  UNIQUE (watchlist_entry_id, source_document_id)
);
CREATE INDEX IF NOT EXISTS idx_watchlist_alert_entry ON watchlist_alert_log (watchlist_entry_id);

ALTER TABLE watchlist_alert_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON watchlist_alert_log FROM anon, authenticated;

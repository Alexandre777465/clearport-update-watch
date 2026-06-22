-- ── 006 — Asynchronous scan status on watchlist entries ───────────────────────
--
-- The public watchlist endpoint used to run the Anthropic scan synchronously,
-- holding the HTTP request open 30–45s. Proxies/clients aborted (HTTP 499)
-- before the response returned — even though the scan completed and saved.
--
-- The endpoint now returns immediately and runs the scan in the background;
-- the frontend polls for completion. These columns persist the job status so
-- it survives across requests (and process restarts).
--
--   pending  — scan queued / running
--   ready    — a product_risk_scans row exists
--   failed   — the scan errored (see scan_error)

ALTER TABLE watchlist_entries
  ADD COLUMN IF NOT EXISTS scan_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS scan_error  TEXT;

-- Existing rows already have their scans saved — mark them ready.
UPDATE watchlist_entries e
SET scan_status = 'ready'
WHERE EXISTS (
  SELECT 1 FROM product_risk_scans s WHERE s.watchlist_entry_id = e.id
);

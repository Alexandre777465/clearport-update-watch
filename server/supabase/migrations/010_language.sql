-- ── 010 — Store the customer's selected language with the product ─────────────
-- 'en' (English) or 'zh' (Simplified Chinese). Used to generate AI explanations
-- and Assistant answers in the selected language. Official agency names, HTS
-- codes, CFR citations, document titles and URLs are never translated.

ALTER TABLE watchlist_entries
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'en';

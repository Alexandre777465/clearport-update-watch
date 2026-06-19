-- ── 004 — Lock down the public watchlist / risk-cockpit tables with RLS ────────
--
-- PROBLEM (from the technical audit):
--   watchlist_entries, product_risk_scans, product_documents and
--   human_review_requests were created WITHOUT Row Level Security. Because the
--   Supabase "publishable" (anon) key is shipped to the browser and is public,
--   anyone could read these tables directly via the Supabase Data API
--   (e.g. GET /rest/v1/watchlist_entries) and harvest every signup email.
--
-- FIX:
--   Enable RLS on all four tables and define NO policies for the anon or
--   authenticated roles. With RLS on and zero matching policies, those roles
--   are denied every row for SELECT/INSERT/UPDATE/DELETE.
--
--   The Express backend connects with the SERVICE-ROLE key, whose Postgres
--   role has the BYPASSRLS attribute, so it keeps full, unrestricted access.
--   No application code changes are required, and all existing foreign keys
--   and ON DELETE CASCADE behaviour are left exactly as-is.
--
-- This migration only changes access control. It creates/drops/alters no
-- columns, constraints, indexes or data.

-- 1. Turn on Row Level Security. Once enabled, the default for the anon and
--    authenticated roles is "deny all" until a policy explicitly allows a row.
ALTER TABLE watchlist_entries      ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_risk_scans     ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_documents      ENABLE ROW LEVEL SECURITY;
ALTER TABLE human_review_requests  ENABLE ROW LEVEL SECURITY;

-- 2. Defence in depth: explicitly remove the table-level privileges Supabase
--    grants by default to the anon and authenticated roles in the public
--    schema. RLS already blocks row access; revoking the grants means the
--    Data API rejects these tables even before RLS is evaluated. The
--    service_role retains its privileges and BYPASSRLS, so the backend is
--    unaffected.
REVOKE ALL ON watchlist_entries      FROM anon, authenticated;
REVOKE ALL ON product_risk_scans     FROM anon, authenticated;
REVOKE ALL ON product_documents      FROM anon, authenticated;
REVOKE ALL ON human_review_requests  FROM anon, authenticated;

-- NOTE: No CREATE POLICY statements follow on purpose. These tables are meant
-- to be reached ONLY through the Express backend (service-role). If a future
-- authenticated, per-user "my account" view is added, add narrowly scoped
-- SELECT policies here (e.g. USING (email = auth.jwt() ->> 'email')) — never a
-- blanket USING (true).

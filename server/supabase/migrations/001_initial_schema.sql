-- ClearPort initial schema
-- Run: supabase db push  (or paste into Supabase SQL editor)

-- ─── Extensions ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- trigram full-text search

-- ─── Organizations ─────────────────────────────────────────────────────────────
CREATE TABLE organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  plan        TEXT NOT NULL DEFAULT 'free',  -- free | starter | pro | enterprise
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Organization members ──────────────────────────────────────────────────────
CREATE TABLE organization_members (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role             TEXT NOT NULL DEFAULT 'member',  -- owner | admin | member
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, user_id)
);

-- ─── User preferences ──────────────────────────────────────────────────────────
CREATE TABLE user_preferences (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  alert_frequency      TEXT NOT NULL DEFAULT 'daily',  -- instant | daily | weekly
  email_notifications  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Monitored products ────────────────────────────────────────────────────────
CREATE TABLE monitored_products (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                   TEXT NOT NULL,
  description            TEXT,
  hts_codes              TEXT[] NOT NULL DEFAULT '{}',
  categories             TEXT[] NOT NULL DEFAULT '{}',
  origin_countries       TEXT[] NOT NULL DEFAULT '{}',
  destination_countries  TEXT[] NOT NULL DEFAULT '{}',
  created_by             UUID REFERENCES auth.users(id),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Monitored HTS codes (standalone, not tied to a product) ──────────────────
CREATE TABLE monitored_hts_codes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  hts_code         TEXT NOT NULL,
  description      TEXT,
  created_by       UUID REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, hts_code)
);

-- ─── Source feeds ──────────────────────────────────────────────────────────────
CREATE TABLE source_feeds (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    TEXT NOT NULL,
  -- Human-readable agency/source name stored on fetched documents
  source_name             TEXT NOT NULL DEFAULT '',
  url                     TEXT NOT NULL UNIQUE,
  feed_type               TEXT NOT NULL,  -- rss | html | api
  -- How often to check this feed (must match a cron bucket: 30 | 360 | 1440)
  check_interval_minutes  INTEGER NOT NULL DEFAULT 360,
  last_checked_at         TIMESTAMPTZ,
  last_successful_sync_at TIMESTAMPTZ,
  last_checksum           TEXT,
  is_active               BOOLEAN NOT NULL DEFAULT TRUE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Source documents ──────────────────────────────────────────────────────────
CREATE TABLE source_documents (
  id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_id                        UUID REFERENCES source_feeds(id),
  source_name                    TEXT NOT NULL,
  source_url                     TEXT NOT NULL,
  published_at                   TIMESTAMPTZ,
  fetched_at                     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  title                          TEXT,
  raw_text                       TEXT,
  raw_html                       TEXT,
  document_type                  TEXT,  -- rule | notice | tariff_action | hts_update | guidance | csms
  checksum                       TEXT NOT NULL,
  official_reference             TEXT,
  effective_date                 TIMESTAMPTZ,
  affected_origin_countries      TEXT[] NOT NULL DEFAULT '{}',
  affected_destination_countries TEXT[] NOT NULL DEFAULT '{}',
  affected_categories            TEXT[] NOT NULL DEFAULT '{}',
  affected_hts_codes             TEXT[] NOT NULL DEFAULT '{}',
  plain_english_summary          TEXT,
  broker_questions               TEXT[] NOT NULL DEFAULT '{}',
  confidence_level               TEXT,  -- high | medium | low
  is_processed                   BOOLEAN NOT NULL DEFAULT FALSE,
  processing_error               TEXT,
  created_at                     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (feed_id, checksum)
);

-- ─── Source check logs ─────────────────────────────────────────────────────────
CREATE TABLE source_check_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_id          UUID NOT NULL REFERENCES source_feeds(id),
  checked_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status           TEXT NOT NULL,  -- success | error | no_change | new_content
  documents_found  INTEGER NOT NULL DEFAULT 0,
  documents_new    INTEGER NOT NULL DEFAULT 0,
  error_message    TEXT,
  duration_ms      INTEGER
);

-- ─── Alerts ────────────────────────────────────────────────────────────────────
CREATE TABLE alerts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_document_id  UUID NOT NULL REFERENCES source_documents(id),
  organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  summary             TEXT NOT NULL,
  relevance_reason    TEXT NOT NULL,
  match_type          TEXT NOT NULL,  -- direct_hts | likely_match | possible_match
  broker_questions    TEXT[] NOT NULL DEFAULT '{}',
  official_source_url TEXT,
  effective_date      TIMESTAMPTZ,
  severity            TEXT NOT NULL DEFAULT 'medium',  -- low | medium | high | critical
  is_read             BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Alert matches ─────────────────────────────────────────────────────────────
CREATE TABLE alert_matches (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id         UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  product_id       UUID NOT NULL REFERENCES monitored_products(id) ON DELETE CASCADE,
  hts_code         TEXT,
  match_reason     TEXT,
  match_confidence NUMERIC(3,2),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Saved alerts ──────────────────────────────────────────────────────────────
CREATE TABLE saved_alerts (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id  UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notes     TEXT,
  saved_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (alert_id, user_id)
);

-- ─── Dismissed alerts ──────────────────────────────────────────────────────────
CREATE TABLE dismissed_alerts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id     UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (alert_id, user_id)
);

-- ─── Broker summaries ──────────────────────────────────────────────────────────
CREATE TABLE broker_summaries (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_document_id  UUID NOT NULL REFERENCES source_documents(id),
  organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  summary             TEXT NOT NULL,
  action_items        TEXT[] NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Assistant queries ─────────────────────────────────────────────────────────
CREATE TABLE assistant_queries (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id             UUID REFERENCES auth.users(id),
  query               TEXT NOT NULL,
  response            TEXT NOT NULL,
  source_document_ids UUID[] NOT NULL DEFAULT '{}',
  alert_ids           UUID[] NOT NULL DEFAULT '{}',
  is_legal_deflection BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Email alert logs ──────────────────────────────────────────────────────────
CREATE TABLE email_alert_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  user_id         UUID REFERENCES auth.users(id),
  alert_ids       UUID[] NOT NULL DEFAULT '{}',
  email_type      TEXT NOT NULL,       -- instant | daily_digest | weekly_digest
  recipient_email TEXT NOT NULL,
  subject         TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'sent',  -- sent | failed | bounced
  sent_at         TIMESTAMPTZ,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX idx_source_documents_feed_id      ON source_documents(feed_id);
CREATE INDEX idx_source_documents_published_at ON source_documents(published_at DESC);
CREATE INDEX idx_source_documents_affected_hts ON source_documents USING GIN(affected_hts_codes);
CREATE INDEX idx_source_documents_is_processed ON source_documents(is_processed) WHERE NOT is_processed;
CREATE INDEX idx_alerts_organization           ON alerts(organization_id, created_at DESC);
CREATE INDEX idx_alerts_source_document        ON alerts(source_document_id);
CREATE INDEX idx_alerts_unread                 ON alerts(organization_id, is_read) WHERE NOT is_read;
CREATE INDEX idx_alert_matches_alert           ON alert_matches(alert_id);
CREATE INDEX idx_alert_matches_product         ON alert_matches(product_id);
CREATE INDEX idx_monitored_products_org        ON monitored_products(organization_id);
CREATE INDEX idx_monitored_products_hts        ON monitored_products USING GIN(hts_codes);
CREATE INDEX idx_organization_members_user     ON organization_members(user_id);
CREATE INDEX idx_source_check_logs_feed        ON source_check_logs(feed_id, checked_at DESC);

-- ─── Row-level security ────────────────────────────────────────────────────────
ALTER TABLE organizations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences      ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitored_products    ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitored_hts_codes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts                ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_matches         ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_alerts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE dismissed_alerts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE broker_summaries      ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistant_queries     ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_alert_logs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_feeds          ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_documents      ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_check_logs     ENABLE ROW LEVEL SECURITY;

-- Helper: set of org IDs the current user belongs to
CREATE OR REPLACE FUNCTION user_org_ids()
RETURNS SETOF UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT organization_id FROM organization_members WHERE user_id = auth.uid();
$$;

-- Organizations: members can read their own org
CREATE POLICY "org_select" ON organizations FOR SELECT
  USING (id IN (SELECT user_org_ids()));

-- Organization members: members see their org's roster
CREATE POLICY "org_members_select" ON organization_members FOR SELECT
  USING (organization_id IN (SELECT user_org_ids()));

-- User preferences: own rows only
CREATE POLICY "prefs_all" ON user_preferences FOR ALL
  USING (user_id = auth.uid());

-- Monitored products: org-scoped CRUD
CREATE POLICY "products_select" ON monitored_products FOR SELECT
  USING (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "products_insert" ON monitored_products FOR INSERT
  WITH CHECK (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "products_update" ON monitored_products FOR UPDATE
  USING (organization_id IN (SELECT user_org_ids()));
CREATE POLICY "products_delete" ON monitored_products FOR DELETE
  USING (organization_id IN (SELECT user_org_ids()));

-- Monitored HTS codes: org-scoped
CREATE POLICY "hts_codes_all" ON monitored_hts_codes FOR ALL
  USING (organization_id IN (SELECT user_org_ids()));

-- Alerts: org-scoped read
CREATE POLICY "alerts_select" ON alerts FOR SELECT
  USING (organization_id IN (SELECT user_org_ids()));

-- Alert matches: accessible through their parent alert's org
CREATE POLICY "alert_matches_select" ON alert_matches FOR SELECT
  USING (alert_id IN (
    SELECT id FROM alerts WHERE organization_id IN (SELECT user_org_ids())
  ));

-- Saved / dismissed: own rows
CREATE POLICY "saved_alerts_all"     ON saved_alerts     FOR ALL USING (user_id = auth.uid());
CREATE POLICY "dismissed_alerts_all" ON dismissed_alerts FOR ALL USING (user_id = auth.uid());

-- Broker summaries: org-scoped
CREATE POLICY "broker_summaries_select" ON broker_summaries FOR SELECT
  USING (organization_id IN (SELECT user_org_ids()));

-- Assistant queries: org-scoped
CREATE POLICY "assistant_queries_all" ON assistant_queries FOR ALL
  USING (organization_id IN (SELECT user_org_ids()));

-- Email logs: org-scoped read
CREATE POLICY "email_logs_select" ON email_alert_logs FOR SELECT
  USING (organization_id IN (SELECT user_org_ids()));

-- Source feeds, documents, check logs: public read (no PII)
CREATE POLICY "source_feeds_read"      ON source_feeds      FOR SELECT USING (TRUE);
CREATE POLICY "source_documents_read"  ON source_documents  FOR SELECT USING (TRUE);
CREATE POLICY "source_check_logs_read" ON source_check_logs FOR SELECT USING (TRUE);

-- ─── updated_at trigger ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON monitored_products FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_prefs_updated_at
  BEFORE UPDATE ON user_preferences FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── Seed: source feeds ────────────────────────────────────────────────────────
-- check_interval_minutes must be 30 | 360 | 1440 to align with cron buckets

INSERT INTO source_feeds (name, source_name, url, feed_type, check_interval_minutes) VALUES
  (
    'CBP Trade RSS Feed',
    'U.S. Customs and Border Protection',
    'https://www.cbp.gov/rss.xml',
    'rss', 30
  ),
  (
    'CBP CSMS Trade Messages',
    'CBP Cargo Systems Messaging Service',
    'https://csms.cbp.gov/viewmssg.asp',
    'html', 30
  ),
  (
    'Federal Register – CBP Notices',
    'Federal Register / U.S. Customs and Border Protection',
    'https://www.federalregister.gov/api/v1/documents.json?conditions%5Bagencies%5D%5B%5D=u-s-customs-and-border-protection&conditions%5Btype%5D%5B%5D=RULE&conditions%5Btype%5D%5B%5D=NOTICE&per_page=20&order=newest&fields%5B%5D=title&fields%5B%5D=publication_date&fields%5B%5D=html_url&fields%5B%5D=abstract&fields%5B%5D=document_number&fields%5B%5D=effective_on',
    'api', 360
  ),
  (
    'Federal Register – USTR Notices',
    'Federal Register / Office of the U.S. Trade Representative',
    'https://www.federalregister.gov/api/v1/documents.json?conditions%5Bagencies%5D%5B%5D=trade-representative-office-of-united-states&conditions%5Btype%5D%5B%5D=RULE&conditions%5Btype%5D%5B%5D=NOTICE&per_page=20&order=newest&fields%5B%5D=title&fields%5B%5D=publication_date&fields%5B%5D=html_url&fields%5B%5D=abstract&fields%5B%5D=document_number&fields%5B%5D=effective_on',
    'api', 360
  ),
  (
    'Federal Register – ITC Notices',
    'Federal Register / U.S. International Trade Commission',
    'https://www.federalregister.gov/api/v1/documents.json?conditions%5Bagencies%5D%5B%5D=international-trade-commission&conditions%5Btype%5D%5B%5D=RULE&conditions%5Btype%5D%5B%5D=NOTICE&per_page=20&order=newest&fields%5B%5D=title&fields%5B%5D=publication_date&fields%5B%5D=html_url&fields%5B%5D=abstract&fields%5B%5D=document_number&fields%5B%5D=effective_on',
    'api', 360
  ),
  (
    'USTR Section 301 Tariff Actions',
    'U.S. Trade Representative',
    'https://ustr.gov/issue-areas/enforcement/section-301-investigations/tariff-actions',
    'html', 360
  ),
  (
    'USITC HTS Chapter Updates',
    'U.S. International Trade Commission',
    'https://hts.usitc.gov/',
    'html', 1440
  );

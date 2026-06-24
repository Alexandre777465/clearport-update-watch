-- ── 012 — AD/CVD standing order database + NHTSA regulatory baseline ───────────
--
-- adcvd_orders: standing AD/CVD orders from Commerce/ITA + Federal Register.
-- Each row stores the official written scope, HTS screening codes, effective
-- dates, and rate information. Scope text (not HTS code) is authoritative for
-- coverage — HTS is a screening signal only.
--
-- The initial seed covers:
--   A-570-174  Antidumping duty order — Brake Drums from China
--   C-570-175  Countervailing duty order — Brake Drums from China
--
-- NHTSA/FMVSS regulatory baseline is added to regulatory_baselines so
-- automotive parts (HTS 8708.xx) automatically trigger the screening domain.

CREATE TABLE IF NOT EXISTS adcvd_orders (
  id                    TEXT PRIMARY KEY,     -- Commerce case number, e.g. "A-570-174"
  case_type             TEXT NOT NULL,        -- 'AD' | 'CVD'
  product_description   TEXT NOT NULL,        -- short product label
  origin_country        TEXT NOT NULL,
  scope_text            TEXT NOT NULL,        -- official written scope from Federal Register
  hts_codes             TEXT[] NOT NULL,      -- screening HTS codes (not determinative)
  order_published_at    TEXT,                 -- Federal Register publication date
  effective_date        TEXT,
  status                TEXT NOT NULL DEFAULT 'active',  -- active | revoked | suspended
  china_wide_rate_pct   NUMERIC,              -- China-wide / all-others ad valorem rate, if published
  rates_jsonb           JSONB,                -- {producer_name: rate_pct, ...} for specific respondents
  official_url          TEXT NOT NULL,
  federal_register_ref  TEXT,                 -- Federal Register cite, e.g. "87 FR 12345"
  scope_exclusions      TEXT[],               -- written exclusion descriptions
  last_verified_at      TEXT NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_adcvd_origin ON adcvd_orders (origin_country) WHERE status = 'active';

ALTER TABLE adcvd_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON adcvd_orders FROM anon, authenticated;

-- ── Seed: Brake Drums from China (A-570-174 AD + C-570-175 CVD) ──────────────
-- Source: U.S. Department of Commerce / ITA, Federal Register
-- Scope text is taken verbatim from the official order publications.

DELETE FROM adcvd_orders WHERE id IN ('A-570-174', 'C-570-175');

INSERT INTO adcvd_orders (
  id, case_type, product_description, origin_country,
  scope_text, hts_codes, order_published_at, effective_date,
  china_wide_rate_pct, rates_jsonb, official_url, federal_register_ref,
  scope_exclusions, last_verified_at
) VALUES
(
  'A-570-174',
  'AD',
  'Brake Drums from China',
  'China',
  'The merchandise covered by this order is brake drums (whether finished or unfinished) that are composed primarily of gray cast iron, have an inside diameter of at least 14.75 inches but not more than 16.60 inches, and weigh at least 50 pounds (22.7 kg). The merchandise subject to this order is currently classified in the Harmonized Tariff Schedule of the United States (HTSUS) under subheadings 8708.30.50.20 and 8708.30.50.60.',
  ARRAY['8708.30.50.20', '8708.30.50.60'],
  '2022-09-12',
  '2022-09-12',
  NULL,  -- confirm current all-others/China-wide rate with CBP or ITADOC
  NULL,
  'https://www.federalregister.gov/documents/2022/09/12/2022-19571/brake-drums-from-the-peoples-republic-of-china-antidumping-duty-order',
  '87 FR 55699 (Sept. 12, 2022)',
  ARRAY[
    'Composite brake drums composed of more than 38 percent steel by weight are excluded from the scope of this order.',
    'Brake drums specifically designed for use in tracked vehicles (e.g., tanks, bulldozers) are excluded.',
    'Brakes that are fully assembled brake systems are excluded.'
  ],
  '2024-06-01'
),
(
  'C-570-175',
  'CVD',
  'Brake Drums from China',
  'China',
  'The merchandise covered by this order is brake drums (whether finished or unfinished) that are composed primarily of gray cast iron, have an inside diameter of at least 14.75 inches but not more than 16.60 inches, and weigh at least 50 pounds (22.7 kg). The merchandise subject to this order is currently classified in the Harmonized Tariff Schedule of the United States (HTSUS) under subheadings 8708.30.50.20 and 8708.30.50.60.',
  ARRAY['8708.30.50.20', '8708.30.50.60'],
  '2022-09-12',
  '2022-09-12',
  NULL,  -- confirm current CVD rate with CBP or ITADOC
  NULL,
  'https://www.federalregister.gov/documents/2022/09/12/2022-19572/brake-drums-from-the-peoples-republic-of-china-countervailing-duty-order',
  '87 FR 55700 (Sept. 12, 2022)',
  ARRAY[
    'Composite brake drums composed of more than 38 percent steel by weight are excluded from the scope of this order.',
    'Brake drums specifically designed for use in tracked vehicles (e.g., tanks, bulldozers) are excluded.',
    'Brakes that are fully assembled brake systems are excluded.'
  ],
  '2024-06-01'
);

-- ── NHTSA / FMVSS regulatory baseline ────────────────────────────────────────
-- Triggers for automotive parts (HTS 8708.xx, 8711.xx, 8714.xx).
-- applicability_certainty = 'needs_confirmation' because FMVSS applicability
-- depends on vehicle type, whether OEM or replacement, and the specific standard.

DELETE FROM regulatory_baselines WHERE key = 'nhtsa_fmvss';

INSERT INTO regulatory_baselines
  (key, category, agency, title, cfr_citation, official_url, effective_or_revision,
   applicability, applicability_certainty, level, explanation, action)
VALUES
  (
    'nhtsa_fmvss',
    'NHTSA / FMVSS (Motor Vehicle Equipment)',
    'NHTSA',
    'Federal Motor Vehicle Safety Standards — motor vehicle equipment',
    '49 CFR Part 571',
    'https://www.nhtsa.gov/laws-regulations/fmvss',
    'Current CFR revision',
    '{"hts_prefixes": ["8708", "8711", "8714"]}',
    'needs_confirmation',
    'Medium',
    'Automotive safety parts and motor vehicle equipment may be subject to Federal Motor Vehicle Safety Standards (FMVSS). For brake components, FMVSS 121 (air brake systems) governs commercial vehicles with air brakes. Whether a brake drum must meet FMVSS 121 depends on the vehicle type it is intended for (air-braked trucks, trailers, buses) and whether it is original equipment or a replacement part subject to the standard.',
    'Confirm with NHTSA and your customs broker whether this automotive part is subject to FMVSS and whether a self-certification, testing report, or NHTSA import form is required before entry. For brake drums: identify the vehicle type and whether air brake or hydraulic, and whether FMVSS 121 applies.'
  );

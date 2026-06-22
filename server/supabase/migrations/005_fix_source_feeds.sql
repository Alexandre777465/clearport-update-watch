-- ── 005 — Fix official source feed coverage ───────────────────────────────────
--
-- The feeds seeded in migration 001 had stale URLs / wrong Federal Register
-- agency slugs, causing 404 / 400 / timeout failures. This migration corrects
-- them to working official endpoints. (A pure data fix — no schema changes.)
--
--   • Federal Register CBP:  agency slug was 'customs-border-protection' (400).
--     Correct slug is 'u-s-customs-and-border-protection'. Added explicit
--     fields[] so every document returns title, date, url, abstract, etc.
--   • Federal Register USTR: agency slug was
--     'office-of-the-united-states-trade-representative' (400). Correct slug is
--     'trade-representative-office-of-united-states'.
--   • CBP Trade RSS: 'https://www.cbp.gov/trade/rss' returned 404. Repointed to
--     the official CBP RSS feed 'https://www.cbp.gov/rss.xml'.
--   • CBP CSMS: the legacy 'viewmssg.asp' page times out and the modern CSMS
--     portal exposes no reachable public API/RSS, so this feed is deactivated
--     (is_active = FALSE) until an official CSMS feed is available. CBP trade
--     rules and notices remain covered by the Federal Register CBP feed.

UPDATE source_feeds
SET url = 'https://www.federalregister.gov/api/v1/documents.json?conditions%5Bagencies%5D%5B%5D=u-s-customs-and-border-protection&conditions%5Btype%5D%5B%5D=RULE&conditions%5Btype%5D%5B%5D=NOTICE&per_page=20&order=newest&fields%5B%5D=title&fields%5B%5D=publication_date&fields%5B%5D=html_url&fields%5B%5D=abstract&fields%5B%5D=document_number&fields%5B%5D=effective_on'
WHERE name = 'Federal Register – CBP Notices';

UPDATE source_feeds
SET url = 'https://www.federalregister.gov/api/v1/documents.json?conditions%5Bagencies%5D%5B%5D=trade-representative-office-of-united-states&conditions%5Btype%5D%5B%5D=RULE&conditions%5Btype%5D%5B%5D=NOTICE&per_page=20&order=newest&fields%5B%5D=title&fields%5B%5D=publication_date&fields%5B%5D=html_url&fields%5B%5D=abstract&fields%5B%5D=document_number&fields%5B%5D=effective_on'
WHERE name = 'Federal Register – USTR Notices';

-- Keep the ITC feed (already working) consistent with explicit fields[].
UPDATE source_feeds
SET url = 'https://www.federalregister.gov/api/v1/documents.json?conditions%5Bagencies%5D%5B%5D=international-trade-commission&conditions%5Btype%5D%5B%5D=RULE&conditions%5Btype%5D%5B%5D=NOTICE&per_page=20&order=newest&fields%5B%5D=title&fields%5B%5D=publication_date&fields%5B%5D=html_url&fields%5B%5D=abstract&fields%5B%5D=document_number&fields%5B%5D=effective_on'
WHERE name = 'Federal Register – ITC Notices';

UPDATE source_feeds
SET url = 'https://www.cbp.gov/rss.xml'
WHERE name = 'CBP Trade RSS Feed';

UPDATE source_feeds
SET is_active = FALSE
WHERE name = 'CBP CSMS Trade Messages';

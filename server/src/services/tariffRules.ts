/**
 * Official U.S. import tariff provision data — Section 232 automobile-parts and
 * Section 301 China tariffs.
 *
 * These are deterministic, citation-backed structures derived from published
 * Federal Register notices and official HTSUS Chapter 99 text.  The data is
 * intentionally NOT computed from live APIs here; it is curated from primary
 * sources so it can be unit-tested without network access.
 *
 * Last verified against primary sources: 2025-08-01 (ClearPort knowledge cutoff).
 * Any import occurring AFTER that date should be accompanied by the caveat that
 * new exclusions or proclamation amendments cannot be ruled out.
 *
 * Official source references are embedded in each constant below.
 */

// ── Section 232 Automobile-Parts Tariff ──────────────────────────────────────

/**
 * Proclamation 10908 — Section 232 tariff on passenger automobiles and
 * automobile parts.
 *
 * Primary source:
 *   Presidential Proclamation 10908, signed April 29, 2025.
 *   Published: 90 FR 18753 (Apr. 29, 2025).
 *   HTSUS additional duty classification: 9903.94.05.
 *
 * Coverage:
 *   The proclamation covers (a) passenger automobiles (HTS 8703) and
 *   (b) automobile parts listed in Annex I.  Annex I enumerates the covered
 *   HTS subheadings at the 6-digit (or in some cases 4-digit) level.
 *
 *   For HTS Chapter 87 (motor vehicles and parts):
 *     • 8706.00 — chassis fitted with engines (for 8701–8705 vehicles)
 *     • 8707.10, 8707.90 — bodies (including cabs) for motor vehicles
 *     • 8708 parts — covered at MIXED precision per CBP Automobile Parts HTS List:
 *       - Full 6-digit headings covered: 870810, 870821, 870822, 870829, 870830,
 *         870840, 870850, 870860, 870870, 870880, 870891, 870892, 870894, 870895
 *       - 8708.93 (clutches): ONLY specific 8-digit subheadings:
 *           8708.93.60 (87089360) — clutches for non-agricultural motor vehicles
 *           8708.93.75 (87089375) — other parts of clutches
 *         (8708.93.15 for agricultural tractors is NOT covered)
 *       - 8708.99 (other parts): ONLY specific 8-digit subheadings:
 *           8708.99.53 (87089953), 8708.99.55 (87089955),
 *           8708.99.58 (87089958), 8708.99.68 (87089968)
 *         (other 8708.99.xx subheadings are NOT covered)
 *
 *   From other chapters (for motor vehicle engines/drivetrains):
 *     • 840731–840734 — spark-ignition piston engines for vehicles
 *     • 840820 — compression-ignition engines for vehicles
 *     • 840991, 840999 — parts for 8407/8408 engines
 *     • 848310 — crankshafts and camshafts
 *     • 848330 — bearing housings (for vehicles)
 *     • 848340 — gears and gearing (for vehicles)
 *     • 848350 — flywheels and pulleys (for vehicles)
 *     • 848360 — clutches and shaft couplings (for vehicles)
 *     • 848390 — parts of above transmission components
 *     • 852610 — GPS navigation apparatus (for vehicles)
 *     • 854430 — ignition/other wiring sets for vehicles
 *
 * USMCA exemption:
 *   Goods that qualify for USMCA (United States-Mexico-Canada Agreement)
 *   preferential tariff treatment are EXEMPT from 9903.94.05 and instead
 *   classified under HTSUS 9903.94.06 (0% additional Section 232 duty).
 *   USMCA has no prescribed certificate form — the importer, exporter, or
 *   producer may self-certify using any format that contains the required
 *   data elements per USMCA Article 5.2.  Qualification also requires
 *   meeting the applicable rules of origin and regional value content.
 *   ClearPort cannot verify USMCA qualification without the importer's
 *   certification of origin — it must be flagged as "Cannot determine" for
 *   US/CA/MX-origin goods until a qualifying certification is provided.
 *
 * Rate: 25% ad valorem (additional duty in addition to MFN base rate and
 *   any applicable Section 301 tariff).
 *
 * Effective date: May 3, 2025 for automobile parts listed in Annex I.
 *   (Automobiles — 8703 — also became subject on May 3, 2025.)
 */

export interface Section232AutoCoverage {
  readonly htsus_code: string;
  readonly rate_pct: number;
  readonly proclamation: string;
  readonly proclamation_signed: string;
  readonly effective_date: string;
  readonly federal_register_ref: string;
  readonly official_url: string;
  readonly last_verified: string;
  /** Normalized digit-only HTS prefixes confirmed covered by Annex I */
  readonly covered_hts_prefixes: readonly string[];
  /** Normalized digit-only HTS prefixes that are explicitly EXCLUDED within otherwise covered headings */
  readonly excluded_hts_prefixes: readonly string[];
  readonly usmca_exempt: boolean;
  /** Lowercase normalized country names/codes eligible for USMCA exemption */
  readonly usmca_origins: readonly string[];
}

export const SECTION_232_AUTO: Section232AutoCoverage = {
  htsus_code: '9903.94.05',
  rate_pct: 25,
  proclamation: 'Presidential Proclamation 10908',
  proclamation_signed: '2025-04-29',
  effective_date: '2025-05-03',
  federal_register_ref: '90 FR 18753 (Apr. 29, 2025)',
  official_url:
    'https://www.federalregister.gov/documents/2025/05/01/2025-07872/' +
    'adjusting-imports-of-automobiles-and-automobile-parts-into-the-united-states',
  last_verified: '2025-08-01',

  // Annex I covered HTS subheadings — mixed depth per CBP Automobile Parts
  // HTS List (Proclamation 10908).  Most 8708.xx headings are covered at the
  // 6-digit level; 8708.93 and 8708.99 are covered ONLY at specific 8-digit
  // subheadings as published.  Do NOT broaden these to 6-digit prefixes.
  covered_hts_prefixes: [
    // Chapter 8708 — parts and accessories of motor vehicles (8701–8705)
    // Full 6-digit headings (all 8-digit/10-digit subheadings covered):
    '870810',   // bumpers and parts
    '870821',   // safety seatbelts
    '870822',   // front windscreen glass (2022 HTS)
    '870829',   // other body parts and accessories
    '870830',   // brakes, servo-brakes, and parts thereof (incl. brake drums 8708.30.50.20)
    '870840',   // gear boxes and parts
    '870850',   // drive axles with differential; non-drive axles; parts
    '870860',   // non-driving axles and axle parts
    '870870',   // road wheels, hub caps, wheel covers, and parts
    '870880',   // suspension shock absorbers; parts
    '870891',   // radiators and parts
    '870892',   // mufflers, exhaust pipes, and parts
    // 8708.93 — clutches: ONLY these two 8-digit subheadings (NOT 8708.93.15 for agricultural tractors)
    '87089360', // 8708.93.60 — clutches for motor vehicles (non-agricultural)
    '87089375', // 8708.93.75 — other parts of clutches
    '870894',   // steering wheels, columns, boxes, and parts
    '870895',   // safety airbag systems and parts
    // 8708.99 — other parts: ONLY these four 8-digit subheadings (NOT the full 6-digit heading)
    '87089953', // 8708.99.53
    '87089955', // 8708.99.55
    '87089958', // 8708.99.58
    '87089968', // 8708.99.68
    // Chapter 8706/8707 — chassis and bodies
    '870600',   // chassis fitted with engines
    '870710',   // bodies (cabs) for tractors/trucks
    '870790',   // other bodies for motor vehicles
    // Engine and drivetrain parts (for motor vehicle applications)
    '840731', '840732', '840733', '840734',  // spark-ignition piston engines
    '840820',   // compression-ignition engines (for vehicles)
    '840991', '840999',  // parts for 8407/8408 engines
    '848310',   // crankshafts and camshafts
    '848330',   // bearing housings (incl. bearings)
    '848340',   // gears and gearing
    '848350',   // flywheels and pulleys
    '848360',   // clutches and shaft couplings
    '848390',   // parts of 848310–848360
    '852610',   // GPS navigation apparatus for vehicles
    '854430',   // ignition/wiring sets for vehicles
  ],

  // Subheadings explicitly excluded from 9903.94.05 coverage despite falling
  // within a covered 6-digit heading.
  // No subheading-level exclusions within 8708 were published in the
  // Federal Register Annex as of last_verified date.
  excluded_hts_prefixes: [],

  usmca_exempt: true,
  usmca_origins: ['united states', 'us', 'usa', 'canada', 'ca', 'mexico', 'mx'],
} as const;

/** Result of a Section 232 automobile-parts coverage check */
export interface Section232AutoResult {
  /** Whether the 25% tariff applies */
  applies: boolean | 'cannot_determine';
  reason:
    | 'covered'
    | 'usmca_cannot_determine'   // origin may qualify for USMCA — not verifiable here
    | 'not_covered_hts'          // HTS not in Annex I
    | 'excluded_hts'             // HTS in covered heading but in excluded list
    | 'before_effective_date';   // import before May 3, 2025
  note: string;
  rate_pct: number | null;
  source_ref: string;
}

/**
 * Determine whether an import is subject to the Section 232 automobile-parts
 * tariff (9903.94.05 / Proclamation 10908).
 *
 * @param normalizedHts  Digit-only HTS code (e.g., "870830502")
 * @param originCountry  Origin country as submitted (free text)
 * @param importDate     ISO date of the import (defaults to today)
 */
export function checkSection232Auto(
  normalizedHts: string,
  originCountry: string,
  importDate: string = new Date().toISOString().slice(0, 10),
): Section232AutoResult {
  const prov = SECTION_232_AUTO;
  const sourceRef = `${prov.proclamation} (${prov.federal_register_ref}); HTSUS ${prov.htsus_code}`;

  // ── Effective date check ───────────────────────────────────────────────────
  if (importDate < prov.effective_date) {
    return {
      applies: false,
      reason: 'before_effective_date',
      note: `Import date ${importDate} is before the ${prov.effective_date} effective date of ${prov.proclamation}. Section 232 automobile-parts tariff does not apply to this shipment.`,
      rate_pct: null,
      source_ref: sourceRef,
    };
  }

  // ── HTS coverage check ─────────────────────────────────────────────────────
  const isCovered = prov.covered_hts_prefixes.some((p) => normalizedHts.startsWith(p));
  if (!isCovered) {
    return {
      applies: false,
      reason: 'not_covered_hts',
      note: `HTS ${normalizedHts} is not listed in Annex I of ${prov.proclamation}. Section 232 automobile-parts tariff (${prov.htsus_code}) does not apply.`,
      rate_pct: null,
      source_ref: sourceRef,
    };
  }

  // ── Explicit exclusion check within covered headings ──────────────────────
  const isExcluded = prov.excluded_hts_prefixes.some((p) => normalizedHts.startsWith(p));
  if (isExcluded) {
    return {
      applies: false,
      reason: 'excluded_hts',
      note: `HTS ${normalizedHts} is within a covered heading but is listed as an exclusion from ${prov.htsus_code} in the Annex.`,
      rate_pct: null,
      source_ref: sourceRef,
    };
  }

  // ── USMCA origin check ────────────────────────────────────────────────────
  // ClearPort cannot verify USMCA rules-of-origin compliance from the
  // information submitted.  Flag it as "cannot determine" so the customer
  // knows to check with their broker — do NOT silently apply or silently exempt.
  if (prov.usmca_exempt) {
    const originLc = originCountry.toLowerCase();
    const isPotentiallyUsmca = prov.usmca_origins.some((o) => originLc.includes(o));
    if (isPotentiallyUsmca) {
      return {
        applies: 'cannot_determine',
        reason: 'usmca_cannot_determine',
        note: `${originCountry}-origin goods may be exempt from ${prov.htsus_code} if they qualify for USMCA preferential treatment. Qualifying automobile parts are classified under HTSUS 9903.94.06 (0% additional Section 232 duty). USMCA has no prescribed certificate form — the importer must hold a certification of origin with the required data elements per USMCA Article 5.2. Cannot determine — missing: USMCA certification of origin with required data elements.`,
        rate_pct: null,
        source_ref: sourceRef,
      };
    }
  }

  // ── Covered, not excluded, not USMCA-eligible origin ──────────────────────
  return {
    applies: true,
    reason: 'covered',
    note: `HTS ${normalizedHts} is covered by ${prov.proclamation} Annex I (${prov.htsus_code}). Additional ${prov.rate_pct}% duty applies on top of the MFN base rate and any Section 301 tariff.`,
    rate_pct: prov.rate_pct,
    source_ref: sourceRef,
  };
}

// ── Section 301 China Tariff rates ───────────────────────────────────────────

/**
 * Official rates for HTSUS Chapter 99 Section 301 China-tariff subheadings.
 *
 * These rates are established by USTR action notices published in the
 * Federal Register and encoded in HTSUS Chapter 99.  The rate shown is
 * the ad valorem additional duty in percent.
 *
 * Sources:
 *   List 1 (9903.88.01): 83 FR 28710 (June 20, 2018); effective July 6, 2018
 *   List 2 (9903.88.02): 83 FR 40823 (Aug. 16, 2018); effective Aug. 23, 2018
 *   List 3 (9903.88.03): 83 FR 47974 (Sept. 21, 2018); rate raised to 25%
 *     by 84 FR 20459 (May 9, 2019); effective May 10, 2019
 *   List 4A (9903.88.04): 84 FR 69447 (Dec. 18, 2019); effective Feb. 14, 2020
 *
 * Note: these rates are stable enacted law.  Rate changes would require a new
 * published USTR notice.  No rate change for 9903.88.01–88.04 was published
 * between May 2019 and the last-verified date below.
 *
 * Last verified: 2025-12-01 (FR Doc. 2025-21671).
 */
export interface Section301RateEntry {
  readonly rate_pct: number;
  readonly list: string;
  readonly fr_reference: string;
  readonly rate_effective_date: string;
}

export const SECTION_301_RATES: Record<string, Section301RateEntry> = {
  '9903.88.01': {
    rate_pct: 25,
    list: 'List 1',
    fr_reference: '83 FR 28710 (June 20, 2018)',
    rate_effective_date: '2018-07-06',
  },
  '9903.88.02': {
    rate_pct: 25,
    list: 'List 2',
    fr_reference: '83 FR 40823 (Aug. 16, 2018)',
    rate_effective_date: '2018-08-23',
  },
  '9903.88.03': {
    rate_pct: 25,
    list: 'List 3',
    fr_reference: '83 FR 47974 (Sept. 21, 2018); rate ↑25% per 84 FR 20459 (May 9, 2019)',
    rate_effective_date: '2019-05-10',
  },
  '9903.88.04': {
    rate_pct: 7.5,
    list: 'List 4A',
    fr_reference: '84 FR 69447 (Dec. 18, 2019)',
    rate_effective_date: '2020-02-14',
  },
  // 9903.88.15 — Section 301 special sub-provision for certain consumer electronics
  // (audio equipment, speakers, headphones, and similar goods under Chapter 85 and
  // related headings). Established under List 4A at 7.5% ad valorem.
  // Source: USTR List 4A action; 84 FR 69447 (Dec. 18, 2019); HTSUS Chapter 99 Note.
  // Covers, among others: HTS 8518.21.xx (single loudspeakers in enclosures), and
  // related audio products from China. Last verified: 2025-12-01.
  '9903.88.15': {
    rate_pct: 7.5,
    list: 'List 4A (sub-provision)',
    fr_reference: '84 FR 69447 (Dec. 18, 2019)',
    rate_effective_date: '2020-02-14',
  },
} as const;

// ── Section 301 Exclusions ────────────────────────────────────────────────────

/**
 * Known Section 301 List 3 exclusions for HTS codes relevant to automobile parts.
 *
 * USTR grants time-limited product exclusions from Section 301 tariffs via
 * Federal Register notices.  Each exclusion has a hard expiry date and covers
 * a specific 10-digit HTS code (or a product description that ClearPort maps to
 * one or more HTS prefixes).
 *
 * These records represent the known exclusion history as of the last-verified
 * date.  For import dates AFTER last_verified, the customer MUST check the live
 * USTR exclusion portal — ClearPort cannot guarantee no new exclusion has been
 * granted or that an expired one has not been renewed.
 *
 * USTR exclusion portal: https://ustr.gov/issue-areas/enforcement/section-301-investigations/ustr-exclusion-portal
 *
 * Last verified: 2025-12-01.
 * USTR extended 178 Section 301 List 3 exclusions through 11:59 p.m. ET on
 * November 9, 2026, pursuant to the November 1, 2025 U.S.-China trade deal
 * (FR Doc. 2025-21671, Dec. 1, 2025).  The 178 extended exclusions cover
 * critical minerals, EVs, batteries, semiconductors, and solar equipment.
 * NONE of the 178 extended exclusions cover HTS 8708.30 or any brake-drum
 * subheading — the full 25% List 3 rate applies to China-origin brake drums.
 */
export interface Section301Exclusion {
  /** Digit-only HTS prefix; matched from start of submitted normalized HTS */
  readonly hts_prefix: string;
  readonly fr_reference: string;
  /** ISO date when the exclusion became effective */
  readonly valid_from: string;
  /** ISO date when the exclusion expired (exclusions are always time-limited) */
  readonly valid_through: string;
  readonly description: string;
}

/**
 * Known exclusions for List 3 (9903.88.03) automobile-related HTS codes.
 *
 * Research note (verified 2025-12-01 per FR Doc. 2025-21671):
 *   USTR extended 178 Section 301 exclusions through 11:59 p.m. ET on
 *   November 9, 2026 following the November 1, 2025 U.S.-China trade deal.
 *   The 178 exclusions are claimed under HTSUS 9903.88.69 and 9903.88.70
 *   and cover critical minerals, EVs, batteries, semiconductors, and solar
 *   equipment.  NONE cover HTS 8708.30 or any brake-drum subheading.
 *
 *   Conclusion: The full 25% List 3 rate (9903.88.03) applies to China-origin
 *   brake drums (HTS 8708.30.50.20) for all import dates verified to date.
 *   Any new exclusion grant would be published in the Federal Register and
 *   must be added here before it can be applied.
 */
export const SECTION_301_LIST3_EXCLUSIONS: Section301Exclusion[] = [
  // No currently-active exclusions for 8708.30 (brake components).
  // The 178 exclusions extended through Nov. 9, 2026 (FR Doc. 2025-21671)
  // do not cover any 8708.30 subheading.
];

// Shared last-verified date for all Section 301 data in this file.
// Updated to reflect FR Doc. 2025-21671 (Dec. 1, 2025) — the most recent
// USTR exclusion extension notice verified.
export const SECTION_301_LAST_VERIFIED = '2025-12-01';

export interface Section301ExclusionCheck {
  excluded: boolean;
  /** Non-null when a matching exclusion record (active or expired) was found */
  exclusion: Section301Exclusion | null;
  /** Whether the import date falls outside ClearPort's verified window */
  beyond_verification: boolean;
  note: string;
}

/**
 * Check whether a known Section 301 exclusion applies to the given HTS code
 * on the given import date.
 *
 * Returns `excluded: true` only when a known exclusion is active for the
 * specific import date.  When no exclusion record exists and the import date
 * is after the last-verified date, the result includes a caveat to verify at
 * the USTR portal.
 *
 * @param normalizedHts10  Digit-only HTS code (10 digits preferred)
 * @param importDate       ISO date of the import
 * @param exclusions       Exclusion list to search (defaults to production list)
 */
export function checkSection301Exclusion(
  normalizedHts10: string,
  importDate: string,
  exclusions: Section301Exclusion[] = SECTION_301_LIST3_EXCLUSIONS,
): Section301ExclusionCheck {
  const beyondVerification = importDate > SECTION_301_LAST_VERIFIED;

  // Search for a matching exclusion record
  for (const excl of exclusions) {
    const prefix = excl.hts_prefix.replace(/[^0-9]/g, '');
    if (!normalizedHts10.startsWith(prefix)) continue;

    // Matching exclusion record found — check if it was active on import date
    if (importDate >= excl.valid_from && importDate <= excl.valid_through) {
      return {
        excluded: true,
        exclusion: excl,
        beyond_verification: false,
        note: `Active USTR exclusion (${excl.fr_reference}) covers this HTS code from ${excl.valid_from} through ${excl.valid_through}. Section 301 tariff does not apply to this shipment.`,
      };
    }

    // Exclusion found but it has expired (or not yet started)
    if (importDate > excl.valid_through) {
      return {
        excluded: false,
        exclusion: excl,
        beyond_verification: beyondVerification,
        note: `A prior USTR exclusion (${excl.fr_reference}) for this HTS code expired on ${excl.valid_through}. No active exclusion applies to import date ${importDate}.${beyondVerification ? ' Verify at ustr.gov that no new exclusion has been granted.' : ''}`,
      };
    }
  }

  // No matching exclusion record in database
  return {
    excluded: false,
    exclusion: null,
    beyond_verification: beyondVerification,
    note: beyondVerification
      ? `No exclusion found in ClearPort's database (verified through ${SECTION_301_LAST_VERIFIED}). Import date ${importDate} is after ClearPort's last verification — confirm current exclusion status at ustr.gov before relying on this rate.`
      : `No active USTR Section 301 exclusion identified for this HTS code as of ${SECTION_301_LAST_VERIFIED}. The ${
          SECTION_301_RATES['9903.88.03']?.rate_pct
        }% List 3 rate applies.`,
  };
}

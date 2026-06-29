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

// ── Merchandise Processing Fee (MPF) — FY2026 limits ─────────────────────────
//
// The MPF rate is set by statute at 0.3464% (19 U.S.C. 58c(a)(9)(A)). CBP
// adjusts the minimum and maximum dollar amounts annually by inflation notice.
//
// FY2026 limits (effective October 1, 2025 – September 30, 2026):
//   CBP Bulletin: "Adjustments to Customs User Fees for Fiscal Year 2026"
//   Source: 90 FR 51684 (June 12, 2025).
//
// NOTE: The FY2025 limits ($31.67 / $614.35) applied from Oct 1, 2024 to
//   Sep 30, 2025. The FY2026 limits apply from Oct 1, 2025 forward.
//   Imports dated Oct 1, 2025 or later must use the FY2026 limits.
//
// Last verified: 2025-12-01 (90 FR 51684).

export interface MpfSchedule {
  readonly rate_pct: number;
  readonly min_usd: number;
  readonly max_usd: number;
  /** Per-entry surcharge for manual (paper) entries — added to the computed fee */
  readonly manual_entry_surcharge_usd: number;
  readonly fy_start: string;    // ISO date — first day this schedule applies
  readonly fy_end: string;      // ISO date — last day this schedule applies (inclusive)
  readonly fr_reference: string;
  readonly last_verified: string;
}

export const MPF_FY2026: MpfSchedule = {
  rate_pct: 0.3464,
  min_usd: 33.58,
  max_usd: 651.50,
  manual_entry_surcharge_usd: 4.03,
  fy_start: '2025-10-01',
  fy_end: '2026-09-30',
  fr_reference: '90 FR 51684 (June 12, 2025)',
  last_verified: '2025-12-01',
} as const;

/** Prior-year schedule for imports dated before Oct 1, 2025 */
export const MPF_FY2025: MpfSchedule = {
  rate_pct: 0.3464,
  min_usd: 31.67,
  max_usd: 614.35,
  manual_entry_surcharge_usd: 3.82,
  fy_start: '2024-10-01',
  fy_end: '2025-09-30',
  fr_reference: '89 FR 53416 (June 26, 2024)',
  last_verified: '2025-08-01',
} as const;

/**
 * Select the correct MPF schedule for the given import date.
 * Defaults to FY2026 if the import date is after Sep 30, 2025 or is not provided.
 */
export function getMpfSchedule(importDate: string): MpfSchedule {
  if (importDate >= MPF_FY2026.fy_start) return MPF_FY2026;
  if (importDate >= MPF_FY2025.fy_start) return MPF_FY2025;
  // Fallback: use FY2025 schedule for any earlier date
  return MPF_FY2025;
}

/**
 * Compute the MPF dollar amount for a given entered value and import date.
 * Applies the correct annual schedule and clips to min/max.
 */
export function computeMpf(enteredValueUsd: number, importDate: string): {
  amount: number;
  schedule: MpfSchedule;
} {
  const schedule = getMpfSchedule(importDate);
  const raw = (enteredValueUsd * schedule.rate_pct) / 100;
  const amount = Math.min(schedule.max_usd, Math.max(schedule.min_usd, raw));
  return { amount, schedule };
}

// ── Section 122 Temporary Import Surcharge — effective February 24, 2026 ──────
//
// Authority: Section 122, Trade Act of 1974 (19 U.S.C. 2132).
// Section 122 authorizes the President to impose an import surcharge of up to
// 15% ad valorem on all imports, or articles from specific countries, for up
// to 150 days to address balance-of-payments deficits.
//
// Action: Presidential Proclamation effective February 24, 2026.
//   Rate: 10% ad valorem on all articles from all countries unless officially
//     exempted by the proclamation annex.
//   Duration: 150 days beginning February 24, 2026.
//   Last effective day: July 23, 2026 (day 1 = Feb 24; day 150 = Jul 23).
//
// Chapter 99 classification:
//   Chapter 99 subheading: 9903.99.10 — Temporary surcharge under Section 122,
//   Trade Act of 1974; 10% ad valorem; effective 2026-02-24 through 2026-07-23.
//   Source: Presidential Proclamation [FR Doc. pending — confirm from the
//   Federal Register notice before relying on this citation in customs filings].
//
// Stacking: The Section 122 surcharge stacks on top of the MFN base rate and
//   any Section 301 tariff. It does NOT stack on top of Section 232 on the same
//   covered portion — goods already subject to Section 232 (automobile parts
//   under Proclamation 10908, and steel/aluminum under Proclamations 9704/9777)
//   are carved out of the Section 122 surcharge base to prevent double-stacking
//   on the same covered merchandise.
//
// Exemptions fall into four categories:
//   1. Unconditional HTS exemptions — pharmaceutical products (Chapter 30),
//      medical/surgical instruments (headings 9018–9022), petroleum and natural
//      gas (headings 2709–2711).  These exemptions apply regardless of origin,
//      end use, or any other condition.
//   2. Section 232 no-stacking — goods covered by the Section 232 automobile-
//      parts tariff (Proclamation 10908, 9903.94.05) or the Section 232 steel/
//      aluminum tariff (Proclamations 9704/9777) are exempt on the covered
//      portion of value to avoid double-stacking.
//   3. Conditional civil-aircraft exemption — goods of civil-aircraft-eligible
//      HTS headings that are certified for civil aircraft use under U.S. Note 1,
//      Subchapter XX, Chapter 98 of the HTSUS are exempt.  The exemption is
//      conditional: it applies ONLY when the importer holds and presents a
//      qualifying FAA/EASA certification.  If certification status is unknown,
//      the result is "Cannot determine — missing: civil_aircraft_use certification".
//   4. Origin-based FTA exemptions — goods from USMCA countries (Canada, Mexico)
//      and CAFTA-DR countries (Costa Rica, El Salvador, Guatemala, Honduras,
//      Nicaragua, Dominican Republic) are exempt under their respective FTAs.
//
// Last verified: 2026-06-28.

/** Classification for a Section 122 exemption entry. */
export type Section122ExemptionType =
  | 'unconditional'
  | 'already_s232_auto'
  | 'already_s232_steel_aluminum';

/**
 * A single structured entry in the Section 122 exemption table.
 *
 * Civil-aircraft conditional exemptions are NOT stored here — they are
 * handled by `civil_aircraft_eligible_prefixes` + `checkSection122Surcharge`
 * `knownFacts` logic.
 *
 * Origin-based FTA exemptions (USMCA, CAFTA-DR) are stored separately in
 * `usmca_origins` and `cafta_dr_origins`.
 */
export interface Section122ExemptItem {
  /** Digit-only HTS prefixes covered by this exemption (matched by startsWith). */
  readonly hts_prefixes: readonly string[];
  readonly type: Section122ExemptionType;
  readonly description: string;
  /** Chapter 99 provision for the exemption or no-stacking rule, if any. */
  readonly chapter99_provision?: string;
  readonly fr_reference: string;
}

export interface Section122Coverage {
  readonly rate_pct: number;
  /** ISO date — first day the surcharge applies (inclusive). */
  readonly effective_date: string;
  /** ISO date — last day the surcharge applies (inclusive, day 150). */
  readonly expiry_date: string;
  readonly authority: string;
  /** HTSUS Chapter 99 subheading for the surcharge itself (provisional). */
  readonly chapter99_provision: string;
  readonly fr_reference: string;
  readonly official_url: string;
  readonly last_verified: string;
  /** Lowercase origin country strings qualifying for USMCA FTA exemption. */
  readonly usmca_origins: readonly string[];
  /** Lowercase origin country strings qualifying for CAFTA-DR FTA exemption. */
  readonly cafta_dr_origins: readonly string[];
  /**
   * HTS prefixes for which civil-aircraft conditional exemption MAY apply.
   * For these prefixes, `checkSection122Surcharge` checks `knownFacts.civil_aircraft_use`:
   *   'yes'  → exempt (certified for civil aircraft use)
   *   'no'   → surcharge applies (not for aircraft)
   *   absent → cannot_determine (certification status unknown)
   */
  readonly civil_aircraft_eligible_prefixes: readonly string[];
  /** Structured exemption table (unconditional + Section 232 no-stacking). */
  readonly exempt_entries: readonly Section122ExemptItem[];
}

export const SECTION_122_SURCHARGE: Section122Coverage = {
  rate_pct: 10,
  effective_date: '2026-02-24',
  expiry_date:    '2026-07-23',
  authority: 'Section 122, Trade Act of 1974 (19 U.S.C. 2132)',
  chapter99_provision: '9903.99.10',
  fr_reference: 'Presidential Proclamation, effective Feb. 24, 2026 [FR Doc. pending]',
  official_url: 'https://www.federalregister.gov/presidential-documents/proclamations',
  last_verified: '2026-06-28',

  // ── FTA origin exemptions ─────────────────────────────────────────────────
  usmca_origins: ['canada', 'ca', 'mexico', 'mx'],
  cafta_dr_origins: [
    'costa rica', 'el salvador', 'guatemala', 'honduras', 'nicaragua', 'dominican republic',
  ],

  // ── Civil-aircraft-eligible HTS prefixes ──────────────────────────────────
  // Goods of these headings may be exempt when certified for civil aircraft use
  // under U.S. Note 1, Subchapter XX, Chapter 98 of the HTSUS.
  civil_aircraft_eligible_prefixes: [
    '8411', // turbo-jets, turbo-propellers, and gas turbines
    '8412', // hydraulic power engines and motors
    '8483', // shafts, bearings, gears, gearing, clutches (aircraft drivetrains)
    '8501', // electric motors and generators
    '8511', // ignition equipment for spark-ignition or compression-ignition engines
    '8518', // loudspeakers, microphones, amplifiers (cabin/cockpit audio systems)
    '8519', // sound recording/reproducing apparatus (in-flight entertainment)
    '8525', // transmission apparatus for radio/TV (avionics TX)
    '8526', // radar apparatus, radio navigation aids (avionics RX/NAV)
    '8537', // boards, panels, consoles for electric control (aircraft control panels)
    '8544', // insulated wire, cable, optical fiber cable (aircraft wiring harnesses)
    '9001', // optical fibers, optical fiber bundles (aircraft instruments)
    '9014', // direction-finding compasses, navigation instruments for aircraft
    '9015', // surveying, hydrographic, oceanographic instruments
  ],

  // ── Structured exemption table ────────────────────────────────────────────
  exempt_entries: [
    // ── 1. Unconditional HTS exemptions ───────────────────────────────────
    {
      hts_prefixes: ['3001', '3002', '3003', '3004', '3005', '3006'],
      type: 'unconditional',
      description:
        'Pharmaceutical products — HTSUS Chapter 30, all headings 3001–3006. ' +
        'Exempted unconditionally; applies regardless of origin or end use.',
      fr_reference: 'Presidential Proclamation, effective Feb. 24, 2026 [FR Doc. pending]',
    },
    {
      hts_prefixes: ['9018', '9019', '9020', '9021', '9022'],
      type: 'unconditional',
      description:
        'Medical and surgical instruments, apparatus, and parts — HTSUS Chapter 90, ' +
        'headings 9018–9022. Includes diagnostic, monitoring, dental, orthopaedic, ' +
        'X-ray, and related medical devices. Exempted unconditionally.',
      fr_reference: 'Presidential Proclamation, effective Feb. 24, 2026 [FR Doc. pending]',
    },
    {
      hts_prefixes: ['2709', '2710', '2711'],
      type: 'unconditional',
      description:
        'Petroleum oils, preparations, and natural gas — HTSUS headings 2709 (crude), ' +
        '2710 (refined petroleum products), and 2711 (petroleum gases, natural gas, LPG). ' +
        'Exempted unconditionally.',
      fr_reference: 'Presidential Proclamation, effective Feb. 24, 2026 [FR Doc. pending]',
    },

    // ── 2. Section 232 auto-parts no-stacking (Proclamation 10908) ────────
    // HTS codes covered by the 25% Section 232 automobile-parts tariff are
    // carved out of the Section 122 surcharge base. The Annex I list from
    // Proclamation 10908 is reproduced here at the same digit depth to match
    // the covered_hts_prefixes in SECTION_232_AUTO.
    {
      hts_prefixes: [
        // Chapter 8708 — motor vehicle parts (brakes, gear boxes, axles, etc.)
        '870810', '870821', '870822', '870829',
        '870830',   // brakes, servo-brakes, and parts (incl. brake drums 8708.30.50.20)
        '870840', '870850', '870860', '870870', '870880', '870891', '870892',
        '87089360', '87089375',   // 8708.93.60/75 clutches (non-agricultural)
        '870894', '870895',
        '87089953', '87089955', '87089958', '87089968',  // 8708.99.53/55/58/68
        // Chapter 8706/8707 — chassis and bodies
        '870600', '870710', '870790',
        // Engine/drivetrain parts covered by Proclamation 10908 Annex I
        '840731', '840732', '840733', '840734',  // spark-ignition engines (vehicles)
        '840820',   // compression-ignition engines (vehicles)
        '840991', '840999',   // parts for 8407/8408 engines
        '848310', '848330', '848340', '848350', '848360', '848390',
        '852610',   // GPS navigation apparatus (vehicles)
        '854430',   // ignition/wiring sets (vehicles)
      ],
      type: 'already_s232_auto',
      description:
        'Automobile parts covered by the Section 232 tariff under Presidential ' +
        'Proclamation 10908 (9903.94.05, 25% ad valorem). The Section 122 ' +
        'surcharge does not stack on the same covered portion of these goods.',
      chapter99_provision: '9903.94.05',
      fr_reference: 'Proclamation 10908 (90 FR 18753, Apr. 29, 2025)',
    },

    // ── 3. Section 232 steel/aluminum no-stacking (Proclamations 9704/9777) ─
    {
      hts_prefixes: [
        // Chapter 72 — iron and steel
        '7201','7202','7203','7204','7205','7206','7207','7208','7209','7210',
        '7211','7212','7213','7214','7215','7216','7217','7218','7219','7220',
        '7221','7222','7223','7224','7225','7226','7227','7228','7229',
        // Chapter 73 — articles of iron or steel
        '7301','7302','7303','7304','7305','7306','7307','7308','7309','7310',
        '7311','7312','7313','7314','7315','7316','7317','7318','7319','7320',
        '7321','7322','7323','7324','7325','7326',
        // Chapter 76 — aluminum and articles thereof
        '7601','7602','7603','7604','7605','7606','7607','7608','7609','7610',
        '7611','7612','7613','7614','7615','7616',
      ],
      type: 'already_s232_steel_aluminum',
      description:
        'Steel and aluminum products covered by the Section 232 tariff under ' +
        'Proclamations 9704 and 9777 (25% steel / 10% aluminum). The Section 122 ' +
        'surcharge does not stack on the same covered portion of these goods.',
      chapter99_provision: '9903.80.01 / 9903.85.01',
      fr_reference:
        'Proclamation 9704 (83 FR 11619, Mar. 15, 2018); ' +
        'Proclamation 9777 (83 FR 20253, May 1, 2018)',
    },
  ],
} as const;

export interface Section122Result {
  applies: boolean | 'cannot_determine';
  reason:
    | 'applicable'
    | 'before_effective_date'
    | 'after_expiry'
    | 'hts_exempt'
    | 'origin_usmca'
    | 'origin_cafta_dr'
    | 'already_s232_auto'
    | 'already_s232_steel_aluminum'
    | 'cannot_determine';
  rate_pct: number | null;
  note: string;
  source_ref: string;
  /** Populated when reason === 'cannot_determine'; names the missing fact. */
  missing_condition?: string;
}

/**
 * Determine whether the Section 122 temporary surcharge applies to this import.
 *
 * Check order:
 *   1. Date window (before / after the 150-day window)
 *   2. USMCA origin exemption (Canada, Mexico)
 *   3. CAFTA-DR origin exemption
 *   4. Unconditional HTS exemptions (pharmaceutical, medical, petroleum)
 *   5. Section 232 no-stacking (auto-parts, steel/aluminum)
 *   6. Conditional civil-aircraft exemption — returns cannot_determine when
 *      HTS is civil-aircraft-eligible but `knownFacts.civil_aircraft_use` is absent
 *   7. Applicable (no exemption found)
 *
 * @param normalizedHts   Digit-only HTS code (any length; matched by prefix)
 * @param originCountry   Origin country as submitted (free text; lowercased internally)
 * @param importDate      ISO import date (e.g. "2026-06-28")
 * @param knownFacts      Optional fact map — supply `civil_aircraft_use: 'yes'|'no'`
 *                        to resolve the conditional civil-aircraft exemption
 * @param surcharge       Surcharge definition (defaults to production constant)
 */
export function checkSection122Surcharge(
  normalizedHts: string,
  originCountry: string,
  importDate: string,
  knownFacts: Record<string, string> = {},
  surcharge: Section122Coverage = SECTION_122_SURCHARGE,
): Section122Result {
  const src = `${surcharge.authority}; HTSUS ${surcharge.chapter99_provision}; ${surcharge.fr_reference}`;

  // ── 1. Date window ────────────────────────────────────────────────────────
  if (importDate < surcharge.effective_date) {
    return {
      applies: false,
      reason: 'before_effective_date',
      rate_pct: null,
      note: `Import date ${importDate} is before the ${surcharge.effective_date} effective date of the Section 122 temporary surcharge. Surcharge does not apply to this shipment.`,
      source_ref: src,
    };
  }
  if (importDate > surcharge.expiry_date) {
    return {
      applies: false,
      reason: 'after_expiry',
      rate_pct: null,
      note: `Import date ${importDate} is after ${surcharge.expiry_date} — the 150-day Section 122 temporary surcharge expired on that date. Surcharge does not apply to this shipment.`,
      source_ref: src,
    };
  }

  // ── 2. USMCA origin exemption ─────────────────────────────────────────────
  const originLc = originCountry.toLowerCase();
  if (surcharge.usmca_origins.some((o) => originLc.includes(o))) {
    return {
      applies: false,
      reason: 'origin_usmca',
      rate_pct: null,
      note: `${originCountry}-origin goods are exempt from the Section 122 surcharge under the United States-Mexico-Canada Agreement (USMCA). No Section 122 surcharge applies to this shipment.`,
      source_ref: src,
    };
  }

  // ── 3. CAFTA-DR origin exemption ──────────────────────────────────────────
  if (surcharge.cafta_dr_origins.some((o) => originLc.includes(o))) {
    return {
      applies: false,
      reason: 'origin_cafta_dr',
      rate_pct: null,
      note: `${originCountry}-origin goods are exempt from the Section 122 surcharge under the Dominican Republic-Central America-United States Free Trade Agreement (CAFTA-DR). No Section 122 surcharge applies to this shipment.`,
      source_ref: src,
    };
  }

  // ── 4 & 5. Unconditional HTS exemptions + Section 232 no-stacking ─────────
  for (const entry of surcharge.exempt_entries) {
    if (!entry.hts_prefixes.some((p) => normalizedHts.startsWith(p))) continue;

    if (entry.type === 'unconditional') {
      const matchedPrefix = entry.hts_prefixes.find((p) => normalizedHts.startsWith(p))!;
      return {
        applies: false,
        reason: 'hts_exempt',
        rate_pct: null,
        note: `HTS ${normalizedHts} (matched prefix ${matchedPrefix}) falls within an unconditionally exempted category: ${entry.description} The Section 122 10% temporary surcharge does not apply.`,
        source_ref: `${src}; ${entry.fr_reference}`,
      };
    }

    if (entry.type === 'already_s232_auto') {
      return {
        applies: false,
        reason: 'already_s232_auto',
        rate_pct: null,
        note: `HTS ${normalizedHts} is covered by the Section 232 automobile-parts tariff (${entry.chapter99_provision ?? '9903.94.05'}, Proclamation 10908). The Section 122 surcharge does not stack on the same covered portion of these goods.`,
        source_ref: `${src}; ${entry.fr_reference}`,
      };
    }

    if (entry.type === 'already_s232_steel_aluminum') {
      return {
        applies: false,
        reason: 'already_s232_steel_aluminum',
        rate_pct: null,
        note: `HTS ${normalizedHts} is covered by the Section 232 steel/aluminum tariff (${entry.chapter99_provision ?? '9903.80.01 / 9903.85.01'}). The Section 122 surcharge does not stack on the same covered portion of these goods.`,
        source_ref: `${src}; ${entry.fr_reference}`,
      };
    }
  }

  // ── 6. Conditional civil-aircraft exemption ───────────────────────────────
  // This exemption requires that the goods are certified for civil aircraft use
  // under U.S. Note 1, Subchapter XX, Chapter 98 of the HTSUS.  Without that
  // certification, the surcharge applies.  If certification status is unknown,
  // the result is cannot_determine.
  const isCivilAircraftEligible = surcharge.civil_aircraft_eligible_prefixes.some((p) =>
    normalizedHts.startsWith(p),
  );
  if (isCivilAircraftEligible) {
    const civilUse = knownFacts['civil_aircraft_use'];
    if (civilUse === 'yes') {
      return {
        applies: false,
        reason: 'hts_exempt',
        rate_pct: null,
        note: `HTS ${normalizedHts} is exempt from the Section 122 surcharge because the goods are certified for civil aircraft use per U.S. Note 1, Subchapter XX, Chapter 98 of the HTSUS (9880.00.00). Retain the FAA/EASA airworthiness certification (e.g. FAA Form 8130-3 or EASA Form 1) as evidence.`,
        source_ref: `${src}; U.S. Note 1, Subchapter XX, Chapter 98 HTSUS`,
      };
    }
    if (!civilUse) {
      return {
        applies: 'cannot_determine',
        reason: 'cannot_determine',
        rate_pct: null,
        note: `HTS ${normalizedHts} is in a civil-aircraft-eligible heading. The Section 122 exemption for civil aircraft use (U.S. Note 1, Subchapter XX, Chapter 98) may apply — but only if the goods are certified for civil aircraft use. Cannot determine — missing: civil_aircraft_use certification status (answer 'yes' if the goods hold an FAA Form 8130-3 or equivalent EASA Form 1 civil airworthiness release).`,
        source_ref: `${src}; U.S. Note 1, Subchapter XX, Chapter 98 HTSUS`,
        missing_condition: 'civil_aircraft_use certification (FAA Form 8130-3 or EASA Form 1)',
      };
    }
    // civilUse === 'no' or any other non-'yes' value: exemption does not apply; fall through
  }

  // ── 7. Applicable ─────────────────────────────────────────────────────────
  return {
    applies: true,
    reason: 'applicable',
    rate_pct: surcharge.rate_pct,
    note: `HTS ${normalizedHts} from ${originCountry} is subject to the ${surcharge.rate_pct}% Section 122 temporary surcharge (${surcharge.chapter99_provision}), effective ${surcharge.effective_date} through ${surcharge.expiry_date}. This surcharge stacks on top of the MFN base rate and Section 301 tariff.`,
    source_ref: src,
  };
}

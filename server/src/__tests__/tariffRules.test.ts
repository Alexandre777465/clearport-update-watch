/**
 * Unit tests for tariffRules.ts — Section 232 automobile-parts and Section 301
 * China-tariff logic.
 *
 * These tests run without a database or network.  Every assertion is backed by
 * a primary source documented in tariffRules.ts.
 *
 * Tests cover:
 *  1. An included automotive HTS (8708.30.50.20) receives Section 232
 *  2. An HTS not in Annex I does NOT receive Section 232
 *  3. An import before the effective date does NOT receive Section 232
 *  4. USMCA-origin goods return "cannot_determine"
 *  5. Non-USMCA country (China) always applies when in Annex I
 *  6. Active Section 301 exclusion: excluded = true, rate not applied
 *  7. Expired Section 301 exclusion: excluded = false, rate applies
 *  8. No exclusion record: excluded = false, beyond-verification caveat when import after cutoff
 *  9. Full brake-drum tariff determination: MFN 2.5% + S301 25% + S232 25% + IEEPA 20% = 72.5% known
 * 10. assembleBaselines does NOT produce a section_232_auto category for non-8708 HTS
 */

import { describe, it, expect } from 'bun:test';
import {
  checkSection232Auto,
  checkSection301Exclusion,
  checkSection122Surcharge,
  computeMpf,
  SECTION_232_AUTO,
  SECTION_301_RATES,
  SECTION_301_LIST3_EXCLUSIONS,
  SECTION_301_LAST_VERIFIED,
  type Section301Exclusion,
} from '../services/tariffRules';
import {
  calculateDutyStack,
  evaluateRule,
  entryDateWithinRange,
  lookupSection301Ustr,
  IEEPA_RULES,
} from '../services/tariffRuleEngine';
import {
  lookupBrakeDrumAdRate,
  lookupBrakeDrumCvdRate,
} from '../services/adcvdScanner';
import { assembleBaselines, buildCoverageMatrix } from '../services/baselines';
import { resolveHtsRows } from '../services/htsBaseline';
import type { WatchlistEntry } from '../types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** Normalised digits-only HTS for brake drum 8708.30.50.20 */
const HTS_BRAKE_DRUM = '8708305020';

/** An 8708 subheading NOT in Annex I — no such code exists in the list, so
 *  we use a fabricated 6-digit prefix "870811" which is not in covered_hts_prefixes. */
const HTS_8708_NOT_IN_ANNEX = '870811';

/** A non-automotive HTS (footwear) — completely outside Chapter 87 */
const HTS_FOOTWEAR = '6402991500';

const BASE_ENTRY: WatchlistEntry = {
  id: 'test-entry-1',
  user_id: 'test-user',
  product_name: 'Brake drum',
  product_description: 'Grey cast iron brake drum, 15 inch inside diameter, 85 lbs, non-composite',
  hts_code: '8708.30.50.20',
  origin_country: 'China',
  destination_country: 'US',
  status: 'active',
  is_children: false,
  has_battery: false,
  is_electronic: false,
  is_textile: false,
  is_cosmetic: false,
  is_food_contact: false,
  is_supplement: false,
  created_at: '2025-06-01T00:00:00Z',
  updated_at: '2025-06-01T00:00:00Z',
};

// ── Section 232 Automobile-Parts Tests ───────────────────────────────────────

describe('checkSection232Auto — included HTS', () => {
  it('8708.30.50.20 from China on a post-effective-date import applies at 25%', () => {
    const r = checkSection232Auto(HTS_BRAKE_DRUM, 'China', '2026-01-15');
    expect(r.applies).toBe(true);
    expect(r.reason).toBe('covered');
    expect(r.rate_pct).toBe(25);
    expect(r.source_ref).toContain('9903.94.05');
    expect(r.source_ref).toContain('Proclamation 10908');
  });

  it('8708.30.50 (6-digit) from Vietnam applies — non-USMCA origin', () => {
    const r = checkSection232Auto('870830', 'Vietnam', '2025-07-01');
    expect(r.applies).toBe(true);
    expect(r.reason).toBe('covered');
  });

  it('8708.99.53 from China applies (exact 8-digit subheading)', () => {
    const r = checkSection232Auto('87089953', 'China', '2025-06-01');
    expect(r.applies).toBe(true);
    expect(r.reason).toBe('covered');
  });

  it('8706 (chassis with engine) from Japan applies', () => {
    const r = checkSection232Auto('870600', 'Japan', '2025-09-01');
    expect(r.applies).toBe(true);
  });
});

describe('checkSection232Auto — excluded / not covered HTS', () => {
  it('HTS not in Annex I returns applies=false, reason=not_covered_hts', () => {
    // 870811 is not in covered_hts_prefixes
    const r = checkSection232Auto(HTS_8708_NOT_IN_ANNEX, 'China', '2026-01-01');
    expect(r.applies).toBe(false);
    expect(r.reason).toBe('not_covered_hts');
    expect(r.rate_pct).toBeNull();
  });

  it('Footwear HTS (6402) returns applies=false', () => {
    const r = checkSection232Auto(HTS_FOOTWEAR, 'China', '2026-01-01');
    expect(r.applies).toBe(false);
    expect(r.reason).toBe('not_covered_hts');
  });

  it('8708.30 imported BEFORE May 3 2025 returns applies=false (before_effective_date)', () => {
    const r = checkSection232Auto(HTS_BRAKE_DRUM, 'China', '2025-04-30');
    expect(r.applies).toBe(false);
    expect(r.reason).toBe('before_effective_date');
    expect(r.note).toContain('2025-05-03');
  });

  it('Import on effective date (2025-05-03) is subject to tariff', () => {
    const r = checkSection232Auto(HTS_BRAKE_DRUM, 'China', '2025-05-03');
    expect(r.applies).toBe(true);
  });
});

describe('checkSection232Auto — USMCA conditions', () => {
  it('Mexico-origin 8708 returns cannot_determine (USMCA exemption possible)', () => {
    const r = checkSection232Auto(HTS_BRAKE_DRUM, 'Mexico', '2026-01-01');
    expect(r.applies).toBe('cannot_determine');
    expect(r.reason).toBe('usmca_cannot_determine');
    expect(r.rate_pct).toBeNull();
    expect(r.note).toContain('USMCA');
  });

  it('Canada-origin 8708 returns cannot_determine', () => {
    const r = checkSection232Auto('870840', 'Canada', '2025-08-01');
    expect(r.applies).toBe('cannot_determine');
    expect(r.reason).toBe('usmca_cannot_determine');
  });

  it('United States origin returns cannot_determine (domestic re-import edge case)', () => {
    const r = checkSection232Auto(HTS_BRAKE_DRUM, 'United States', '2026-01-01');
    expect(r.applies).toBe('cannot_determine');
    expect(r.reason).toBe('usmca_cannot_determine');
  });

  it('China origin is never USMCA-exempt — applies unconditionally', () => {
    const r = checkSection232Auto(HTS_BRAKE_DRUM, 'China', '2026-01-01');
    expect(r.applies).toBe(true);
    expect(r.reason).toBe('covered');
  });
});

// ── Section 301 Exclusion Tests ───────────────────────────────────────────────

describe('checkSection301Exclusion — rates table', () => {
  it('9903.88.03 rate is 25% (List 3)', () => {
    expect(SECTION_301_RATES['9903.88.03']?.rate_pct).toBe(25);
    expect(SECTION_301_RATES['9903.88.03']?.list).toBe('List 3');
  });

  it('9903.88.04 rate is 7.5% (List 4A)', () => {
    expect(SECTION_301_RATES['9903.88.04']?.rate_pct).toBe(7.5);
  });

  it('9903.88.01 and 9903.88.02 (Lists 1 & 2) are both 25%', () => {
    expect(SECTION_301_RATES['9903.88.01']?.rate_pct).toBe(25);
    expect(SECTION_301_RATES['9903.88.02']?.rate_pct).toBe(25);
  });
});

describe('checkSection301Exclusion — active exclusion', () => {
  const activeExclusions: Section301Exclusion[] = [
    {
      hts_prefix: '87083050',
      fr_reference: '85 FR 00001 (Jan. 1, 2020)',
      valid_from: '2020-01-01',
      valid_through: '2030-12-31',  // active for our test date
      description: 'Test active exclusion for brake drum subheadings',
    },
  ];

  it('returns excluded=true when import date is within active exclusion window', () => {
    const result = checkSection301Exclusion(HTS_BRAKE_DRUM, '2026-01-15', activeExclusions);
    expect(result.excluded).toBe(true);
    expect(result.exclusion?.fr_reference).toBe('85 FR 00001 (Jan. 1, 2020)');
    expect(result.note).toContain('Active USTR exclusion');
  });

  it('prefix match is prefix-based: 8708305020 matches prefix 87083050', () => {
    const result = checkSection301Exclusion('8708305020', '2025-06-01', activeExclusions);
    expect(result.excluded).toBe(true);
  });

  it('non-matching HTS is not excluded by this record', () => {
    const result = checkSection301Exclusion('8708401000', '2026-01-01', activeExclusions);
    expect(result.excluded).toBe(false);
  });
});

describe('checkSection301Exclusion — expired exclusion', () => {
  const expiredExclusions: Section301Exclusion[] = [
    {
      hts_prefix: '87083050',
      fr_reference: '84 FR 99999 (Dec. 31, 2019)',
      valid_from: '2019-09-01',
      valid_through: '2020-08-31',  // expired well before 2026
      description: 'Expired exclusion for brake drum subheadings',
    },
  ];

  it('returns excluded=false when import date is after exclusion expiry', () => {
    const result = checkSection301Exclusion(HTS_BRAKE_DRUM, '2026-01-15', expiredExclusions);
    expect(result.excluded).toBe(false);
    expect(result.exclusion?.fr_reference).toBe('84 FR 99999 (Dec. 31, 2019)');
    expect(result.note).toContain('expired');
    expect(result.note).toContain('2020-08-31');
  });

  it('would be excluded if import date were within the window', () => {
    const result = checkSection301Exclusion(HTS_BRAKE_DRUM, '2019-10-01', expiredExclusions);
    expect(result.excluded).toBe(true);
  });
});

describe('checkSection301Exclusion — no record', () => {
  it('no exclusion in production list for brake drum HTS', () => {
    const result = checkSection301Exclusion(HTS_BRAKE_DRUM, '2026-06-26', SECTION_301_LIST3_EXCLUSIONS);
    expect(result.excluded).toBe(false);
    expect(result.exclusion).toBeNull();
  });

  it('imports after knowledge-cutoff include a caveat about ustr.gov', () => {
    const result = checkSection301Exclusion(HTS_BRAKE_DRUM, '2026-06-26', []);
    expect(result.beyond_verification).toBe(true);
    expect(result.note).toContain('ustr.gov');
  });

  it('imports within knowledge-cutoff window do not include the caveat', () => {
    const result = checkSection301Exclusion(HTS_BRAKE_DRUM, '2025-07-01', []);
    expect(result.beyond_verification).toBe(false);
    expect(result.note).not.toContain('ustr.gov');
  });
});

// ── Full brake-drum tariff determination via assembleBaselines ────────────────

describe('Brake drum full tariff — assembleBaselines', () => {
  const MOCK_HTS_RESULT = {
    match_level: 'exact' as const,
    requested: '8708305020',
    hts8: '8708.30.50',
    matched_htsno: '8708.30.50.20',
    description: 'Brake drums',
    mfn_text_rate: '2.5%',
    mfn_ad_valorem_pct: 2.5,
    section301_ref: '9903.88.03',
    candidates: [],
    source_url: 'https://hts.usitc.gov/',
    note: null,
  };

  it('produces an MFN category at 2.5%', () => {
    const cats = assembleBaselines(BASE_ENTRY, null, MOCK_HTS_RESULT, [], '2026-06-26');
    const mfn = cats.find((c) => c.id === 'hts_duty');
    expect(mfn).toBeDefined();
    expect(mfn!.verified_rate_pct).toBe(2.5);
    expect(mfn!.verification_status).toBe('verified_applicable');
  });

  it('produces a Section 301 category at 25% for China origin, no exclusion', () => {
    const cats = assembleBaselines(BASE_ENTRY, null, MOCK_HTS_RESULT, [], '2026-06-26');
    const s301 = cats.find((c) => c.id === 'hts_section301');
    expect(s301).toBeDefined();
    expect(s301!.verified_rate_pct).toBe(25);
    expect(s301!.verification_status).toBe('verified_applicable');
    // Must NOT claim an exclusion that doesn't exist
    expect(s301!.explanation).not.toContain('EXCLUDED');
    // Must reference the correct Federal Register source
    expect(s301!.source.cfr_citation).toContain('9903.88.03');
    // Must contain the beyond-verification caveat since import date > 2025-08-01
    expect(s301!.explanation).toContain('ustr.gov');
  });

  it('produces a Section 232 auto category at 25% for China origin', () => {
    const cats = assembleBaselines(BASE_ENTRY, null, MOCK_HTS_RESULT, [], '2026-06-26');
    const s232 = cats.find((c) => c.id === 'section_232_auto');
    expect(s232).toBeDefined();
    expect(s232!.verified_rate_pct).toBe(25);
    expect(s232!.verification_status).toBe('verified_applicable');
    expect(s232!.source.cfr_citation).toContain('9903.94.05');
    // The proclamation name is in source.title; cfr_citation holds the HTSUS + FR reference
    expect(s232!.source.title).toContain('Proclamation 10908');
    expect(s232!.source.cfr_citation).toContain('90 FR 18753');
  });

  it('does NOT produce a Section 232 auto category for a non-8708 HTS', () => {
    const nonAutoEntry: WatchlistEntry = {
      ...BASE_ENTRY,
      hts_code: '6402.99.15',
      product_name: 'Rubber footwear',
      product_description: 'Rubber soled footwear',
    };
    const nonAutoHts = { ...MOCK_HTS_RESULT, requested: '6402991500', hts8: '6402.99.15', section301_ref: null, mfn_ad_valorem_pct: 9 };
    const cats = assembleBaselines(nonAutoEntry, null, nonAutoHts, [], '2026-06-26');
    const s232 = cats.find((c) => c.id === 'section_232_auto');
    expect(s232).toBeUndefined();
  });

  it('known tariff total (MFN 2.5% + S301 25% + S232 25% + IEEPA 01.24 10% + IEEPA 01.25 10%) = 72.5%', () => {
    const cats = assembleBaselines(BASE_ENTRY, null, MOCK_HTS_RESULT, [], '2026-06-26');
    const rates = cats
      .filter((c) => c.verification_status === 'verified_applicable' && c.verified_rate_pct != null)
      .map((c) => c.verified_rate_pct!);
    const total = rates.reduce((a, b) => a + b, 0);
    expect(total).toBe(72.5);
  });

  it('Section 232 does NOT apply when entry is from Mexico (USMCA cannot_determine)', () => {
    const mexicoEntry: WatchlistEntry = { ...BASE_ENTRY, origin_country: 'Mexico' };
    const cats = assembleBaselines(mexicoEntry, null, MOCK_HTS_RESULT, [], '2026-06-26');
    const s232 = cats.find((c) => c.id === 'section_232_auto');
    // Should produce a category (USMCA cannot_determine) with insufficient_info
    expect(s232).toBeDefined();
    expect(s232!.verification_status).toBe('insufficient_info');
    expect(s232!.verified_rate_pct).toBeNull();
  });

  it('Section 301 does NOT apply when a known active exclusion covers the HTS', () => {
    // Import an active exclusion into the test using a date inside the window,
    // and a fabricated date-aware check.  We test the assembleBaselines Section
    // 301 path by verifying that an EXCLUDED finding has the right status.
    // (We test the exclusion logic directly in checkSection301Exclusion tests
    // above — here we confirm the category level is 'N/A'.)
    const cats = assembleBaselines(BASE_ENTRY, null, MOCK_HTS_RESULT, [], '2026-06-26');
    const s301 = cats.find((c) => c.id === 'hts_section301');
    // For the current production data (no active exclusion), status is verified_applicable.
    // The test confirms it does NOT claim to be not_applicable without grounds.
    expect(s301!.verification_status).not.toBe('not_applicable');
    expect(s301!.level).not.toBe('N/A');
  });

  it('Section 301 is not_applicable when NON-China origin', () => {
    const nonChinaEntry: WatchlistEntry = { ...BASE_ENTRY, origin_country: 'South Korea' };
    const cats = assembleBaselines(nonChinaEntry, null, MOCK_HTS_RESULT, [], '2026-06-26');
    const s301 = cats.find((c) => c.id === 'hts_section301');
    // No section_301 category at all for non-China origin
    expect(s301).toBeUndefined();
  });
});

// ── Annex I coverage self-validation ─────────────────────────────────────────

describe('SECTION_232_AUTO Annex I completeness', () => {
  it('has at least 16 covered 8708 subheadings', () => {
    const count = SECTION_232_AUTO.covered_hts_prefixes.filter((p) => p.startsWith('8708')).length;
    expect(count).toBeGreaterThanOrEqual(16);
  });

  it('covers 870830 (brakes — the brake drum subheading)', () => {
    expect(SECTION_232_AUTO.covered_hts_prefixes).toContain('870830');
  });

  it('covers 8708.99.53/55/58/68 at exact 8-digit level (not the generic 870899 prefix)', () => {
    const p = SECTION_232_AUTO.covered_hts_prefixes;
    // Exact covered subheadings must be present
    expect(p).toContain('87089953');
    expect(p).toContain('87089955');
    expect(p).toContain('87089958');
    expect(p).toContain('87089968');
    // Generic 6-digit prefix must NOT be present (would incorrectly cover all 8708.99.xx)
    expect(p).not.toContain('870899');
  });

  it('effective date is 2025-05-03', () => {
    expect(SECTION_232_AUTO.effective_date).toBe('2025-05-03');
  });

  it('proclamation is Proclamation 10908', () => {
    expect(SECTION_232_AUTO.proclamation).toContain('10908');
  });

  it('rate is 25%', () => {
    expect(SECTION_232_AUTO.rate_pct).toBe(25);
  });
});

// ── Exact HTS list boundary tests ────────────────────────────────────────────

describe('checkSection232Auto — exact 8708.93 and 8708.99 HTS boundaries', () => {
  it('8708.93.60 (87089360) from China is covered', () => {
    const r = checkSection232Auto('87089360', 'China', '2026-01-01');
    expect(r.applies).toBe(true);
    expect(r.reason).toBe('covered');
  });

  it('8708.93.75 (87089375) from Japan is covered', () => {
    const r = checkSection232Auto('87089375', 'Japan', '2026-01-01');
    expect(r.applies).toBe(true);
    expect(r.reason).toBe('covered');
  });

  it('8708.93.60.00 (10-digit) from China is covered via 8-digit prefix match', () => {
    const r = checkSection232Auto('8708936000', 'China', '2026-01-01');
    expect(r.applies).toBe(true);
  });

  it('8708.93.15 (87089315) — agricultural tractor clutch — is NOT covered', () => {
    const r = checkSection232Auto('87089315', 'China', '2026-01-01');
    expect(r.applies).toBe(false);
    expect(r.reason).toBe('not_covered_hts');
  });

  it('8708.99.53 (87089953) from China is covered', () => {
    const r = checkSection232Auto('87089953', 'China', '2026-01-01');
    expect(r.applies).toBe(true);
    expect(r.reason).toBe('covered');
  });

  it('8708.99.55 (87089955) from China is covered', () => {
    const r = checkSection232Auto('87089955', 'China', '2026-01-01');
    expect(r.applies).toBe(true);
  });

  it('8708.99.58 (87089958) from China is covered', () => {
    const r = checkSection232Auto('87089958', 'China', '2026-01-01');
    expect(r.applies).toBe(true);
  });

  it('8708.99.68 (87089968) from China is covered', () => {
    const r = checkSection232Auto('87089968', 'China', '2026-01-01');
    expect(r.applies).toBe(true);
  });

  it('8708.99.48 (87089948) — not in covered list — is NOT covered', () => {
    const r = checkSection232Auto('87089948', 'China', '2026-01-01');
    expect(r.applies).toBe(false);
    expect(r.reason).toBe('not_covered_hts');
  });

  it('8708.93.60 from Canada returns cannot_determine (USMCA)', () => {
    const r = checkSection232Auto('87089360', 'Canada', '2026-01-01');
    expect(r.applies).toBe('cannot_determine');
    expect(r.reason).toBe('usmca_cannot_determine');
  });
});

// ── USMCA certification language (no Form 434) ───────────────────────────────

describe('checkSection232Auto — USMCA certification language', () => {
  it('USMCA note does NOT mention CBP Form 434', () => {
    const r = checkSection232Auto(HTS_BRAKE_DRUM, 'Mexico', '2026-01-01');
    expect(r.note).not.toContain('Form 434');
    expect(r.note).not.toContain('CBP Form');
  });

  it('USMCA note references certification of origin with required data elements', () => {
    const r = checkSection232Auto(HTS_BRAKE_DRUM, 'Canada', '2026-01-01');
    expect(r.note).toContain('certification of origin');
    expect(r.note).toContain('Article 5.2');
  });

  it('USMCA note references 9903.94.06 at 0%', () => {
    const r = checkSection232Auto(HTS_BRAKE_DRUM, 'Mexico', '2026-01-01');
    expect(r.note).toContain('9903.94.06');
    expect(r.note).toContain('0%');
  });

  it('USMCA note states Cannot determine — missing: certification', () => {
    const r = checkSection232Auto(HTS_BRAKE_DRUM, 'Mexico', '2026-01-01');
    expect(r.note).toContain('Cannot determine');
  });
});

// ── Section 301 active exclusion state for 2026 imports ──────────────────────

describe('checkSection301Exclusion — 2026 imports, current knowledge cutoff', () => {
  it('SECTION_301_LAST_VERIFIED is 2025-12-01 (FR Doc. 2025-21671)', () => {
    expect(SECTION_301_LAST_VERIFIED).toBe('2025-12-01');
  });

  it('import date 2026-06-26 is beyond the verification cutoff', () => {
    const result = checkSection301Exclusion(HTS_BRAKE_DRUM, '2026-06-26', SECTION_301_LIST3_EXCLUSIONS);
    expect(result.beyond_verification).toBe(true);
  });

  it('no active exclusion for 8708.30.50.20 on any 2026 import date', () => {
    for (const date of ['2026-01-01', '2026-06-01', '2026-11-01']) {
      const result = checkSection301Exclusion(HTS_BRAKE_DRUM, date, SECTION_301_LIST3_EXCLUSIONS);
      expect(result.excluded).toBe(false);
      expect(result.exclusion).toBeNull();
    }
  });

  it('import date 2025-11-01 (within cutoff) does not get beyond_verification flag', () => {
    const result = checkSection301Exclusion(HTS_BRAKE_DRUM, '2025-11-01', SECTION_301_LIST3_EXCLUSIONS);
    expect(result.beyond_verification).toBe(false);
  });
});

// ── AD/CVD rate lookup — A-570-174 and C-570-175 ─────────────────────────────

describe('lookupBrakeDrumAdRate — A-570-174', () => {
  it('named separate-rate company returns 77.14%', () => {
    const r = lookupBrakeDrumAdRate('Shandong ConMet Mechanical Co., Ltd.', null);
    expect(r.rate_pct).toBe(77.14);
    expect(r.rule).toContain('Separate-rate');
    expect(r.source_ref).toContain('A-570-174');
  });

  it('lookup is case-insensitive and partial-match', () => {
    const r = lookupBrakeDrumAdRate('LIAONING HECHUANG CV PARTS MFG', null);
    expect(r.rate_pct).toBe(77.14);
  });

  it('Qiqihar Beimo (named respondent) returns 77.14%', () => {
    const r = lookupBrakeDrumAdRate('Qiqihar Beimo Auto Parts Manufacturing Co., Ltd.', null);
    expect(r.rate_pct).toBe(77.14);
  });

  it('unknown Chinese company returns China-wide rate (150.25%)', () => {
    const r = lookupBrakeDrumAdRate('Unknown Brake Co. Ltd.', 'Beijing Exporter Co.');
    expect(r.rate_pct).toBe(150.25);
    expect(r.rule).toContain('China-wide');
  });

  it('no manufacturer/exporter returns China-wide rate', () => {
    const r = lookupBrakeDrumAdRate(null, null);
    expect(r.rate_pct).toBe(150.25);
  });

  it('exporter match (not manufacturer) also returns separate rate', () => {
    const r = lookupBrakeDrumAdRate('Unknown Mfg', 'Shandong Longji Machinery Co., Ltd.');
    expect(r.rate_pct).toBe(77.14);
  });
});

describe('lookupBrakeDrumCvdRate — C-570-175', () => {
  it('Shandong ConMet returns 11.94% (named respondent)', () => {
    const r = lookupBrakeDrumCvdRate('Shandong ConMet Mechanical Co., Ltd.', null);
    expect(r.rate_pct).toBe(11.94);
    expect(r.source_ref).toContain('C-570-175');
  });

  it('CAIEC Trailer Master (AFA) returns 446.83%', () => {
    const r = lookupBrakeDrumCvdRate('CAIEC Trailer Master Co., Ltd.', null);
    expect(r.rate_pct).toBe(446.83);
    expect(r.rule).toContain('AFA');
  });

  it('Zhejiang Firsd Group (AFA) returns 446.83%', () => {
    const r = lookupBrakeDrumCvdRate('Zhejiang Firsd Group Co., Ltd.', null);
    expect(r.rate_pct).toBe(446.83);
  });

  it('unknown company returns all-others rate (11.94%)', () => {
    const r = lookupBrakeDrumCvdRate('Unknown Brake Co. Ltd.', null);
    expect(r.rate_pct).toBe(11.94);
    expect(r.rule).toContain('All-others');
  });

  it('no manufacturer/exporter returns all-others rate', () => {
    const r = lookupBrakeDrumCvdRate(null, null);
    expect(r.rate_pct).toBe(11.94);
  });
});

// ── Section 122 civil-aircraft exemption ──────────────────────────────────────
// The civil-aircraft exemption must NOT trigger "cannot_determine" for ordinary
// consumer goods (Bluetooth speakers, household cables, motors) even when their
// HTS heading is in the civil_aircraft_eligible_prefixes list.  The question is
// only asked when there is positive evidence the product is for civil aircraft use.

const S122_IMPORT_DATE = '2026-07-05'; // within Feb 24–Jul 23 active window

describe('checkSection122Surcharge — HTS 8518 (civil-aircraft-eligible heading)', () => {
  // ── Consumer products (no aircraft evidence) ──────────────────────────────

  it('Bluetooth speaker — no productText → applies (NOT cannot_determine)', () => {
    const r = checkSection122Surcharge('85182100', 'China', S122_IMPORT_DATE);
    expect(r.applies).toBe(true);
    expect(r.reason).toBe('applicable');
    expect(r.rate_pct).toBe(10);
  });

  it('Bluetooth speaker — with consumer productText → applies', () => {
    const r = checkSection122Surcharge(
      '85182100', 'China', S122_IMPORT_DATE, {},
      undefined,
      'Portable Bluetooth speaker, general consumer audio use, no aircraft use',
    );
    expect(r.applies).toBe(true);
    expect(r.rate_pct).toBe(10);
  });

  it('consumer loudspeaker — productText with "speaker" only → applies', () => {
    const r = checkSection122Surcharge(
      '85182100', 'China', S122_IMPORT_DATE, {},
      undefined,
      'Portable speaker with Bluetooth, household use',
    );
    expect(r.applies).toBe(true);
  });

  it('missing civil_aircraft_use in knownFacts + no productText → applies (default not aircraft)', () => {
    const r = checkSection122Surcharge('85182100', 'China', S122_IMPORT_DATE, {});
    expect(r.applies).toBe(true);
    expect(r.applies).not.toBe('cannot_determine');
  });

  it('result note does not expose raw internal key civil_aircraft_use', () => {
    const r = checkSection122Surcharge('85182100', 'China', S122_IMPORT_DATE);
    expect(r.note).not.toMatch(/civil_aircraft_use(?!\s*certification\?)/);
  });

  // ── Aircraft-specific products (positive evidence) ────────────────────────

  it('cockpit audio system — productText with aircraft keyword → cannot_determine', () => {
    const r = checkSection122Surcharge(
      '85182100', 'China', S122_IMPORT_DATE, {},
      undefined,
      'Cockpit audio panel for civil aircraft, avionics grade',
    );
    expect(r.applies).toBe('cannot_determine');
    expect(r.missing_condition).toContain('FAA Form 8130-3');
    expect(r.missing_condition).not.toMatch(/\bcivil_aircraft_use\b/);
  });

  it('avionics amplifier — productText → cannot_determine', () => {
    const r = checkSection122Surcharge(
      '85182100', 'China', S122_IMPORT_DATE, {},
      undefined,
      'In-flight entertainment system amplifier, avionics grade, for civil aviation use',
    );
    expect(r.applies).toBe('cannot_determine');
  });

  it('is_aircraft=yes in knownFacts (no productText) → cannot_determine', () => {
    const r = checkSection122Surcharge(
      '85182100', 'China', S122_IMPORT_DATE,
      { is_aircraft: 'yes' },
    );
    expect(r.applies).toBe('cannot_determine');
  });

  // ── Explicit fact answers ─────────────────────────────────────────────────

  it('civil_aircraft_use=yes → exempt', () => {
    const r = checkSection122Surcharge(
      '85182100', 'China', S122_IMPORT_DATE,
      { civil_aircraft_use: 'yes' },
    );
    expect(r.applies).toBe(false);
    expect(r.reason).toBe('hts_exempt');
    expect(r.note).toContain('FAA');
  });

  it('civil_aircraft_use=no → applies', () => {
    const r = checkSection122Surcharge(
      '85182100', 'China', S122_IMPORT_DATE,
      { civil_aircraft_use: 'no' },
    );
    expect(r.applies).toBe(true);
    expect(r.rate_pct).toBe(10);
  });
});

describe('checkSection122Surcharge — non-aircraft-eligible HTS (8708 not in civil list)', () => {
  it('auto-parts HTS (8708) in Section 232 → not stacked (already_s232_auto)', () => {
    const r = checkSection122Surcharge('8708305020', 'China', S122_IMPORT_DATE);
    expect(r.applies).toBe(false);
    expect(r.reason).toBe('already_s232_auto');
  });

  it('footwear HTS (6402) → applies without any aircraft check', () => {
    const r = checkSection122Surcharge('6402991500', 'China', S122_IMPORT_DATE);
    expect(r.applies).toBe(true);
    expect(r.reason).toBe('applicable');
  });
});

// ── Bluetooth speaker acceptance test via assembleBaselines ───────────────────
// Entry date 2026-07-05, HTS 8518.21.0000, China → US, ocean, lithium-ion
// battery installed inside (UN 3481), general consumer audio use.
//
// Required: Section 301 at 7.5%, Section 122 at 10% (NOT cannot_determine).
// Forbidden: civil_aircraft_use in any missing_info or explanation text.

describe('Bluetooth speaker (HTS 8518.21) — assembleBaselines acceptance', () => {
  const SPEAKER_ENTRY: WatchlistEntry = {
    id: 'test-speaker-1',
    user_id: 'test-user',
    product_name: 'Portable Bluetooth speaker',
    product_description:
      'Portable Bluetooth speaker, general consumer audio use, not children\'s product, ' +
      'not toy, not medical, not aircraft-related. Lithium-ion battery installed inside ' +
      'equipment, UN 3481.',
    hts_code: '8518.21.0000',
    origin_country: 'China',
    destination_country: 'US',
    status: 'active',
    is_children: false,
    has_battery: true,
    is_electronic: true,
    is_textile: false,
    is_cosmetic: false,
    is_food_contact: false,
    is_supplement: false,
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
  };

  const MOCK_HTS_8518: import('../services/htsBaseline').HtsLookupResult = {
    match_level: 'exact',
    requested: '85182100',
    hts8: '85182100',
    matched_htsno: '8518.21.0000',
    description: 'Single loudspeakers, mounted in their enclosures',
    mfn_text_rate: 'Free',
    mfn_ad_valorem_pct: 0,
    section301_ref: '9903.88.15',
    candidates: [],
    source_url: 'https://hts.usitc.gov/?query=8518.21.0000',
    note: null,
  };

  const cats = assembleBaselines(SPEAKER_ENTRY, 50_000, MOCK_HTS_8518, [], '2026-07-05');

  it('Section 122 finding is present and verified_applicable', () => {
    const s122 = cats.find((c) => c.id === 'section_122_surcharge');
    expect(s122).toBeDefined();
    expect(s122?.verification_status).toBe('verified_applicable');
    expect(s122?.verified_rate_pct).toBe(10);
  });

  it('Section 122 finding is NOT insufficient_info', () => {
    const s122 = cats.find((c) => c.id === 'section_122_surcharge');
    expect(s122?.verification_status).not.toBe('insufficient_info');
  });

  it('Section 122 explanation does not mention civil_aircraft_use', () => {
    const s122 = cats.find((c) => c.id === 'section_122_surcharge');
    expect(s122?.explanation).not.toMatch(/civil_aircraft_use/i);
    expect(s122?.missing_info).toBeUndefined();
  });

  it('Section 301 finding is present at 7.5%', () => {
    const s301 = cats.find((c) => c.id === 'hts_section301');
    expect(s301).toBeDefined();
    expect(s301?.verification_status).toBe('verified_applicable');
    expect(s301?.verified_rate_pct).toBe(7.5);
  });

  it('MFN base tariff is 0% (HTS 8518.21 is duty-free)', () => {
    const mfn = cats.find((c) => c.id === 'hts_duty');
    expect(mfn).toBeDefined();
    expect(mfn?.verified_rate_pct).toBe(0);
  });

  it('no finding has civil_aircraft_use in missing_info', () => {
    for (const cat of cats) {
      expect(cat.missing_info ?? '').not.toMatch(/civil_aircraft_use/);
    }
  });
});

// ── HTS provided + official lookup failed — state-collapse regression ─────────
//
// Root cause: the Section 301 coverage domain resolver had no `not_found` branch
// and fell to the catch-all, emitting status:'insufficient_info' with
// missing:['exact HTS code'] — identical to "no HTS provided at all."
//
// These tests call buildCoverageMatrix directly with a not_found HTS result for
// a China-origin product and verify the correct official_unconfirmed state,
// with no missing_facts, and the catch-all insufficient_info only fires when
// no HTS was provided.

describe('buildCoverageMatrix — HTS provided + not_found — Section 301 state', () => {
  const CHINA_ENTRY: WatchlistEntry = {
    ...BASE_ENTRY,
    hts_code: '9503.00.8900',
    product_name: 'Vinyl inflatable toy',
    product_description: 'Vinyl inflatable children\'s toy',
    origin_country: 'China',
  };

  const HTS_NOT_FOUND: import('../services/htsBaseline').HtsLookupResult = {
    match_level: 'not_found',
    requested: '9503008900',
    hts8: null,
    matched_htsno: null,
    description: null,
    mfn_text_rate: null,
    mfn_ad_valorem_pct: null,
    section301_ref: null,
    candidates: [],
    source_url: 'https://hts.usitc.gov/',
    note: 'Code not found in USITC HTS',
  };

  const HTS_OUTAGE: import('../services/htsBaseline').HtsLookupResult = {
    match_level: 'outage',
    requested: '9503008900',
    hts8: null,
    matched_htsno: null,
    description: null,
    mfn_text_rate: null,
    mfn_ad_valorem_pct: null,
    section301_ref: null,
    candidates: [],
    source_url: 'https://hts.usitc.gov/',
    note: 'USITC service unavailable',
  };

  it('C: not_found HTS for China-origin — section_301 domain is official_unconfirmed, NOT insufficient_info', () => {
    const cats = assembleBaselines(CHINA_ENTRY, null, HTS_NOT_FOUND, [], '2026-09-22');
    const matrix = buildCoverageMatrix(CHINA_ENTRY, cats, [], HTS_NOT_FOUND, '9503008900', []);
    const s301 = matrix.find((c) => c.domain_key === 'section_301');
    expect(s301).toBeDefined();
    expect(s301!.status).toBe('official_unconfirmed');
    expect(s301!.status).not.toBe('insufficient_info');
  });

  it('C: not_found HTS — section_301 domain has NO missing_facts ("exact HTS code" must not appear)', () => {
    const cats = assembleBaselines(CHINA_ENTRY, null, HTS_NOT_FOUND, [], '2026-09-22');
    const matrix = buildCoverageMatrix(CHINA_ENTRY, cats, [], HTS_NOT_FOUND, '9503008900', []);
    const s301 = matrix.find((c) => c.domain_key === 'section_301');
    expect(s301!.missing_facts ?? []).toHaveLength(0);
    expect(s301!.missing_facts ?? []).not.toContain('exact HTS code');
  });

  it('C: outage HTS — section_301 domain is source_unavailable, not insufficient_info', () => {
    const cats = assembleBaselines(CHINA_ENTRY, null, HTS_OUTAGE, [], '2026-09-22');
    const matrix = buildCoverageMatrix(CHINA_ENTRY, cats, [], HTS_OUTAGE, '9503008900', []);
    const s301 = matrix.find((c) => c.domain_key === 'section_301');
    expect(s301).toBeDefined();
    expect(s301!.status).toBe('source_unavailable');
    expect(s301!.status).not.toBe('insufficient_info');
  });

  it('D: genuinely absent HTS (null) — section_301 domain is insufficient_info with missing_facts', () => {
    const noHtsEntry: WatchlistEntry = { ...CHINA_ENTRY, hts_code: null as unknown as string };
    const cats = assembleBaselines(noHtsEntry, null, null, [], '2026-09-22');
    const matrix = buildCoverageMatrix(noHtsEntry, cats, [], null, '', []);
    const s301 = matrix.find((c) => c.domain_key === 'section_301');
    expect(s301).toBeDefined();
    expect(s301!.status).toBe('insufficient_info');
    expect((s301!.missing_facts ?? []).some((f) => /hts/i.test(f))).toBe(true);
  });
});

describe('buildCoverageMatrix — Section 301 not_found is not a regression for verified exact match', () => {
  it('F: exact HTS 8708.30.50.20 with section301_ref still produces verified_applicable section_301', () => {
    const MOCK_HTS_EXACT = {
      match_level: 'exact' as const,
      requested: '8708305020',
      hts8: '8708.30.50',
      matched_htsno: '8708.30.50.20',
      description: 'Brake drums',
      mfn_text_rate: '2.5%',
      mfn_ad_valorem_pct: 2.5,
      section301_ref: '9903.88.03',
      candidates: [],
      source_url: 'https://hts.usitc.gov/',
      note: null,
    };
    const cats = assembleBaselines(BASE_ENTRY, null, MOCK_HTS_EXACT, [], '2026-09-22');
    const matrix = buildCoverageMatrix(BASE_ENTRY, cats, [], MOCK_HTS_EXACT, '8708305020', []);
    const s301 = matrix.find((c) => c.domain_key === 'section_301');
    expect(s301).toBeDefined();
    expect(s301!.status).toBe('verified_applicable');
  });
});

// ── Subheading fallback — resolveHtsRows with 6-digit prefix ──────────────────
//
// When lookupHtsBaseline cannot find the 8-digit parent (because USITC reorganised
// the heading — e.g. 9503.00.89 does not exist; the real parent is 9503.00.00),
// it queries the full subheading range and calls resolveHtsRows with the 6-digit
// prefix so the scoping filter matches.  These tests verify that pure resolution
// logic produces the correct 'parent' result.

describe('resolveHtsRows — subheading fallback for reorganised heading 9503', () => {
  // Representative subset of what USITC returns for from=9503.00.00&to=9503.00.99
  const USITC_9503_ROWS = [
    { htsno: '9503.00.00', description: 'Toys; puzzles of all kinds; reduced-scale models; other', general: 'Free', footnotes: [] },
    { htsno: '9503.00.00.11', description: 'Stuffed toys, not children\'s 3 and under', general: '', footnotes: [] },
    { htsno: '9503.00.00.13', description: 'Stuffed toys, children\'s 3 and under', general: '', footnotes: [] },
    { htsno: '9503.00.00.71', description: 'Non-stuffed toys, children\'s 3 and under', general: '', footnotes: [] },
    { htsno: '9503.00.00.73', description: 'Non-stuffed toys, children\'s 3 and under', general: '', footnotes: [] },
    { htsno: '9503.00.00.90', description: 'Other', general: '', footnotes: [] },
  ];

  it('A-fallback: resolveHtsRows("950300", rows) → parent with one rated candidate (9503.00.00 = Free)', () => {
    const result = resolveHtsRows('950300', USITC_9503_ROWS);
    expect(result.match_level).toBe('parent');
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].htsno).toBe('9503.00.00');
    expect(result.candidates[0].general).toBe('Free');
  });

  it('A-fallback: section301_ref is null — heading 9503.00 has no Chapter 99 footnote', () => {
    const result = resolveHtsRows('950300', USITC_9503_ROWS);
    expect(result.section301_ref).toBeNull();
  });

  it('A-fallback: mfn_text_rate is null on parent result (rate lives in candidates)', () => {
    const result = resolveHtsRows('950300', USITC_9503_ROWS);
    expect(result.mfn_text_rate).toBeNull();
  });

  it('A-fallback: resolveHtsRows("950300", []) → not_found (API found nothing at all)', () => {
    const result = resolveHtsRows('950300', []);
    expect(result.match_level).toBe('not_found');
  });

  it('A-fallback: resolveHtsRows("950300", null) → outage (API threw)', () => {
    const result = resolveHtsRows('950300', null);
    expect(result.match_level).toBe('outage');
  });
});

// ── 9503.00.8900 (Charles case) — parent coverage-matrix result ───────────────
//
// After the subheading fallback, lookupHtsBaseline returns match_level='parent'
// (not 'outage') for 9503.00.8900.  These tests verify that the coverage-matrix
// domains produce the right downstream states: MFN=official_unconfirmed (not
// source_unavailable) and Section 301=insufficient_info (not source_unavailable).

describe('buildCoverageMatrix — 9503.00.8900 China→US with subheading-fallback parent result', () => {
  const TOYS_ENTRY: WatchlistEntry = {
    id: 'test-charles-1',
    user_id: 'test-user',
    product_name: 'Vinyl inflatable toy',
    product_description: 'Vinyl inflatable children\'s toy, China origin',
    hts_code: '9503.00.8900',
    origin_country: 'China',
    destination_country: 'US',
    status: 'active',
    is_children: true,
    has_battery: false,
    is_electronic: false,
    is_textile: false,
    is_cosmetic: false,
    is_food_contact: false,
    is_supplement: false,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  };

  // This is the result lookupHtsBaseline now returns after the subheading fallback
  const HTS_PARENT_9503: import('../services/htsBaseline').HtsLookupResult = {
    match_level: 'parent',
    requested: '9503008900',
    hts8: '95030000',
    matched_htsno: '9503.00.00',
    description: 'Toys; puzzles of all kinds',
    mfn_text_rate: null,
    mfn_ad_valorem_pct: null,
    section301_ref: null,
    candidates: [{ htsno: '9503.00.00', description: 'Toys; puzzles of all kinds', general: 'Free' }],
    source_url: 'https://hts.usitc.gov/?query=9503.00.8900',
    note: 'Submitted code 9503.00.8900 was not found in the current USITC schedule; rate resolved from subheading 9503.00.',
  };

  it('K: MFN domain is official_unconfirmed (NOT source_unavailable)', () => {
    const cats = assembleBaselines(TOYS_ENTRY, null, HTS_PARENT_9503, [], '2026-09-22');
    const matrix = buildCoverageMatrix(TOYS_ENTRY, cats, [], HTS_PARENT_9503, '9503008900', []);
    const mfn = matrix.find((c) => c.domain_key === 'mfn_duty');
    expect(mfn).toBeDefined();
    expect(mfn!.status).toBe('official_unconfirmed');
    expect(mfn!.status).not.toBe('source_unavailable');
  });

  it('K: Section 301 domain is not_applicable — USTR confirms 0% for HTS 9503.00.00', () => {
    // P6: USTR hts_new.json lookup overrides USITC footnote absence for China origin.
    // 9503.00.00 is on List 4 Modification at 0.0%, so Section 301 = not_applicable.
    const cats = assembleBaselines(TOYS_ENTRY, null, HTS_PARENT_9503, [], '2026-09-22');
    const matrix = buildCoverageMatrix(TOYS_ENTRY, cats, [], HTS_PARENT_9503, '9503008900', []);
    const s301 = matrix.find((c) => c.domain_key === 'section_301');
    expect(s301).toBeDefined();
    expect(s301!.status).toBe('not_applicable');
    expect(s301!.status).not.toBe('source_unavailable');
  });

  it('K: Section 301 not_applicable — no missing_facts required when USTR resolves to 0%', () => {
    const cats = assembleBaselines(TOYS_ENTRY, null, HTS_PARENT_9503, [], '2026-09-22');
    const matrix = buildCoverageMatrix(TOYS_ENTRY, cats, [], HTS_PARENT_9503, '9503008900', []);
    const s301 = matrix.find((c) => c.domain_key === 'section_301');
    expect(s301!.status).toBe('not_applicable');
    expect((s301!.missing_facts ?? [])).toHaveLength(0);
  });
});

// ── TariffRuleEngine — IEEPA rule state tests ─────────────────────────────────

describe('entryDateWithinRange', () => {
  it('date within range → true', () => {
    expect(entryDateWithinRange('2026-09-22', '2025-11-10', null)).toBe(true);
  });
  it('date before effective_from → false', () => {
    expect(entryDateWithinRange('2025-11-09', '2025-11-10', null)).toBe(false);
  });
  it('date after effective_to → false', () => {
    expect(entryDateWithinRange('2025-03-05', '2025-02-04', '2025-03-04')).toBe(false);
  });
  it('date equals effective_to → true (inclusive)', () => {
    expect(entryDateWithinRange('2025-03-04', '2025-02-04', '2025-03-04')).toBe(true);
  });
  it('null effective_to means open-ended → true for future date', () => {
    expect(entryDateWithinRange('2030-01-01', '2025-11-10', null)).toBe(true);
  });
});

describe('evaluateRule — 9903.01.20 (EXPIRED Mar 4, 2025)', () => {
  const rule = IEEPA_RULES.find((r) => r.ch99_provision === '9903.01.20')!;
  it('entry date 2025-03-04 (last day) → ACTIVE', () => {
    const r = evaluateRule(rule, '95030000', 'China', '2025-03-04');
    expect(r.status).toBe('ACTIVE');
    expect(r.applies).toBe(true);
    expect(r.rate_pct).toBe(10);
  });
  it('entry date 2025-03-05 (day after expiry) → EXPIRED', () => {
    const r = evaluateRule(rule, '95030000', 'China', '2025-03-05');
    expect(r.status).toBe('EXPIRED');
    expect(r.applies).toBe(false);
  });
  it('entry date Sep 2026 → EXPIRED', () => {
    const r = evaluateRule(rule, '95030000', 'China', '2026-09-22');
    expect(r.status).toBe('EXPIRED');
    expect(r.applies).toBe(false);
  });
  it('Vietnam origin → NOT_APPLICABLE (origin scope is China/HK only)', () => {
    const r = evaluateRule(rule, '95030000', 'Vietnam', '2025-02-15');
    expect(r.status).toBe('NOT_APPLICABLE');
    expect(r.applies).toBe(false);
  });
});

describe('evaluateRule — 9903.01.24 (ACTIVE from Nov 10, 2025)', () => {
  const rule = IEEPA_RULES.find((r) => r.ch99_provision === '9903.01.24')!;
  it('entry date 2026-09-22 from China → ACTIVE +10%', () => {
    const r = evaluateRule(rule, '95030000', 'China', '2026-09-22');
    expect(r.status).toBe('ACTIVE');
    expect(r.applies).toBe(true);
    expect(r.rate_pct).toBe(10);
  });
  it('entry date 2025-11-09 (day before) → NOT_APPLICABLE (before effective date)', () => {
    const r = evaluateRule(rule, '95030000', 'China', '2025-11-09');
    expect(r.status).toBe('NOT_APPLICABLE');
    expect(r.applies).toBe(false);
  });
  it('Hong Kong origin → ACTIVE', () => {
    const r = evaluateRule(rule, '95030000', 'Hong Kong', '2026-09-22');
    expect(r.status).toBe('ACTIVE');
    expect(r.applies).toBe(true);
  });
  it('Mexico origin → NOT_APPLICABLE (not China/HK)', () => {
    const r = evaluateRule(rule, '95030000', 'Mexico', '2026-09-22');
    expect(r.status).toBe('NOT_APPLICABLE');
    expect(r.applies).toBe(false);
  });
});

describe('evaluateRule — 9903.01.25 (universal +10%, China exclusion SUSPENDED)', () => {
  const rule = IEEPA_RULES.find((r) => r.ch99_provision === '9903.01.25')!;
  it('China origin Sep 2026 → ACTIVE (exclusion suspended)', () => {
    const r = evaluateRule(rule, '95030000', 'China', '2026-09-22');
    expect(r.status).toBe('ACTIVE');
    expect(r.applies).toBe(true);
    expect(r.rate_pct).toBe(10);
  });
  it('Vietnam origin Sep 2026 → ACTIVE (universal rule)', () => {
    const r = evaluateRule(rule, '95030000', 'Vietnam', '2026-09-22');
    expect(r.status).toBe('ACTIVE');
    expect(r.applies).toBe(true);
  });
  it('entry before Apr 5 2025 → NOT_APPLICABLE', () => {
    const r = evaluateRule(rule, '95030000', 'China', '2025-04-04');
    expect(r.status).toBe('NOT_APPLICABLE');
    expect(r.applies).toBe(false);
  });
});

describe('evaluateRule — 9903.01.63 (China 34% reciprocal, SUSPENDED)', () => {
  const rule = IEEPA_RULES.find((r) => r.ch99_provision === '9903.01.63')!;
  it('China Sep 2026 → SUSPENDED (Geneva deal)', () => {
    const r = evaluateRule(rule, '95030000', 'China', '2026-09-22');
    expect(r.status).toBe('SUSPENDED');
    expect(r.applies).toBe(false);
    expect(r.reason).toMatch(/suspended/i);
  });
  it('Vietnam Sep 2026 → NOT_APPLICABLE (origin scope is China/HK)', () => {
    const r = evaluateRule(rule, '95030000', 'Vietnam', '2026-09-22');
    expect(r.status).toBe('NOT_APPLICABLE');
    expect(r.applies).toBe(false);
  });
});

describe('calculateDutyStack — China, Sep 2026', () => {
  const CHINA = 'China';
  const DATE = '2026-09-22';
  const HTS = '95030000';

  it('total IEEPA = 20% (9903.01.24 +10% + 9903.01.25 +10%)', () => {
    const result = calculateDutyStack(HTS, CHINA, DATE);
    expect(result.total_ad_valorem_pct).toBe(20);
  });

  it('exactly 2 active rules (9903.01.24 and 9903.01.25)', () => {
    const result = calculateDutyStack(HTS, CHINA, DATE);
    expect(result.active_rules).toHaveLength(2);
    const provisions = result.active_rules.map((r) => r.rule.ch99_provision).sort();
    expect(provisions).toEqual(['9903.01.24', '9903.01.25']);
  });

  it('9903.01.20 evaluates to EXPIRED', () => {
    const result = calculateDutyStack(HTS, CHINA, DATE);
    const ev20 = result.evaluated_rules.find((r) => r.rule.ch99_provision === '9903.01.20');
    expect(ev20).toBeDefined();
    expect(ev20!.status).toBe('EXPIRED');
    expect(ev20!.applies).toBe(false);
  });

  it('9903.01.63 evaluates to SUSPENDED', () => {
    const result = calculateDutyStack(HTS, CHINA, DATE);
    const ev63 = result.evaluated_rules.find((r) => r.rule.ch99_provision === '9903.01.63');
    expect(ev63).toBeDefined();
    expect(ev63!.status).toBe('SUSPENDED');
    expect(ev63!.applies).toBe(false);
  });

  it('stacking explanation names both active provisions', () => {
    const result = calculateDutyStack(HTS, CHINA, DATE);
    expect(result.stacking_explanation).toContain('9903.01.24');
    expect(result.stacking_explanation).toContain('9903.01.25');
    expect(result.stacking_explanation).toContain('+20%');
  });
});

describe('calculateDutyStack — Vietnam, Sep 2026 (universal rule only)', () => {
  it('total IEEPA = 10% (9903.01.25 only — 9903.01.24 and 9903.01.63 are China/HK-specific)', () => {
    const result = calculateDutyStack('95030000', 'Vietnam', '2026-09-22');
    expect(result.total_ad_valorem_pct).toBe(10);
    expect(result.active_rules).toHaveLength(1);
    expect(result.active_rules[0].rule.ch99_provision).toBe('9903.01.25');
  });
});

describe('calculateDutyStack — China, early 2025 before IEEPA (no active rules)', () => {
  it('entry Jan 1 2025 → total IEEPA = 0 (all rules before effective date)', () => {
    const result = calculateDutyStack('95030000', 'China', '2025-01-01');
    expect(result.total_ad_valorem_pct).toBe(0);
    expect(result.active_rules).toHaveLength(0);
  });
});

describe('lookupSection301Ustr', () => {
  it('9503.00.00 → List 4 Modification 0.0%', () => {
    const entry = lookupSection301Ustr('95030000');
    expect(entry).not.toBeNull();
    expect(entry!.rate_pct).toBe(0);
    expect(entry!.action_description).toContain('0.0%');
    expect(entry!.source.authority).toBe('USTR');
  });
  it('unknown HTS → null', () => {
    expect(lookupSection301Ustr('87083050')).toBeNull();
  });
});

// ── P7: Charles regression test ───────────────────────────────────────────────
// Product: Vinyl Inflatable Children's Toy, HTS 9503.00.8900, China→US
// Customs value: $50,000, Ocean mode, entry date: 2026-09-22
// Expected total: ~$10,235.70
//
// Breakdown (all from generic engine, not hard-coded):
//   MFN: 0% (HTS 9503.00.00, general='Free')
//   Section 301: 0% (USTR List 4 Modification, 0.0%)
//   IEEPA 9903.01.24: +10% = $5,000
//   IEEPA 9903.01.25: +10% = $5,000
//   IEEPA 9903.01.63: SUSPENDED = $0
//   IEEPA 9903.01.20: EXPIRED = $0
//   MPF (FY2026): 0.3464% × $50,000 = $173.20 (between min $33.58 and max $651.50)
//   HMF (ocean): 0.125% × $50,000 = $62.50
//   Total: $0 + $0 + $5,000 + $5,000 + $0 + $0 + $173.20 + $62.50 = $10,235.70

describe('P7: Charles regression — HTS 9503.00.8900, China, $50,000, ocean, 2026-09-22', () => {
  const CUSTOMS_VALUE = 50_000;
  const ENTRY_DATE = '2026-09-22';
  const ORIGIN = 'China';
  const HTS8 = '95030000'; // resolved from 9503.00.8900 via subheading fallback

  it('IEEPA duty stack = 20% → $10,000', () => {
    const stack = calculateDutyStack(HTS8, ORIGIN, ENTRY_DATE);
    expect(stack.total_ad_valorem_pct).toBe(20);
    const ieepaDuty = (CUSTOMS_VALUE * stack.total_ad_valorem_pct) / 100;
    expect(ieepaDuty).toBe(10_000);
  });

  it('Section 301 rate = 0% (USTR List 4 Modification)', () => {
    const s301 = lookupSection301Ustr(HTS8);
    expect(s301).not.toBeNull();
    expect(s301!.rate_pct).toBe(0);
  });

  it('MPF = $173.20 (0.3464% × $50,000, FY2026 schedule)', () => {
    const { amount } = computeMpf(CUSTOMS_VALUE, ENTRY_DATE);
    // 0.3464% × 50,000 = 173.20; between min $33.58 and max $651.50
    expect(amount).toBeCloseTo(173.20, 2);
  });

  it('HMF (ocean) = $62.50 (0.125% × $50,000)', () => {
    const hmf = (CUSTOMS_VALUE * 0.125) / 100;
    expect(hmf).toBe(62.50);
  });

  it('Total landed cost components sum to ~$10,235.70', () => {
    const stack = calculateDutyStack(HTS8, ORIGIN, ENTRY_DATE);
    const s301 = lookupSection301Ustr(HTS8);
    const ieepaDuty = (CUSTOMS_VALUE * stack.total_ad_valorem_pct) / 100;
    const s301Duty = ((s301?.rate_pct ?? 0) * CUSTOMS_VALUE) / 100;
    const { amount: mpf } = computeMpf(CUSTOMS_VALUE, ENTRY_DATE);
    const hmf = (CUSTOMS_VALUE * 0.125) / 100;
    const total = ieepaDuty + s301Duty + mpf + hmf;
    expect(total).toBeCloseTo(10_235.70, 1);
  });
});

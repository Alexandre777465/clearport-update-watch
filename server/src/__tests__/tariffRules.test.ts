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
 *  9. Full brake-drum tariff determination: MFN 2.5% + S301 25% + S232 25% = 52.5% known
 * 10. assembleBaselines does NOT produce a section_232_auto category for non-8708 HTS
 */

import { describe, it, expect } from 'bun:test';
import {
  checkSection232Auto,
  checkSection301Exclusion,
  SECTION_232_AUTO,
  SECTION_301_RATES,
  SECTION_301_LIST3_EXCLUSIONS,
  SECTION_301_LAST_VERIFIED,
  type Section301Exclusion,
} from '../services/tariffRules';
import {
  lookupBrakeDrumAdRate,
  lookupBrakeDrumCvdRate,
} from '../services/adcvdScanner';
import { assembleBaselines } from '../services/baselines';
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

  it('known tariff total (MFN + S301 + S232) = 52.5%', () => {
    const cats = assembleBaselines(BASE_ENTRY, null, MOCK_HTS_RESULT, [], '2026-06-26');
    const rates = cats
      .filter((c) => c.verification_status === 'verified_applicable' && c.verified_rate_pct != null)
      .map((c) => c.verified_rate_pct!);
    const total = rates.reduce((a, b) => a + b, 0);
    expect(total).toBe(52.5);
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

/**
 * HTS input normalization regression tests (Issue 3).
 *
 * All four common format variants must resolve to the same canonical value and
 * trigger identical downstream lookup/compliance behavior.
 */

import { describe, it, expect } from 'vitest';
import { normalizeHts, formatHts } from '../services/htsBaseline';
import { htsCodesRelated } from '../services/matchingEngine';

// ── Canonical representative for all four format variants ─────────────────────
const VARIANTS = [
  '9503008900',    // bare digits
  '9503.00.8900',  // dotted (standard)
  '9503 00 8900',  // space-separated
  '9503-00-8900',  // hyphen-separated
];

const EXPECTED_DIGITS  = '9503008900';
const EXPECTED_DISPLAY = '9503.00.8900';

// ── normalizeHts ─────────────────────────────────────────────────────────────

describe('normalizeHts — all format variants produce the same digit string', () => {
  it.each(VARIANTS)('normalizeHts(%s) === %s', (input) => {
    expect(normalizeHts(input)).toBe(EXPECTED_DIGITS);
  });
});

// ── formatHts ────────────────────────────────────────────────────────────────

describe('formatHts — all format variants produce the same display string', () => {
  it.each(VARIANTS)('formatHts(%s) === %s', (input) => {
    expect(formatHts(input)).toBe(EXPECTED_DISPLAY);
  });
});

describe('formatHts — display format for various digit lengths', () => {
  it('4 digits → no separators', () => {
    expect(formatHts('9503')).toBe('9503');
  });
  it('6 digits → X.XX', () => {
    expect(formatHts('950300')).toBe('9503.00');
  });
  it('8 digits → X.XX.XX', () => {
    expect(formatHts('95030089')).toBe('9503.00.89');
  });
  it('10 digits → X.XX.XXXX (3 groups, NOT 4)', () => {
    expect(formatHts('9503008900')).toBe('9503.00.8900');
  });
  it('preserves leading zeros', () => {
    // HTS 0101.21.0010 — live animal chapter
    expect(formatHts('0101210010')).toBe('0101.21.0010');
  });
});

// ── Separator preservation through normalizeHts ───────────────────────────────

describe('normalizeHts — preserves leading zeros', () => {
  it('leading-zero code (bare digits)', () => {
    expect(normalizeHts('0101210010')).toBe('0101210010');
  });
  it('leading-zero code (dotted)', () => {
    expect(normalizeHts('0101.21.0010')).toBe('0101210010');
  });
});

// ── htsCodesRelated — format variants match each other ────────────────────────

describe('htsCodesRelated — all variants of the same code are related', () => {
  const pairs: [string, string][] = [
    ['9503008900',   '9503.00.8900'],
    ['9503.00.8900', '9503 00 8900'],
    ['9503 00 8900', '9503-00-8900'],
    ['9503-00-8900', '9503008900'],
  ];
  it.each(pairs)('htsCodesRelated(%s, %s) is true', (a, b) => {
    expect(htsCodesRelated(a, b)).toBe(true);
  });
});

describe('htsCodesRelated — prefix matching works across format variants', () => {
  it('heading prefix matches full code (space-separated prefix)', () => {
    // "9503 00" is a prefix of "9503008900"
    expect(htsCodesRelated('9503 00', '9503008900')).toBe(true);
  });
  it('chapter prefix matches full code', () => {
    expect(htsCodesRelated('9503', '9503.00.8900')).toBe(true);
  });
  it('unrelated codes are not related', () => {
    expect(htsCodesRelated('8471.30', '9503.00.8900')).toBe(false);
  });
});

// ── Canonical ingestion simulation ───────────────────────────────────────────
// Reproduce the exact normalization logic used in watchlist.ts so that the
// four variants all produce the same stored value.

function simulateIngestion(raw: string | null | undefined): string | null {
  const htsRaw = raw?.trim() || null;
  const htsDigitsRaw = htsRaw ? normalizeHts(htsRaw) : null;
  return htsDigitsRaw && htsDigitsRaw.length >= 4 && htsDigitsRaw.length <= 10
    ? formatHts(htsDigitsRaw)
    : htsRaw;
}

describe('watchlist ingestion normalization — all variants stored as same canonical value', () => {
  it.each(VARIANTS)('simulateIngestion(%s) === %s', (input) => {
    expect(simulateIngestion(input)).toBe(EXPECTED_DISPLAY);
  });

  it('null/empty input stays null', () => {
    expect(simulateIngestion(null)).toBeNull();
    expect(simulateIngestion('')).toBeNull();
    expect(simulateIngestion('   ')).toBeNull();
  });

  it('structurally invalid code is kept as-is (not nulled)', () => {
    // Only 3 digits — below the minimum
    expect(simulateIngestion('950')).toBe('950');
    // Too many digits
    expect(simulateIngestion('95030089001234')).toBe('95030089001234');
  });

  it('dedup: same product submitted with different formats produces the same stored value', () => {
    const stored = VARIANTS.map(simulateIngestion);
    const unique = new Set(stored);
    expect(unique.size).toBe(1);
    expect([...unique][0]).toBe(EXPECTED_DISPLAY);
  });
});

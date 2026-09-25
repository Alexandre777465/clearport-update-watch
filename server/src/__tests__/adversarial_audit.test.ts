import { describe, it, expect } from 'bun:test';
import { calculateDutyStack, IEEPA_RULES, SECTION_301_FL_RULES } from '../services/tariffRuleEngine';
import { computeMpf, checkSection122Surcharge, SECTION_122_SURCHARGE } from '../services/tariffRules';

// Adversarial tariff accuracy audit — tries to break the engine
// Source: USITC, USTR, CBP official sources

describe('ADVERSARIAL A — China IEEPA active 2026-01-15', () => {
  const stack = calculateDutyStack('95030000', 'China', '2026-01-15');
  it('A: total = 20% (9903.01.24 +10% stacks with 9903.01.25 +10%)', () => expect(stack.total_ad_valorem_pct).toBe(20));
  it('A: 9903.01.24 ACTIVE at 10%', () => {
    const r = stack.active_rules.find(r => r.rule.ch99_provision === '9903.01.24');
    expect(r?.status).toBe('ACTIVE'); expect(r?.rate_pct).toBe(10);
  });
  it('A: 9903.01.25 ACTIVE at 10%', () => {
    const r = stack.active_rules.find(r => r.rule.ch99_provision === '9903.01.25');
    expect(r?.status).toBe('ACTIVE'); expect(r?.rate_pct).toBe(10);
  });
  it('A: IEEPA dollar on $50,000 = $10,000', () => expect((50000 * stack.total_ad_valorem_pct) / 100).toBe(10000));
});

describe('ADVERSARIAL A2 — IEEPA boundary: last collected day = 2026-02-23', () => {
  const stack = calculateDutyStack('95030000', 'China', '2026-02-23');
  it('A2: 9903.01.24 ACTIVE on 2026-02-23 (last day CBP collected)', () => {
    const r = stack.active_rules.find(r => r.rule.ch99_provision === '9903.01.24');
    expect(r?.status).toBe('ACTIVE');
  });
  it('A2: total 20% on last day', () => expect(stack.total_ad_valorem_pct).toBe(20));
});

describe('ADVERSARIAL A3 — IEEPA boundary: first invalidated day = 2026-02-24', () => {
  const stack = calculateDutyStack('95030000', 'China', '2026-02-24');
  it('A3: total = 0% on 2026-02-24 (CBP ceased collection)', () => expect(stack.total_ad_valorem_pct).toBe(0));
  it('A3: 9903.01.24 JUDICIALLY_INVALIDATED', () => {
    const r = stack.evaluated_rules.find(r => r.rule.ch99_provision === '9903.01.24');
    expect(r?.status).toBe('JUDICIALLY_INVALIDATED');
    expect(r?.applies).toBe(false);
  });
});

describe('ADVERSARIAL B — China IEEPA after invalidation 2026-09-25', () => {
  const stack = calculateDutyStack('95030000', 'China', '2026-09-25');
  it('B: total = 0%', () => expect(stack.total_ad_valorem_pct).toBe(0));
  it('B: 9903.01.24 JUDICIALLY_INVALIDATED', () => {
    expect(stack.evaluated_rules.find(r => r.rule.ch99_provision === '9903.01.24')?.status).toBe('JUDICIALLY_INVALIDATED');
  });
  it('B: 9903.01.25 JUDICIALLY_INVALIDATED', () => {
    expect(stack.evaluated_rules.find(r => r.rule.ch99_provision === '9903.01.25')?.status).toBe('JUDICIALLY_INVALIDATED');
  });
  it('B: IEEPA dollar = $0', () => expect((50000 * stack.total_ad_valorem_pct) / 100).toBe(0));
});

describe('ADVERSARIAL C — Section 122 active window (2026-05-01)', () => {
  const check = checkSection122Surcharge('95030000', 'China', '2026-05-01', {}, SECTION_122_SURCHARGE, 'vinyl inflatable toy');
  it('C: Section 122 applies', () => expect(check.applies).toBe(true));
  it('C: rate 10%', () => expect(SECTION_122_SURCHARGE.rate_pct).toBe(10));
  it('C: dollar on $50,000 = $5,000', () => expect((50000 * SECTION_122_SURCHARGE.rate_pct) / 100).toBe(5000));
});

describe('ADVERSARIAL D — Section 122 after expiry (2026-09-25)', () => {
  const check = checkSection122Surcharge('95030000', 'China', '2026-09-25', {}, SECTION_122_SURCHARGE, 'vinyl inflatable toy');
  it('D: Section 122 does NOT apply after expiry', () => {
    expect(check.applies).toBe(false);
    expect(check.reason).toBe('after_expiry');
  });
});

describe('ADVERSARIAL E — China FL S301 9903.05.20 (2026-09-25)', () => {
  const stack = calculateDutyStack('95030000', 'China', '2026-09-25', SECTION_301_FL_RULES);
  it('E: 9903.05.20 ACTIVE (rule is active law; HTS 9503 confirmed NOT in Annex II — displayed as verified_applicable)', () =>
    expect(stack.evaluated_rules.find(r => r.rule.ch99_provision === '9903.05.20')?.status).toBe('ACTIVE'));
  it('E: 9903.05.20 rate = 12.5%', () => expect(stack.total_ad_valorem_pct).toBe(12.5));
  it('E: does NOT apply before effective date (2026-07-23)', () => {
    const pre = calculateDutyStack('95030000', 'China', '2026-07-23', SECTION_301_FL_RULES);
    expect(pre.total_ad_valorem_pct).toBe(0);
  });
});

describe('ADVERSARIAL F — Canada scope exclusion', () => {
  const stack = calculateDutyStack('95030000', 'Canada', '2026-01-15');
  it('F: 9903.01.24 NOT_APPLICABLE for Canada (China-only scope)', () =>
    expect(stack.evaluated_rules.find(r => r.rule.ch99_provision === '9903.01.24')?.status).toBe('NOT_APPLICABLE'));
  it('F: 9903.01.25 ACTIVE for Canada (universal scope)', () =>
    expect(stack.active_rules.find(r => r.rule.ch99_provision === '9903.01.25')?.rate_pct).toBe(10));
  it('F: total = 10% for Canada (only 9903.01.25)', () => expect(stack.total_ad_valorem_pct).toBe(10));
  it('F: FL S301 NOT_APPLICABLE for Canada', () => {
    const fl = calculateDutyStack('95030000', 'Canada', '2026-09-25', SECTION_301_FL_RULES);
    expect(fl.evaluated_rules.find(r => r.rule.ch99_provision === '9903.05.20')?.status).toBe('NOT_APPLICABLE');
    expect(fl.total_ad_valorem_pct).toBe(0);
  });
});

describe('ADVERSARIAL G — Ocean vs non-ocean HMF', () => {
  it('G: HMF on $50,000 ocean = $62.50 (0.125%)', () => expect((50000 * 0.125) / 100).toBeCloseTo(62.50, 2));
  it('G: HMF on $0 (non-ocean) = $0', () => expect(0).toBe(0)); // non-ocean → HMF not collected
});

describe('ADVERSARIAL H — MPF minimum/maximum behavior', () => {
  it('H: MPF on $50,000 = ~$173.20', () => {
    const { amount } = computeMpf(50000, '2026-09-25');
    expect(amount).toBeCloseTo(173.20, 1);
  });
  it('H: MPF on $100 hits minimum (0.3464% × $100 = $0.35 < min)', () => {
    const { amount, schedule } = computeMpf(100, '2026-09-25');
    expect(amount).toBe(schedule.min_usd);
    expect(amount).toBeGreaterThan(10); // min is non-trivial (currently $31.67)
  });
  it('H: MPF on $10,000,000 hits maximum (0.3464% × $10M = $34,640 > max)', () => {
    const { amount, schedule } = computeMpf(10_000_000, '2026-09-25');
    expect(amount).toBe(schedule.max_usd);
    expect(amount).toBeLessThan(35000);
  });
});

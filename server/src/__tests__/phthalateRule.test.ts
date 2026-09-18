/**
 * Regression tests for CPSIA Section 108 / 16 CFR Part 1307 phthalate rule.
 *
 * Root cause addressed: the compliance engine failed to evaluate the
 * material × product-category × intended-user combination because
 * `contains_soft_plastic` was not a first-class FactKey and no phthalate
 * finding existed in childrens.ts.
 *
 * Each test verifies the correct finding level and verification_status for
 * one decisive combination of (children status) × (soft-plastic status).
 */

import { describe, it, expect } from 'vitest';
import { childrensModule } from '../services/regulatoryModules/childrens';
import type { ModuleInput } from '../services/regulatoryModules/index';

// ── Minimal ModuleInput builder ───────────────────────────────────────────────

function makeInput(overrides: Partial<ModuleInput> = {}): ModuleInput {
  return {
    htsDigits:   '9503008900',
    productText: overrides.productText ?? '',
    importDate:  '2026-09-18',
    attrs: { is_children: false, ...overrides.attrs },
    knownFacts:  overrides.knownFacts ?? {},
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getPhthalate(input: ModuleInput) {
  const result = childrensModule.evaluate(input);
  return result.findings.find((f) => f.id === 'cpsia_phthalates');
}

function getPhthalateDocSpec(input: ModuleInput) {
  const result = childrensModule.evaluate(input);
  return result.docSpecs.find((d) => d.finding_id === 'cpsia_phthalates');
}

// ── Test 1: vinyl inflatable children's toy → Critical ────────────────────────
// The real customer case that exposed the missing architecture.
// "vinyl inflatable" text → contains_soft_plastic inferred/explicit; is_children confirmed.

describe('phthalate finding — vinyl inflatable children\'s toy', () => {
  it('surfaces Critical phthalate finding when product is confirmed children\'s + vinyl', () => {
    const input = makeInput({
      productText: 'vinyl inflatable toy for children',
      attrs: { is_children: true },
      knownFacts: { contains_soft_plastic: 'yes', age_range: 'age_3_to_12' },
    });
    const f = getPhthalate(input);
    expect(f).toBeDefined();
    expect(f!.level).toBe('Critical');
    expect(f!.verification_status).toBe('verified_applicable');
  });

  it('includes a phthalate test report docSpec when Critical', () => {
    const input = makeInput({
      attrs: { is_children: true },
      knownFacts: { contains_soft_plastic: 'yes', age_range: 'age_3_to_12' },
    });
    const d = getPhthalateDocSpec(input);
    expect(d).toBeDefined();
    expect(d!.doc_status).toBe('required_to_clear');
  });
});

// ── Test 2: inflatable toy, no material info → Medium (needs confirmation) ───

describe('phthalate finding — inflatable toy, material unknown', () => {
  it('surfaces Medium phthalate finding when children\'s product but soft-plastic status unknown', () => {
    const input = makeInput({
      productText: 'inflatable toy',
      attrs: { is_children: true },
      // knownFacts has no 'contains_soft_plastic' entry → unknown
    });
    const f = getPhthalate(input);
    expect(f).toBeDefined();
    // "inflatable" triggers inference in TEXT_RULES but is NOT a confirmed yes —
    // the finding should be Medium, not Critical.
    expect(f!.level).toBe('Medium');
    expect(f!.verification_status).toBe('insufficient_info');
  });
});

// ── Test 3: hard plastic children's toy → N/A ────────────────────────────────

describe('phthalate finding — hard plastic children\'s toy', () => {
  it('surfaces N/A phthalate finding when soft plastic is explicitly denied', () => {
    const input = makeInput({
      attrs: { is_children: true },
      knownFacts: {
        contains_soft_plastic: 'no',
        age_range: 'age_3_to_12',
      },
    });
    const f = getPhthalate(input);
    expect(f).toBeDefined();
    expect(f!.level).toBe('N/A');
    expect(f!.verification_status).toBe('not_applicable');
  });

  it('surfaces N/A when text contains "hard plastic" (TEXT_RULES negativeRe)', () => {
    const input = makeInput({
      productText: 'hard plastic children\'s building block toy',
      attrs: { is_children: true },
      knownFacts: { age_range: 'age_3_to_12' },
    });
    const f = getPhthalate(input);
    expect(f).toBeDefined();
    expect(f!.level).toBe('N/A');
  });
});

// ── Test 4: adult inflatable item → N/A (not children's) ─────────────────────

describe('phthalate finding — adult inflatable (not children\'s)', () => {
  it('surfaces N/A phthalate finding when age_range is over_12', () => {
    const input = makeInput({
      productText: 'inflatable pool float',
      attrs: { is_children: false },
      knownFacts: { age_range: 'over_12', contains_soft_plastic: 'yes' },
    });
    const f = getPhthalate(input);
    expect(f).toBeDefined();
    expect(f!.level).toBe('N/A');
  });
});

// ── Test 5: explicit contains_soft_plastic: 'no' answer → N/A ────────────────

describe('phthalate finding — children\'s toy, explicit soft-plastic denial', () => {
  it('surfaces N/A when user explicitly answers contains_soft_plastic: no', () => {
    const input = makeInput({
      attrs: { is_children: true },
      knownFacts: {
        age_range: 'age_3_to_12',
        contains_soft_plastic: 'no',
      },
    });
    const f = getPhthalate(input);
    expect(f).toBeDefined();
    expect(f!.level).toBe('N/A');
    expect(f!.verification_status).toBe('not_applicable');
  });
});

// ── Test 6: HTS 9503 with no additional info → Medium ────────────────────────
// HTS 9503 makes children confirmed via HTS indication; soft-plastic is unknown.
// Expected: Medium (children confirmed, material needs confirmation).

describe('phthalate finding — HTS 9503 children\'s toy, material unknown', () => {
  it('surfaces Medium phthalate finding when HTS confirms children\'s product but material is unknown', () => {
    const input = makeInput({
      productText: '',  // no additional text cues
      // knownFacts empty — no age_range, no contains_soft_plastic
      // HTS 9503 causes childrenConfirmed via HTS indication in extractFacts
    });
    const f = getPhthalate(input);
    expect(f).toBeDefined();
    expect(f!.level).toBe('Medium');
    expect(f!.verification_status).toBe('insufficient_info');
  });
});

// ── Test 7: not_applicable age answer with soft plastic → N/A ────────────────
// Verifies childrenDefinitelyNot gate overrides soft-plastic even when confirmed.

describe('phthalate finding — not_applicable age range with soft plastic', () => {
  it('surfaces N/A when age_range is not_applicable even with soft plastic present', () => {
    const input = makeInput({
      attrs: { is_children: true },
      knownFacts: {
        age_range: 'not_applicable',
        contains_soft_plastic: 'yes',
      },
    });
    const f = getPhthalate(input);
    expect(f).toBeDefined();
    expect(f!.level).toBe('N/A');
    expect(f!.verification_status).toBe('not_applicable');
  });
});

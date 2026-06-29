/**
 * Universal engine benchmark tests — 15 representative products.
 *
 * Verifies that:
 *   1. The correct category modules activate for each product.
 *   2. Each module produces findings with a permitted verification_status.
 *   3. Coverage domains are present for every activated module.
 *   4. DocSpecs from activated modules are included in the output.
 *   5. No invented dollar amounts, rates, or factual claims appear.
 *   6. Modules that do NOT apply are not activated.
 *
 * These tests run the DETERMINISTIC module engine only — no network, no DB,
 * no Anthropic calls.
 */

import { describe, it, expect } from 'bun:test';
import { evaluateAllModules, getActiveModules } from '../services/regulatoryModules/index';
import type { ModuleInput } from '../services/regulatoryModules/index';
import { detectCategories } from '../services/categoryDetector';

const PERMITTED_STATUSES = new Set([
  'verified_applicable',
  'official_unconfirmed',
  'not_applicable',
  'no_verified_source',
  'insufficient_info',
]);

const PERMITTED_DOC_STATUSES = new Set([
  'required_to_clear',
  'required_if',
  'usually_requested',
  'before_sale',
  'not_required',
  'cannot_determine',
]);

function makeInput(
  htsDigits: string,
  productText: string,
  attrs: ModuleInput['attrs'] = {},
  originCountry = 'China',
): ModuleInput {
  return {
    htsDigits,
    productText,
    attrs,
    originCountry,
    importDate: '2026-06-26',
    knownFacts: {},
  };
}

function assertStructural(result: ReturnType<typeof evaluateAllModules>) {
  // All findings must have a permitted verification_status.
  for (const f of result.findings) {
    expect(PERMITTED_STATUSES.has(f.verification_status ?? '')).toBe(true);
    // Verified findings must carry a source.
    if (f.verification_status === 'verified_applicable') {
      expect(f.source).toBeDefined();
      expect(f.source?.url).toBeTruthy();
    }
    // no_verified_source must never carry a dollar amount.
    if (f.verification_status === 'no_verified_source') {
      expect(f.verified_rate_pct ?? null).toBeNull();
      expect(f.financial_impact).toBeUndefined();
    }
  }
  // All docSpecs must have a permitted doc_status.
  for (const d of result.docSpecs) {
    expect(PERMITTED_DOC_STATUSES.has(d.doc_status)).toBe(true);
    // finding_id must be non-empty.
    expect(d.finding_id).toBeTruthy();
  }
  // All coverageDomains must have a valid status.
  for (const c of result.coverageDomains) {
    expect(c.domain_key).toBeTruthy();
    expect(c.domain).toBeTruthy();
    expect(c.category).toBeTruthy();
  }
}

// ── 1. Bluetooth speaker ───────────────────────────────────────────────────────
describe('bluetooth_speaker', () => {
  const input = makeInput(
    '8518220000',
    'Bluetooth wireless speaker portable rechargeable',
    { is_electronic: true, has_battery: true },
  );

  it('activates electronics and batteries modules', () => {
    const cats = detectCategories(input.htsDigits, input.productText, input.attrs);
    expect(cats.has('electronics')).toBe(true);
    expect(cats.has('batteries')).toBe(true);
  });

  it('does NOT activate automotive, childrens, food, textiles, cosmetics, medical_devices', () => {
    const cats = detectCategories(input.htsDigits, input.productText, input.attrs);
    expect(cats.has('automotive')).toBe(false);
    expect(cats.has('childrens')).toBe(false);
    expect(cats.has('food')).toBe(false);
    expect(cats.has('textiles')).toBe(false);
    expect(cats.has('cosmetics')).toBe(false);
    expect(cats.has('medical_devices')).toBe(false);
  });

  it('passes structural assertions', () => {
    assertStructural(evaluateAllModules(input));
  });

  it('produces FCC and battery coverage domains', () => {
    const result = evaluateAllModules(input);
    const keys = result.coverageDomains.map((c) => c.domain_key);
    expect(keys.some((k) => k.includes('fcc'))).toBe(true);
    expect(keys.some((k) => k.includes('phmsa'))).toBe(true);
  });

  it('asks about wireless transmitter and battery type', () => {
    const result = evaluateAllModules(input);
    const qKeys = result.questions.map((q) => q.key);
    expect(qKeys).toContain('has_wireless_tx');
    expect(qKeys).toContain('battery_type');
  });
});

// ── 2. Wired table lamp ────────────────────────────────────────────────────────
describe('wired_lamp', () => {
  const input = makeInput(
    '9405100000',
    'Table lamp LED desk light wired electric',
    { is_electronic: true },
  );

  it('activates electronics module', () => {
    const cats = detectCategories(input.htsDigits, input.productText, input.attrs);
    expect(cats.has('electronics')).toBe(true);
    expect(cats.has('batteries')).toBe(false);
  });

  it('passes structural assertions', () => {
    assertStructural(evaluateAllModules(input));
  });

  it('asks about wireless transmitter', () => {
    const result = evaluateAllModules(input);
    expect(result.questions.map((q) => q.key)).toContain('has_wireless_tx');
  });
});

// ── 3. Painted children's toy ──────────────────────────────────────────────────
describe('painted_toy', () => {
  const input = makeInput(
    '9503000000',
    'painted plastic toy action figure for children',
    { is_children: true },
  );

  it('activates childrens module', () => {
    const cats = detectCategories(input.htsDigits, input.productText, input.attrs);
    expect(cats.has('childrens')).toBe(true);
  });

  it('does NOT activate automotive or food', () => {
    const cats = detectCategories(input.htsDigits, input.productText, input.attrs);
    expect(cats.has('automotive')).toBe(false);
    expect(cats.has('food')).toBe(false);
  });

  it('produces cpsia_childrens coverage domain', () => {
    const result = evaluateAllModules(input);
    const keys = result.coverageDomains.map((c) => c.domain_key);
    expect(keys).toContain('cpsia_childrens');
  });

  it('produces third-party testing docSpec', () => {
    const result = evaluateAllModules(input);
    const docNames = result.docSpecs.map((d) => d.document.toLowerCase());
    expect(docNames.some((n) => n.includes('test') || n.includes('cpsia'))).toBe(true);
  });

  it('asks about paint and age range', () => {
    const result = evaluateAllModules(input);
    const qKeys = result.questions.map((q) => q.key);
    expect(qKeys).toContain('contains_paint_or_surface_coating');
  });

  it('passes structural assertions', () => {
    assertStructural(evaluateAllModules(input));
  });
});

// ── 4. Cotton T-shirt ──────────────────────────────────────────────────────────
describe('cotton_tshirt', () => {
  const input = makeInput(
    '6109100000',
    'cotton knit t-shirt apparel clothing',
    { is_textile: true },
  );

  it('activates textiles module', () => {
    const cats = detectCategories(input.htsDigits, input.productText, input.attrs);
    expect(cats.has('textiles')).toBe(true);
  });

  it('does NOT activate electronics, automotive, food, childrens', () => {
    const cats = detectCategories(input.htsDigits, input.productText, input.attrs);
    expect(cats.has('electronics')).toBe(false);
    expect(cats.has('automotive')).toBe(false);
    expect(cats.has('food')).toBe(false);
    expect(cats.has('childrens')).toBe(false);
  });

  it('produces ftc_textile_labeling finding', () => {
    const result = evaluateAllModules(input);
    const ids = result.findings.map((f) => f.id);
    expect(ids).toContain('ftc_textile_labeling');
  });

  it('produces ftc_care_labeling coverage domain', () => {
    const result = evaluateAllModules(input);
    const keys = result.coverageDomains.map((c) => c.domain_key);
    expect(keys).toContain('ftc_care_labeling');
  });

  it('passes structural assertions', () => {
    assertStructural(evaluateAllModules(input));
  });
});

// ── 5. Leather shoes ──────────────────────────────────────────────────────────
describe('leather_shoes', () => {
  const input = makeInput(
    '6403990000',
    'leather shoes footwear adult',
    {},
  );

  it('activates textiles (footwear) module', () => {
    const cats = detectCategories(input.htsDigits, input.productText, input.attrs);
    expect(cats.has('textiles')).toBe(true);
  });

  it('passes structural assertions', () => {
    assertStructural(evaluateAllModules(input));
  });
});

// ── 6. Moisturizer (cosmetic) ─────────────────────────────────────────────────
describe('moisturizer', () => {
  const input = makeInput(
    '3304990000',
    'facial moisturizer skincare cream lotion',
    { is_cosmetic: true },
  );

  it('activates cosmetics module', () => {
    const cats = detectCategories(input.htsDigits, input.productText, input.attrs);
    expect(cats.has('cosmetics')).toBe(true);
  });

  it('does NOT activate food or medical_devices', () => {
    const cats = detectCategories(input.htsDigits, input.productText, input.attrs);
    expect(cats.has('food')).toBe(false);
    expect(cats.has('medical_devices')).toBe(false);
  });

  it('produces fda_cosmetic_mocra finding (verified_applicable)', () => {
    const result = evaluateAllModules(input);
    const f = result.findings.find((x) => x.id === 'fda_cosmetic_mocra');
    expect(f).toBeDefined();
    expect(f?.verification_status).toBe('verified_applicable');
  });

  it('asks about OTC ingredient', () => {
    const result = evaluateAllModules(input);
    expect(result.questions.map((q) => q.key)).toContain('contains_otc_ingredient');
  });

  it('passes structural assertions', () => {
    assertStructural(evaluateAllModules(input));
  });
});

// ── 7. Sunscreen SPF 50 ───────────────────────────────────────────────────────
describe('sunscreen', () => {
  const input = makeInput(
    '3304990000',
    'sunscreen SPF 50 UV protection lotion',
    { is_cosmetic: true },
    'Japan',
  );

  it('activates cosmetics module', () => {
    const cats = detectCategories(input.htsDigits, input.productText, input.attrs);
    expect(cats.has('cosmetics')).toBe(true);
  });

  it('produces fda_otc_drug finding when sunscreen OTC ingredient confirmed', () => {
    const inputWithFacts: ModuleInput = { ...input, knownFacts: { contains_otc_ingredient: 'yes_sunscreen' } };
    const result = evaluateAllModules(inputWithFacts);
    const f = result.findings.find((x) => x.id === 'fda_otc_drug');
    expect(f).toBeDefined();
    expect(f?.verification_status).toBe('verified_applicable');
  });

  it('fda_otc_drug is insufficient_info when no answer given', () => {
    const result = evaluateAllModules(input);
    const f = result.findings.find((x) => x.id === 'fda_otc_drug');
    expect(f).toBeDefined();
    expect(f?.verification_status).toBe('insufficient_info');
  });

  it('passes structural assertions', () => {
    assertStructural(evaluateAllModules(input));
  });
});

// ── 8. Packaged snack food ────────────────────────────────────────────────────
describe('packaged_snack', () => {
  const input = makeInput(
    '1905310000',
    'packaged snack food biscuit cookies',
    {},
    'Mexico',
  );

  it('activates food module', () => {
    const cats = detectCategories(input.htsDigits, input.productText, input.attrs);
    expect(cats.has('food')).toBe(true);
  });

  it('does NOT activate automotive, electronics, childrens, textiles', () => {
    const cats = detectCategories(input.htsDigits, input.productText, input.attrs);
    expect(cats.has('automotive')).toBe(false);
    expect(cats.has('electronics')).toBe(false);
    expect(cats.has('childrens')).toBe(false);
    expect(cats.has('textiles')).toBe(false);
  });

  it('produces fda_prior_notice finding (verified_applicable)', () => {
    const result = evaluateAllModules(input);
    const f = result.findings.find((x) => x.id === 'fda_prior_notice');
    expect(f).toBeDefined();
    expect(f?.verification_status).toBe('verified_applicable');
  });

  it('fda_fsis_inspection is not_applicable for non-meat snack', () => {
    const inputWithFacts: ModuleInput = { ...input, knownFacts: { is_meat_or_poultry: 'no' } };
    const result = evaluateAllModules(inputWithFacts);
    const f = result.findings.find((x) => x.id === 'fda_fsis_inspection');
    expect(f?.verification_status).toBe('not_applicable');
  });

  it('includes FDA Prior Notice receipt docSpec', () => {
    const result = evaluateAllModules(input);
    const docNames = result.docSpecs.map((d) => d.document.toLowerCase());
    expect(docNames.some((n) => n.includes('prior notice'))).toBe(true);
  });

  it('passes structural assertions', () => {
    assertStructural(evaluateAllModules(input));
  });
});

// ── 9. Canned meat ────────────────────────────────────────────────────────────
describe('canned_meat', () => {
  const input = makeInput(
    '1602310000',
    'canned cooked beef meat product',
    {},
    'Australia',
  );

  it('activates food module', () => {
    const cats = detectCategories(input.htsDigits, input.productText, input.attrs);
    expect(cats.has('food')).toBe(true);
  });

  it('fda_fsis_inspection is verified_applicable when confirmed meat', () => {
    const inputWithFacts: ModuleInput = { ...input, knownFacts: { is_meat_or_poultry: 'yes_meat' } };
    const result = evaluateAllModules(inputWithFacts);
    const f = result.findings.find((x) => x.id === 'fda_fsis_inspection');
    expect(f).toBeDefined();
    expect(f?.verification_status).toBe('verified_applicable');
  });

  it('fda_prior_notice is not_applicable when confirmed meat', () => {
    const inputWithFacts: ModuleInput = { ...input, knownFacts: { is_meat_or_poultry: 'yes_meat' } };
    const result = evaluateAllModules(inputWithFacts);
    const f = result.findings.find((x) => x.id === 'fda_prior_notice');
    expect(f?.verification_status).toBe('not_applicable');
  });

  it('passes structural assertions', () => {
    assertStructural(evaluateAllModules(input));
  });
});

// ── 10. Class II medical device ────────────────────────────────────────────────
describe('class2_medical_device', () => {
  const input = makeInput(
    '9018190000',
    'blood pressure monitor medical device diagnostic',
    {},
    'Germany',
  );

  it('activates medical_devices module', () => {
    const cats = detectCategories(input.htsDigits, input.productText, input.attrs);
    expect(cats.has('medical_devices')).toBe(true);
  });

  it('produces fda_device_registration finding (verified_applicable)', () => {
    const result = evaluateAllModules(input);
    const f = result.findings.find((x) => x.id === 'fda_device_registration');
    expect(f).toBeDefined();
    expect(f?.verification_status).toBe('verified_applicable');
  });

  it('fda_device_premarket is insufficient_info when class unknown', () => {
    const result = evaluateAllModules(input);
    const f = result.findings.find((x) => x.id === 'fda_device_premarket');
    expect(f?.verification_status).toBe('insufficient_info');
  });

  it('fda_device_premarket is verified_applicable for Class II when confirmed', () => {
    const inputWithFacts: ModuleInput = { ...input, knownFacts: { fda_device_class: 'class_2' } };
    const result = evaluateAllModules(inputWithFacts);
    const f = result.findings.find((x) => x.id === 'fda_device_premarket');
    expect(f).toBeDefined();
    expect(f?.verification_status).toBe('verified_applicable');
  });

  it('asks about FDA device class', () => {
    const result = evaluateAllModules(input);
    expect(result.questions.map((q) => q.key)).toContain('fda_device_class');
  });

  it('passes structural assertions', () => {
    assertStructural(evaluateAllModules(input));
  });
});

// ── 11. Disinfectant (pesticide/biocide) ──────────────────────────────────────
describe('disinfectant', () => {
  const input = makeInput(
    '3808940000',
    'disinfectant spray antimicrobial cleaner kills bacteria viruses',
    {},
    'China',
  );

  it('activates chemicals module', () => {
    const cats = detectCategories(input.htsDigits, input.productText, input.attrs);
    expect(cats.has('chemicals')).toBe(true);
  });

  it('epa_fifra is verified_applicable when pesticide confirmed', () => {
    const inputWithFacts: ModuleInput = { ...input, knownFacts: { is_pesticide_or_disinfectant: 'yes' } };
    const result = evaluateAllModules(inputWithFacts);
    const f = result.findings.find((x) => x.id === 'epa_fifra');
    expect(f).toBeDefined();
    expect(f?.verification_status).toBe('verified_applicable');
  });

  it('epa_tsca is official_unconfirmed always for chemicals', () => {
    const result = evaluateAllModules(input);
    const f = result.findings.find((x) => x.id === 'epa_tsca');
    expect(f?.verification_status).toBe('official_unconfirmed');
  });

  it('includes TSCA certification docSpec', () => {
    const result = evaluateAllModules(input);
    const docNames = result.docSpecs.map((d) => d.document.toLowerCase());
    expect(docNames.some((n) => n.includes('tsca'))).toBe(true);
  });

  it('passes structural assertions', () => {
    assertStructural(evaluateAllModules(input));
  });
});

// ── 12. Standalone lithium-ion battery ────────────────────────────────────────
describe('standalone_lithium_battery', () => {
  const input = makeInput(
    '8507600000',
    'lithium ion battery cell rechargeable standalone',
    { has_battery: true },
  );

  it('activates batteries module', () => {
    const cats = detectCategories(input.htsDigits, input.productText, input.attrs);
    expect(cats.has('batteries')).toBe(true);
  });

  it('phmsa_un383 is verified_applicable when lithium confirmed', () => {
    const inputWithFacts: ModuleInput = { ...input, knownFacts: { battery_type: 'lithium_ion' } };
    const result = evaluateAllModules(inputWithFacts);
    const f = result.findings.find((x) => x.id === 'phmsa_un383');
    expect(f).toBeDefined();
    expect(f?.verification_status).toBe('verified_applicable');
  });

  it('phmsa_un383 is insufficient_info when battery type unknown', () => {
    const result = evaluateAllModules(input);
    const f = result.findings.find((x) => x.id === 'phmsa_un383');
    expect(f?.verification_status).toBe('insufficient_info');
  });

  it('produces UN 38.3 test summary docSpec when lithium confirmed', () => {
    const inputWithFacts: ModuleInput = { ...input, knownFacts: { battery_type: 'lithium_ion', battery_configuration: 'standalone_loose' } };
    const result = evaluateAllModules(inputWithFacts);
    const docNames = result.docSpecs.map((d) => d.document.toLowerCase());
    expect(docNames.some((n) => n.includes('un 38.3'))).toBe(true);
  });

  it('passes structural assertions', () => {
    assertStructural(evaluateAllModules(input));
  });
});

// ── 13. Composite wood furniture ──────────────────────────────────────────────
describe('composite_wood_furniture', () => {
  const input = makeInput(
    '9403600000',
    'wooden cabinet furniture MDF particleboard composite wood',
    {},
    'China',
  );

  it('activates furniture module', () => {
    const cats = detectCategories(input.htsDigits, input.productText, input.attrs);
    expect(cats.has('furniture')).toBe(true);
  });

  it('epa_tsca_title_vi is verified_applicable when composite wood confirmed', () => {
    const inputWithFacts: ModuleInput = { ...input, knownFacts: { contains_composite_wood: 'yes' } };
    const result = evaluateAllModules(inputWithFacts);
    const f = result.findings.find((x) => x.id === 'epa_tsca_title_vi');
    expect(f).toBeDefined();
    expect(f?.verification_status).toBe('verified_applicable');
  });

  it('epa_tsca_title_vi is insufficient_info when not answered', () => {
    const result = evaluateAllModules(input);
    const f = result.findings.find((x) => x.id === 'epa_tsca_title_vi');
    expect(f?.verification_status).toBe('insufficient_info');
  });

  it('asks about composite wood content', () => {
    const result = evaluateAllModules(input);
    expect(result.questions.map((q) => q.key)).toContain('contains_composite_wood');
  });

  it('includes TPC certificate docSpec when composite wood confirmed', () => {
    const inputWithFacts: ModuleInput = { ...input, knownFacts: { contains_composite_wood: 'yes' } };
    const result = evaluateAllModules(inputWithFacts);
    const docNames = result.docSpecs.map((d) => d.document.toLowerCase());
    expect(docNames.some((n) => n.includes('tpc') || n.includes('third-party certifier'))).toBe(true);
  });

  it('passes structural assertions', () => {
    assertStructural(evaluateAllModules(input));
  });
});

// ── 14. Brake drum (reference product — existing working logic) ───────────────
describe('brake_drum', () => {
  const input = makeInput(
    '8708305020',
    'brake drum automotive passenger vehicle hydraulic brake system',
    {},
    'China',
  );

  it('activates automotive module', () => {
    const cats = detectCategories(input.htsDigits, input.productText, input.attrs);
    expect(cats.has('automotive')).toBe(true);
  });

  it('does NOT activate food, textiles, childrens, cosmetics', () => {
    const cats = detectCategories(input.htsDigits, input.productText, input.attrs);
    expect(cats.has('food')).toBe(false);
    expect(cats.has('textiles')).toBe(false);
    expect(cats.has('childrens')).toBe(false);
    expect(cats.has('cosmetics')).toBe(false);
  });

  it('nhtsa_fmvss_135 is verified_applicable when passenger+hydraulic confirmed', () => {
    const inputWithFacts: ModuleInput = {
      ...input,
      knownFacts: { vehicle_type: 'passenger_vehicle', brake_system_type: 'hydraulic' },
    };
    const result = evaluateAllModules(inputWithFacts);
    const f = result.findings.find((x) => x.id === 'nhtsa_fmvss_135');
    expect(f).toBeDefined();
    expect(f?.verification_status).toBe('verified_applicable');
  });

  it('nhtsa_fmvss coverage domain is present', () => {
    const result = evaluateAllModules(input);
    const keys = result.coverageDomains.map((c) => c.domain_key);
    expect(keys).toContain('nhtsa_fmvss');
  });

  it('FMVSS self-certification docSpec is emitted when passenger+hydraulic confirmed', () => {
    const inputWithFacts: ModuleInput = {
      ...input,
      knownFacts: { vehicle_type: 'passenger_vehicle', brake_system_type: 'hydraulic' },
    };
    const result = evaluateAllModules(inputWithFacts);
    const docNames = result.docSpecs.map((d) => d.document.toLowerCase());
    expect(docNames.some((n) => n.includes('fmvss') || n.includes('hs-7'))).toBe(true);
  });

  it('asks about vehicle_type', () => {
    const result = evaluateAllModules(input);
    expect(result.questions.map((q) => q.key)).toContain('vehicle_type');
  });

  it('passes structural assertions', () => {
    assertStructural(evaluateAllModules(input));
  });
});

// ── 15. Generic mechanical part (no specific module) ─────────────────────────
describe('generic_mechanical_part', () => {
  const input = makeInput(
    '7326900000',
    'steel bracket mounting hardware industrial part',
    {},
    'China',
  );

  it('does NOT activate any product-specific regulatory module', () => {
    const cats = detectCategories(input.htsDigits, input.productText, input.attrs);
    expect(cats.has('automotive')).toBe(false);
    expect(cats.has('electronics')).toBe(false);
    expect(cats.has('batteries')).toBe(false);
    expect(cats.has('childrens')).toBe(false);
    expect(cats.has('textiles')).toBe(false);
    expect(cats.has('cosmetics')).toBe(false);
    expect(cats.has('food')).toBe(false);
    expect(cats.has('medical_devices')).toBe(false);
    expect(cats.has('furniture')).toBe(false);
  });

  it('evaluateAllModules produces no findings (no active modules)', () => {
    const result = evaluateAllModules(input);
    expect(result.findings).toHaveLength(0);
    expect(result.docSpecs).toHaveLength(0);
    expect(result.coverageDomains).toHaveLength(0);
  });

  it('getActiveModules returns empty array', () => {
    const active = getActiveModules(input);
    expect(active).toHaveLength(0);
  });
});

// ── Acceptance regression tests for correctness issues ────────────────────────
// Reference: Issues identified in user acceptance test on 2026-06-28.
// Covers: Section 301 rate table, FCC consolidation, transport mode gating,
// AD/CVD gating, document deduplication.

import {
  SECTION_301_RATES,
  checkSection301Exclusion,
  checkSection122Surcharge,
  SECTION_122_SURCHARGE,
  computeMpf,
  MPF_FY2026,
  MPF_FY2025,
} from '../services/tariffRules';

// ── Section 301 rate table ────────────────────────────────────────────────────
describe('SECTION_301_RATES — rate table completeness', () => {
  it('9903.88.15 is in the rate table at 7.5% (covers HTS 8518 audio speakers)', () => {
    const entry = SECTION_301_RATES['9903.88.15'];
    expect(entry).toBeDefined();
    expect(entry?.rate_pct).toBe(7.5);
  });

  it('classic List 3 rate (9903.88.03) is 25%', () => {
    expect(SECTION_301_RATES['9903.88.03']?.rate_pct).toBe(25);
  });

  it('List 4A (9903.88.04) is 7.5%', () => {
    expect(SECTION_301_RATES['9903.88.04']?.rate_pct).toBe(7.5);
  });

  it('checkSection301Exclusion returns no exclusion for 8518210000 (no active exclusion in DB)', () => {
    const result = checkSection301Exclusion('8518210000', '2026-06-28');
    expect(result.excluded).toBe(false);
    expect(result.exclusion).toBeNull();
  });
});

// ── FCC: consolidated output for Bluetooth speaker ───────────────────────────
describe('FCC module — Bluetooth speaker (has_wireless_tx confirmed)', () => {
  const input: ModuleInput = {
    htsDigits: '8518210000',
    productText: 'portable bluetooth speaker audio',
    attrs: { is_electronic: true },
    originCountry: 'China',
    importDate: '2026-06-28',
    knownFacts: { has_wireless_tx: 'yes', product_function: 'audio_speaker' },
  };

  it('electronics module detects this product', () => {
    const active = getActiveModules(input);
    expect(active.map((m) => m.id)).toContain('electronics');
  });

  it('emits exactly ONE FCC-related finding (Equipment Authorization) not two', () => {
    const result = evaluateAllModules(input);
    const fccFindings = result.findings.filter((f) =>
      f.id === 'fcc_equipment_authorization' || f.id === 'fcc_part15_sdoc',
    );
    // Should have fcc_equipment_authorization (verified_applicable) covering both.
    // Must NOT have a conflicting fcc_part15_sdoc as insufficient_info alongside it.
    const ea = fccFindings.find((f) => f.id === 'fcc_equipment_authorization');
    expect(ea).toBeDefined();
    expect(ea?.verification_status).toBe('verified_applicable');

    const sdocConflict = fccFindings.find(
      (f) => f.id === 'fcc_part15_sdoc' && f.verification_status === 'insufficient_info',
    );
    expect(sdocConflict).toBeUndefined();
  });

  it('emits exactly ONE FCC docSpec (combined FCC ID + Part 15 test report)', () => {
    const result = evaluateAllModules(input);
    const fccDocs = result.docSpecs.filter(
      (d) =>
        d.document.toLowerCase().includes('fcc') ||
        d.document.toLowerCase().includes('sdoc') ||
        d.document.toLowerCase().includes('part 15'),
    );
    // Must not be duplicated: only one FCC-related docSpec
    expect(fccDocs.length).toBe(1);
  });

  it('passes structural assertions', () => {
    assertStructural(evaluateAllModules(input));
  });
});

// ── Batteries: ocean transport mode gates IATA air-only rules ─────────────────
describe('batteries module — ocean transport mode', () => {
  const baseInput: ModuleInput = {
    htsDigits: '8518210000',
    productText: 'portable bluetooth speaker lithium ion battery',
    attrs: { has_battery: true },
    originCountry: 'China',
    importDate: '2026-06-28',
    knownFacts: {
      battery_type: 'lithium_ion',
      battery_configuration: 'in_equipment',
      battery_wh: '2_to_20wh',
    },
    transportMode: 'ocean',
  };

  it('IATA state-of-charge finding is not_applicable for ocean transport', () => {
    const result = evaluateAllModules(baseInput);
    const iatFinding = result.findings.find((f) => f.id === 'phmsa_soc_air');
    // Should exist but be not_applicable, not a real requirement
    expect(iatFinding?.verification_status).toBe('not_applicable');
    expect(iatFinding?.level).toBe('N/A');
  });

  it('UN 3481 in-equipment finding is verified_applicable', () => {
    const result = evaluateAllModules(baseInput);
    const dotFinding = result.findings.find((f) => f.id === 'phmsa_dot_class');
    expect(dotFinding).toBeDefined();
    expect(dotFinding?.category).toMatch(/3481/);
    expect(dotFinding?.verification_status).toBe('verified_applicable');
  });

  it('UN 38.3 docSpec is usually_requested (not required_to_clear)', () => {
    const result = evaluateAllModules(baseInput);
    const un383Doc = result.docSpecs.find((d) => d.document.toLowerCase().includes('un 38.3'));
    expect(un383Doc).toBeDefined();
    expect(un383Doc?.doc_status).toBe('usually_requested');
  });

  it('no SDS marked required_to_clear (it is a transport doc, not CBP clearance)', () => {
    const result = evaluateAllModules(baseInput);
    const sdsDoc = result.docSpecs.find((d) => d.document.toLowerCase().includes('safety data'));
    if (sdsDoc) {
      expect(sdsDoc.doc_status).not.toBe('required_to_clear');
    }
  });

  it('passes structural assertions', () => {
    assertStructural(evaluateAllModules(baseInput));
  });
});

// ── Batteries: air transport shows IATA finding ───────────────────────────────
describe('batteries module — air transport mode', () => {
  const airInput: ModuleInput = {
    htsDigits: '8518210000',
    productText: 'portable bluetooth speaker lithium ion battery',
    attrs: { has_battery: true },
    originCountry: 'China',
    importDate: '2026-06-28',
    knownFacts: { battery_type: 'lithium_ion', battery_configuration: 'standalone_loose' },
    transportMode: 'air',
  };

  it('IATA state-of-charge finding is official_unconfirmed for air transport', () => {
    const result = evaluateAllModules(airInput);
    const iatFinding = result.findings.find((f) => f.id === 'phmsa_soc_air');
    expect(iatFinding?.verification_status).toBe('official_unconfirmed');
    expect(iatFinding?.level).not.toBe('N/A');
  });
});

// ── Bluetooth speaker — full acceptance test ───────────────────────────────────
describe('bluetooth_speaker_acceptance — no AD/CVD, correct FCC, ocean gated', () => {
  const input: ModuleInput = {
    htsDigits: '8518210000',
    productText: 'portable bluetooth speaker audio',
    attrs: { is_electronic: true, has_battery: true },
    originCountry: 'China',
    importDate: '2026-06-28',
    transportMode: 'ocean',
    knownFacts: {
      has_wireless_tx: 'yes',
      product_function: 'audio_speaker',
      battery_type: 'lithium_ion',
      battery_configuration: 'in_equipment',
      battery_wh: '2_to_20wh',
    },
  };

  it('electronics and batteries modules both activate', () => {
    const active = getActiveModules(input);
    const ids = active.map((m) => m.id);
    expect(ids).toContain('electronics');
    expect(ids).toContain('batteries');
  });

  it('no duplicate document entries across electronics + batteries', () => {
    const result = evaluateAllModules(input);
    const docNames = result.docSpecs.map((d) => d.document.toLowerCase());
    const dupes = docNames.filter((n, i) => docNames.indexOf(n) !== i);
    expect(dupes).toHaveLength(0);
  });

  it('IATA finding is not_applicable (ocean transport)', () => {
    const result = evaluateAllModules(input);
    const iata = result.findings.find((f) => f.id === 'phmsa_soc_air');
    expect(iata?.level).toBe('N/A');
  });

  it('FCC Equipment Authorization finding is verified_applicable (Bluetooth confirmed)', () => {
    const result = evaluateAllModules(input);
    const fcc = result.findings.find((f) => f.id === 'fcc_equipment_authorization');
    expect(fcc?.verification_status).toBe('verified_applicable');
    expect(fcc?.level).toBe('High');
  });

  it('UN 3481 in-equipment hazmat classification is present', () => {
    const result = evaluateAllModules(input);
    const dot = result.findings.find((f) => f.id === 'phmsa_dot_class');
    expect(dot?.category).toMatch(/3481/i);
  });

  it('passes structural assertions', () => {
    assertStructural(evaluateAllModules(input));
  });
});

// ── Section 122 surcharge ─────────────────────────────────────────────────────
// Use 9403 (furniture) for pure date-window tests — not civil-aircraft-eligible,
// not Section 232-covered, not pharma — so the only variable is the date.

describe('checkSection122Surcharge — date window', () => {
  const HTS_FURNITURE = '9403906000'; // household furniture, non-eligible for any exemption

  it('day before effective date returns before_effective_date', () => {
    const r = checkSection122Surcharge(HTS_FURNITURE, 'Vietnam', '2026-02-23');
    expect(r.applies).toBe(false);
    expect(r.reason).toBe('before_effective_date');
    expect(r.rate_pct).toBeNull();
  });

  it('on effective date (Feb 24, 2026) returns applicable', () => {
    const r = checkSection122Surcharge(HTS_FURNITURE, 'Vietnam', '2026-02-24');
    expect(r.applies).toBe(true);
    expect(r.reason).toBe('applicable');
    expect(r.rate_pct).toBe(10);
  });

  it('mid-window (June 28, 2026) returns applicable at 10%', () => {
    const r = checkSection122Surcharge(HTS_FURNITURE, 'Vietnam', '2026-06-28');
    expect(r.applies).toBe(true);
    expect(r.reason).toBe('applicable');
    expect(r.rate_pct).toBe(10);
  });

  it('on expiry date (July 23, 2026) is still applicable — day 150 is inclusive', () => {
    const r = checkSection122Surcharge(HTS_FURNITURE, 'Vietnam', '2026-07-23');
    expect(r.applies).toBe(true);
    expect(r.reason).toBe('applicable');
  });

  it('day after expiry (July 24, 2026) returns after_expiry', () => {
    const r = checkSection122Surcharge(HTS_FURNITURE, 'Vietnam', '2026-07-24');
    expect(r.applies).toBe(false);
    expect(r.reason).toBe('after_expiry');
    expect(r.rate_pct).toBeNull();
  });
});

describe('checkSection122Surcharge — ordinary vs aircraft loudspeaker (HTS 8518.21)', () => {
  // 8518 is civil-aircraft-eligible; the outcome depends on knownFacts.

  it('ordinary household Bluetooth speaker (civil_aircraft_use: no) → applicable', () => {
    const r = checkSection122Surcharge('8518210000', 'China', '2026-06-28', { civil_aircraft_use: 'no' });
    expect(r.applies).toBe(true);
    expect(r.reason).toBe('applicable');
    expect(r.rate_pct).toBe(10);
    // Must NOT mention a civil aircraft exemption
    expect(r.note).not.toContain('civil aircraft exempt');
  });

  it('aircraft-qualified loudspeaker (civil_aircraft_use: yes) → hts_exempt', () => {
    const r = checkSection122Surcharge('8518210000', 'China', '2026-06-28', { civil_aircraft_use: 'yes' });
    expect(r.applies).toBe(false);
    expect(r.reason).toBe('hts_exempt');
    expect(r.rate_pct).toBeNull();
    expect(r.note).toContain('civil aircraft');
  });

  it('unknown civil-aircraft status → cannot_determine with missing_condition', () => {
    const r = checkSection122Surcharge('8518210000', 'China', '2026-06-28');
    expect(r.applies).toBe('cannot_determine');
    expect(r.reason).toBe('cannot_determine');
    expect(r.missing_condition).toBeTruthy();
    expect(r.note).toContain('Cannot determine');
  });
});

describe('checkSection122Surcharge — Section 232 no-stacking', () => {
  it('Section 232 auto brake drum (HTS 870830) → already_s232_auto', () => {
    // Brake drums (8708.30.xx) are covered by Proclamation 10908; no stacking.
    const r = checkSection122Surcharge('8708305020', 'China', '2026-06-28');
    expect(r.applies).toBe(false);
    expect(r.reason).toBe('already_s232_auto');
    expect(r.rate_pct).toBeNull();
    expect(r.note).toContain('9903.94.05');
  });

  it('Section 232 steel (HTS 7208 hot-rolled coil) → already_s232_steel_aluminum', () => {
    const r = checkSection122Surcharge('7208399000', 'South Korea', '2026-06-28');
    expect(r.applies).toBe(false);
    expect(r.reason).toBe('already_s232_steel_aluminum');
    expect(r.rate_pct).toBeNull();
  });

  it('Section 232 aluminum (HTS 7606 sheet) → already_s232_steel_aluminum', () => {
    const r = checkSection122Surcharge('7606120000', 'China', '2026-06-28');
    expect(r.applies).toBe(false);
    expect(r.reason).toBe('already_s232_steel_aluminum');
  });
});

describe('checkSection122Surcharge — exact exempt vs non-exempt electronics', () => {
  // Exact exempt electronics: HTS 9018 medical instruments (unconditional)
  it('exact exempt electronics — medical instrument 9018 → hts_exempt (unconditional)', () => {
    const r = checkSection122Surcharge('9018909090', 'Germany', '2026-06-28');
    expect(r.applies).toBe(false);
    expect(r.reason).toBe('hts_exempt');
    expect(r.rate_pct).toBeNull();
    expect(r.note).toContain('unconditionally exempted');
  });

  // Non-exempt electronics: HTS 8504 (transformers/power supplies) — not civil-aircraft-eligible
  it('non-exempt electronics — power transformer 8504 → applicable', () => {
    const r = checkSection122Surcharge('8504409510', 'China', '2026-06-28');
    expect(r.applies).toBe(true);
    expect(r.reason).toBe('applicable');
    expect(r.rate_pct).toBe(10);
  });

  // Also confirm pharma exemption for completeness
  it('pharmaceutical HTS 3004 → hts_exempt (unconditional)', () => {
    const r = checkSection122Surcharge('3004905090', 'India', '2026-06-28');
    expect(r.applies).toBe(false);
    expect(r.reason).toBe('hts_exempt');
  });
});

describe('checkSection122Surcharge — USMCA and CAFTA-DR origin exemptions', () => {
  const HTS_FURNITURE = '9403906000';

  it('Canada origin → origin_usmca (exempt)', () => {
    const r = checkSection122Surcharge(HTS_FURNITURE, 'Canada', '2026-06-28');
    expect(r.applies).toBe(false);
    expect(r.reason).toBe('origin_usmca');
    expect(r.note).toContain('USMCA');
  });

  it('Mexico origin → origin_usmca (exempt)', () => {
    const r = checkSection122Surcharge(HTS_FURNITURE, 'Mexico', '2026-06-28');
    expect(r.applies).toBe(false);
    expect(r.reason).toBe('origin_usmca');
  });

  it('Honduras origin → origin_cafta_dr (exempt)', () => {
    const r = checkSection122Surcharge(HTS_FURNITURE, 'Honduras', '2026-06-28');
    expect(r.applies).toBe(false);
    expect(r.reason).toBe('origin_cafta_dr');
    expect(r.note).toContain('CAFTA-DR');
  });

  it('El Salvador origin → origin_cafta_dr (exempt)', () => {
    const r = checkSection122Surcharge(HTS_FURNITURE, 'El Salvador', '2026-06-28');
    expect(r.applies).toBe(false);
    expect(r.reason).toBe('origin_cafta_dr');
  });

  it('China origin (not USMCA/CAFTA) → applicable', () => {
    const r = checkSection122Surcharge(HTS_FURNITURE, 'China', '2026-06-28');
    expect(r.applies).toBe(true);
    expect(r.reason).toBe('applicable');
  });

  // USMCA check fires before HTS check — even an exempt pharma from Canada shows origin_usmca
  it('Canada + pharma HTS → origin_usmca (origin check fires first)', () => {
    const r = checkSection122Surcharge('3004905090', 'Canada', '2026-06-28');
    expect(r.applies).toBe(false);
    expect(r.reason).toBe('origin_usmca');
  });
});

describe('checkSection122Surcharge — stacking with Section 301', () => {
  it('Section 122 and Section 301 rates are independent and additive', () => {
    const r = checkSection122Surcharge('8518210000', 'China', '2026-06-28', { civil_aircraft_use: 'no' });
    const s301Rate = SECTION_301_RATES['9903.88.15']?.rate_pct;
    expect(r.rate_pct).toBe(10);
    expect(s301Rate).toBe(7.5);
    // On a $50,000 Bluetooth speaker: S301 $3,750 + S122 $5,000 = $8,750
    const combined = (50000 * (7.5 + 10)) / 100;
    expect(combined).toBe(8750);
  });
});

// ── MPF FY schedules ──────────────────────────────────────────────────────────
describe('computeMpf — FY2026 schedule', () => {
  it('MPF_FY2026 has correct min/max/surcharge', () => {
    expect(MPF_FY2026.min_usd).toBe(33.58);
    expect(MPF_FY2026.max_usd).toBe(651.50);
    expect(MPF_FY2026.manual_entry_surcharge_usd).toBe(4.03);
    expect(MPF_FY2026.rate_pct).toBe(0.3464);
  });

  it('MPF_FY2025 has correct min/max', () => {
    expect(MPF_FY2025.min_usd).toBe(31.67);
    expect(MPF_FY2025.max_usd).toBe(614.35);
    expect(MPF_FY2025.manual_entry_surcharge_usd).toBe(3.82);
  });

  it('$50,000 mid-range → $173.20 (unchanged at 0.3464%)', () => {
    const { amount, schedule } = computeMpf(50000, '2026-06-28');
    expect(amount).toBeCloseTo(173.20, 1);
    expect(schedule.fy_start).toBe('2025-10-01');
  });

  it('$1,000 hits FY2026 min floor of $33.58', () => {
    const { amount } = computeMpf(1000, '2026-06-28');
    expect(amount).toBe(33.58);
  });

  it('$500,000 hits FY2026 max ceiling of $651.50', () => {
    const { amount } = computeMpf(500000, '2026-06-28');
    expect(amount).toBe(651.50);
  });

  it('$1,000 on FY2025 date hits FY2025 min floor of $31.67', () => {
    const { amount, schedule } = computeMpf(1000, '2025-06-28');
    expect(amount).toBe(31.67);
    expect(schedule.fy_start).toBe('2024-10-01');
  });

  it('$500,000 on FY2025 date hits FY2025 max ceiling of $614.35', () => {
    const { amount } = computeMpf(500000, '2025-06-28');
    expect(amount).toBe(614.35);
  });
});

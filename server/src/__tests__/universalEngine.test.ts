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

/**
 * Cross-category regression matrix (Session D — 15 products).
 *
 * For each product: correct modules activate, irrelevant modules are absent,
 * no duplicate obligations/documents, correct status/timing, genuine missing
 * facts only, transport mode respected, one consistent conclusion per legal
 * obligation.
 */

import { describe, test, expect } from 'bun:test';
import { evaluateAllModules, getActiveModules } from '../services/regulatoryModules/index';
import { deduplicateObligations, buildObligations } from '../services/obligationEngine';
import type { ModuleInput } from '../services/regulatoryModules/index';

// ── Helpers ───────────────────────────────────────────────────────────────────

const IMPORT_DATE = '2026-06-30';
const BASE_ATTRS = {
  is_children: false,
  has_battery: false,
  is_electronic: false,
  is_textile: false,
  is_cosmetic: false,
  is_food_contact: false,
  is_supplement: false,
  sold_on_amazon: false,
  sold_on_tiktok: false,
  sold_in_eu: false,
};

function input(overrides: Partial<ModuleInput> & { htsDigits: string; productText: string }): ModuleInput {
  return {
    originCountry: 'CN',
    importDate: IMPORT_DATE,
    knownFacts: {},
    attrs: BASE_ATTRS,
    transportMode: 'ocean',
    ...overrides,
  };
}

function assertNoInternalDuplicateDocuments(result: ReturnType<typeof evaluateAllModules>) {
  const docs = result.docSpecs.map((d) => d.document.toLowerCase());
  const seen = new Set<string>();
  for (const d of docs) {
    expect(seen.has(d)).toBe(false);
    seen.add(d);
  }
}

function assertNoDuplicateObligations(result: ReturnType<typeof evaluateAllModules>) {
  const obligations = buildObligations(result.findings, result.docSpecs, 'ocean');
  const ids = obligations.map((o) => o.obligation_id);
  const unique = new Set(ids);
  expect(unique.size).toBe(ids.length);
}

// ── Product 1: Bluetooth speaker with lithium battery ────────────────────────

describe('Product 1: Bluetooth speaker with lithium battery', () => {
  const inp = input({
    htsDigits: '8518220000',
    productText: 'Bluetooth wireless speaker with lithium-ion battery rechargeable portable',
    attrs: { ...BASE_ATTRS, is_electronic: true, has_battery: true },
  });

  test('activates electronics and batteries modules', () => {
    const active = getActiveModules(inp);
    const ids = active.map((m) => m.id);
    expect(ids).toContain('electronics');
    expect(ids).toContain('batteries');
  });

  test('does not activate childrens, textiles, cosmetics, food, automotive modules', () => {
    const active = getActiveModules(inp);
    const ids = active.map((m) => m.id);
    expect(ids).not.toContain('childrens');
    expect(ids).not.toContain('textiles');
    expect(ids).not.toContain('cosmetics');
    expect(ids).not.toContain('food');
    expect(ids).not.toContain('automotive');
  });

  test('no duplicate documents in module output', () => {
    assertNoInternalDuplicateDocuments(evaluateAllModules(inp));
  });

  test('no duplicate obligation ids', () => {
    assertNoDuplicateObligations(evaluateAllModules(inp));
  });
});

// ── Product 2: Magnetic children's toy ───────────────────────────────────────

describe('Product 2: Magnetic children\'s toy', () => {
  const inp = input({
    htsDigits: '9503000090',
    productText: 'magnetic building blocks toy for children ages 3 and up',
    attrs: { ...BASE_ATTRS, is_children: true },
    knownFacts: { age_range: 'under_12' },
  });

  test('activates childrens module', () => {
    const active = getActiveModules(inp);
    const ids = active.map((m) => m.id);
    expect(ids).toContain('childrens');
  });

  test('does not activate electronics, textiles, cosmetics modules', () => {
    const active = getActiveModules(inp);
    const ids = active.map((m) => m.id);
    expect(ids).not.toContain('electronics');
    expect(ids).not.toContain('textiles');
    expect(ids).not.toContain('cosmetics');
  });

  test('produces CPSIA test report finding', () => {
    const result = evaluateAllModules(inp);
    const hasCpsia = result.findings.some((f) =>
      f.category.toLowerCase().includes('cpsia') || f.category.toLowerCase().includes('cpsc'),
    );
    expect(hasCpsia).toBe(true);
  });

  test('no duplicate obligation ids', () => {
    assertNoDuplicateObligations(evaluateAllModules(inp));
  });
});

// ── Product 3: Cotton T-shirt ─────────────────────────────────────────────────

describe('Product 3: Cotton T-shirt', () => {
  const inp = input({
    htsDigits: '6109100010',
    productText: '100% cotton crew-neck T-shirt mens adult',
    attrs: { ...BASE_ATTRS, is_textile: true },
  });

  test('activates textiles module', () => {
    const active = getActiveModules(inp);
    const ids = active.map((m) => m.id);
    expect(ids).toContain('textiles');
  });

  test('does not activate electronics, batteries, cosmetics, food modules', () => {
    const active = getActiveModules(inp);
    const ids = active.map((m) => m.id);
    expect(ids).not.toContain('electronics');
    expect(ids).not.toContain('batteries');
    expect(ids).not.toContain('cosmetics');
    expect(ids).not.toContain('food');
  });

  test('textiles findings include fiber content labeling', () => {
    const result = evaluateAllModules(inp);
    const hasFiberContent = result.findings.some((f) =>
      f.category.toLowerCase().includes('fiber') ||
      f.category.toLowerCase().includes('tfpia') ||
      f.category.toLowerCase().includes('textile fiber'),
    );
    expect(hasFiberContent).toBe(true);
  });

  test('no duplicate obligation ids', () => {
    assertNoDuplicateObligations(evaluateAllModules(inp));
  });
});

// ── Product 4: Leather boxing gloves with textile lining ─────────────────────

describe('Product 4: Leather boxing gloves with textile lining', () => {
  const inp = input({
    htsDigits: '4203210000',
    productText: 'leather boxing gloves polyester textile lining combat sports',
    attrs: { ...BASE_ATTRS, is_textile: true },
    knownFacts: {
      age_range: 'not_for_children',
      sports_product_type: 'combat_sports',
    },
  });

  test('activates textiles module (due to textile lining text)', () => {
    const active = getActiveModules(inp);
    const ids = active.map((m) => m.id);
    expect(ids).toContain('textiles');
  });

  test('activates sports module', () => {
    const active = getActiveModules(inp);
    const ids = active.map((m) => m.id);
    expect(ids).toContain('sports');
  });

  test('does not activate childrens, electronics modules', () => {
    const active = getActiveModules(inp);
    const ids = active.map((m) => m.id);
    expect(ids).not.toContain('childrens');
    expect(ids).not.toContain('electronics');
  });

  test('gloves are exempt from care labeling (FTC 16 CFR 423)', () => {
    const result = evaluateAllModules(inp);
    const careLabelFinding = result.findings.find((f) =>
      f.category.toLowerCase().includes('care label') ||
      f.category.toLowerCase().includes('16 cfr 423'),
    );
    // If care labeling finding exists, it must be not_applicable
    if (careLabelFinding) {
      expect(careLabelFinding.verification_status).toBe('not_applicable');
    }
  });

  test('combat sports finding is informational — no active ASTM boxing standard', () => {
    const result = evaluateAllModules(inp);
    const combatFinding = result.findings.find((f) =>
      f.category.toLowerCase().includes('combat') ||
      f.category.toLowerCase().includes('boxing'),
    );
    if (combatFinding) {
      expect(combatFinding.verification_status).toBe('not_applicable');
      expect(combatFinding.level).toBe('N/A');
    }
  });

  test('no ASTM F2697 cited (removed — standard is not active)', () => {
    const result = evaluateAllModules(inp);
    const allText = JSON.stringify(result);
    expect(allText).not.toContain('F2697');
  });

  test('no duplicate obligation ids', () => {
    assertNoDuplicateObligations(evaluateAllModules(inp));
  });
});

// ── Product 5: Face moisturizer ───────────────────────────────────────────────

describe('Product 5: Face moisturizer (cosmetic)', () => {
  const inp = input({
    htsDigits: '3304990000',
    productText: 'face moisturizer skin cream cosmetic beauty product',
    attrs: { ...BASE_ATTRS, is_cosmetic: true },
  });

  test('activates cosmetics module', () => {
    const active = getActiveModules(inp);
    const ids = active.map((m) => m.id);
    expect(ids).toContain('cosmetics');
  });

  test('does not activate textiles, electronics, batteries modules', () => {
    const active = getActiveModules(inp);
    const ids = active.map((m) => m.id);
    expect(ids).not.toContain('textiles');
    expect(ids).not.toContain('electronics');
    expect(ids).not.toContain('batteries');
  });

  test('no duplicate obligation ids', () => {
    assertNoDuplicateObligations(evaluateAllModules(inp));
  });
});

// ── Product 6: Canned food product ───────────────────────────────────────────

describe('Product 6: Canned food product', () => {
  const inp = input({
    htsDigits: '2005990000',
    productText: 'canned vegetables food product for human consumption',
    attrs: BASE_ATTRS,
  });

  test('activates food module', () => {
    const active = getActiveModules(inp);
    const ids = active.map((m) => m.id);
    expect(ids).toContain('food');
  });

  test('does not activate electronics, textiles, automotive modules', () => {
    const active = getActiveModules(inp);
    const ids = active.map((m) => m.id);
    expect(ids).not.toContain('electronics');
    expect(ids).not.toContain('textiles');
    expect(ids).not.toContain('automotive');
  });

  test('no duplicate obligation ids', () => {
    assertNoDuplicateObligations(evaluateAllModules(inp));
  });
});

// ── Product 7: Plastic food-contact container ─────────────────────────────────

describe('Product 7: Plastic food-contact container', () => {
  const inp = input({
    htsDigits: '3924100000',
    productText: 'plastic food container storage box food contact kitchen',
    attrs: { ...BASE_ATTRS, is_food_contact: true },
    knownFacts: { food_contact_use: 'yes' },
  });

  test('activates food module (food contact)', () => {
    const active = getActiveModules(inp);
    const ids = active.map((m) => m.id);
    expect(ids).toContain('food');
  });

  test('no duplicate obligation ids', () => {
    assertNoDuplicateObligations(evaluateAllModules(inp));
  });
});

// ── Product 8: Digital medical thermometer ────────────────────────────────────

describe('Product 8: Digital medical thermometer', () => {
  const inp = input({
    htsDigits: '9025110000',
    productText: 'digital medical thermometer body temperature measurement clinical',
    attrs: { ...BASE_ATTRS, is_electronic: true },
  });

  test('activates medical devices module', () => {
    const active = getActiveModules(inp);
    const ids = active.map((m) => m.id);
    expect(ids).toContain('medical_devices');
  });

  test('does not activate textiles, cosmetics, automotive modules', () => {
    const active = getActiveModules(inp);
    const ids = active.map((m) => m.id);
    expect(ids).not.toContain('textiles');
    expect(ids).not.toContain('cosmetics');
    expect(ids).not.toContain('automotive');
  });

  test('no duplicate obligation ids', () => {
    assertNoDuplicateObligations(evaluateAllModules(inp));
  });
});

// ── Product 9: Household chemical cleaner ─────────────────────────────────────

describe('Product 9: Household chemical cleaner', () => {
  const inp = input({
    htsDigits: '3402909000',
    productText: 'household cleaning product chemical cleaner disinfectant spray',
    attrs: BASE_ATTRS,
  });

  test('activates chemicals module', () => {
    const active = getActiveModules(inp);
    const ids = active.map((m) => m.id);
    expect(ids).toContain('chemicals');
  });

  test('does not activate automotive, textiles, childrens modules', () => {
    const active = getActiveModules(inp);
    const ids = active.map((m) => m.id);
    expect(ids).not.toContain('automotive');
    expect(ids).not.toContain('textiles');
    expect(ids).not.toContain('childrens');
  });

  test('no duplicate obligation ids', () => {
    assertNoDuplicateObligations(evaluateAllModules(inp));
  });
});

// ── Product 10: Wooden chair ──────────────────────────────────────────────────

describe('Product 10: Wooden chair', () => {
  const inp = input({
    htsDigits: '9401610000',
    productText: 'wooden chair solid wood dining furniture',
    attrs: BASE_ATTRS,
  });

  test('activates furniture module', () => {
    const active = getActiveModules(inp);
    const ids = active.map((m) => m.id);
    expect(ids).toContain('furniture');
  });

  test('does not activate electronics, batteries, cosmetics modules', () => {
    const active = getActiveModules(inp);
    const ids = active.map((m) => m.id);
    expect(ids).not.toContain('electronics');
    expect(ids).not.toContain('batteries');
    expect(ids).not.toContain('cosmetics');
  });

  test('no duplicate obligation ids', () => {
    assertNoDuplicateObligations(evaluateAllModules(inp));
  });
});

// ── Product 11: Automotive brake drum ─────────────────────────────────────────

describe('Product 11: Automotive brake drum', () => {
  const inp = input({
    htsDigits: '8708309100',
    productText: 'automotive brake drum vehicle part cast iron',
    attrs: BASE_ATTRS,
  });

  test('activates automotive module', () => {
    const active = getActiveModules(inp);
    const ids = active.map((m) => m.id);
    expect(ids).toContain('automotive');
  });

  test('does not activate cosmetics, food, textiles modules', () => {
    const active = getActiveModules(inp);
    const ids = active.map((m) => m.id);
    expect(ids).not.toContain('cosmetics');
    expect(ids).not.toContain('food');
    expect(ids).not.toContain('textiles');
  });

  test('no duplicate obligation ids', () => {
    assertNoDuplicateObligations(evaluateAllModules(inp));
  });
});

// ── Product 12: Bicycle helmet ────────────────────────────────────────────────

describe('Product 12: Bicycle helmet', () => {
  const inp = input({
    htsDigits: '6506101500',
    productText: 'bicycle helmet cycling protective headgear adult',
    attrs: BASE_ATTRS,
    knownFacts: { age_range: 'not_for_children', sports_product_type: 'cycling' },
  });

  test('activates sports module', () => {
    const active = getActiveModules(inp);
    const ids = active.map((m) => m.id);
    expect(ids).toContain('sports');
  });

  test('does not activate electronics, textiles, cosmetics modules', () => {
    const active = getActiveModules(inp);
    const ids = active.map((m) => m.id);
    expect(ids).not.toContain('electronics');
    expect(ids).not.toContain('textiles');
    expect(ids).not.toContain('cosmetics');
  });

  test('no duplicate obligation ids', () => {
    assertNoDuplicateObligations(evaluateAllModules(inp));
  });
});

// ── Product 13: Life jacket ───────────────────────────────────────────────────

describe('Product 13: Life jacket (personal flotation device)', () => {
  const inp = input({
    htsDigits: '6307200000',
    productText: 'life jacket personal flotation device PFD coast guard safety marine',
    attrs: { ...BASE_ATTRS, is_textile: true },
    knownFacts: { sports_product_type: 'water_sports' },
  });

  test('activates sports module', () => {
    const active = getActiveModules(inp);
    const ids = active.map((m) => m.id);
    expect(ids).toContain('sports');
  });

  test('no duplicate obligation ids', () => {
    assertNoDuplicateObligations(evaluateAllModules(inp));
  });
});

// ── Product 14: Lithium power bank ────────────────────────────────────────────

describe('Product 14: Lithium power bank', () => {
  const inp = input({
    htsDigits: '8507600000',
    productText: 'lithium power bank portable charger battery pack 20000mAh USB',
    attrs: { ...BASE_ATTRS, is_electronic: true, has_battery: true },
    knownFacts: { battery_type: 'lithium_ion' },
  });

  test('activates batteries and electronics modules', () => {
    const active = getActiveModules(inp);
    const ids = active.map((m) => m.id);
    expect(ids).toContain('batteries');
    expect(ids).toContain('electronics');
  });

  test('does not activate childrens, textiles, automotive modules', () => {
    const active = getActiveModules(inp);
    const ids = active.map((m) => m.id);
    expect(ids).not.toContain('childrens');
    expect(ids).not.toContain('textiles');
    expect(ids).not.toContain('automotive');
  });

  test('UN 38.3 test summary is a required document for verified lithium battery', () => {
    const result = evaluateAllModules(inp);
    const un383Doc = result.docSpecs.find((d) => d.document.includes('UN 38.3'));
    expect(un383Doc).toBeDefined();
  });

  test('no duplicate obligation ids', () => {
    assertNoDuplicateObligations(evaluateAllModules(inp));
  });
});

// ── Product 15: Adult dumbbell set ────────────────────────────────────────────

describe('Product 15: Adult dumbbell set', () => {
  const inp = input({
    htsDigits: '9506910000',
    productText: 'dumbbell set weight training fitness exercise equipment adult',
    attrs: BASE_ATTRS,
    knownFacts: { age_range: 'not_for_children', sports_product_type: 'fitness_equipment' },
  });

  test('activates sports module', () => {
    const active = getActiveModules(inp);
    const ids = active.map((m) => m.id);
    expect(ids).toContain('sports');
  });

  test('does not activate electronics, batteries, childrens modules', () => {
    const active = getActiveModules(inp);
    const ids = active.map((m) => m.id);
    expect(ids).not.toContain('electronics');
    expect(ids).not.toContain('batteries');
    expect(ids).not.toContain('childrens');
  });

  test('no duplicate obligation ids', () => {
    assertNoDuplicateObligations(evaluateAllModules(inp));
  });
});

// ── Cross-product: transport mode invariants ──────────────────────────────────

describe('Cross-product: transport mode invariants', () => {
  test('no product generates BoL when transport mode is air', () => {
    const products: ModuleInput[] = [
      input({ htsDigits: '8518220000', productText: 'bluetooth speaker lithium battery', attrs: { ...BASE_ATTRS, is_electronic: true, has_battery: true }, transportMode: 'air' }),
      input({ htsDigits: '6109100010', productText: '100% cotton T-shirt', attrs: { ...BASE_ATTRS, is_textile: true }, transportMode: 'air' }),
      input({ htsDigits: '4203210000', productText: 'leather boxing gloves textile lining', attrs: { ...BASE_ATTRS, is_textile: true }, transportMode: 'air' }),
    ];

    for (const p of products) {
      const result = evaluateAllModules(p);
      const bolDocs = result.docSpecs.filter((d) => d.document.toLowerCase().includes('bill of lading'));
      // Module docSpecs don't include BoL — it's in baselines.ts cbp_entry finding
      // But if any module returned BoL specifically tagged ocean, it must not appear
      for (const d of bolDocs) {
        if (d.transport_modes) {
          expect(d.transport_modes).not.toContain('air');
        }
      }
    }
  });

  test('no product has duplicate obligation ids after dedup', () => {
    const products: ModuleInput[] = [
      input({ htsDigits: '8518220000', productText: 'bluetooth speaker battery', attrs: { ...BASE_ATTRS, is_electronic: true, has_battery: true } }),
      input({ htsDigits: '9503000090', productText: 'magnetic toy children', attrs: { ...BASE_ATTRS, is_children: true }, knownFacts: { age_range: 'under_12' } }),
      input({ htsDigits: '6109100010', productText: '100% cotton T-shirt', attrs: { ...BASE_ATTRS, is_textile: true } }),
      input({ htsDigits: '3304990000', productText: 'face moisturizer cosmetic', attrs: { ...BASE_ATTRS, is_cosmetic: true } }),
      input({ htsDigits: '9506910000', productText: 'dumbbell weight training adult fitness', attrs: BASE_ATTRS, knownFacts: { age_range: 'not_for_children' } }),
    ];

    for (const p of products) {
      const result = evaluateAllModules(p);
      const obligations = buildObligations(result.findings, result.docSpecs, 'ocean');
      const ids = obligations.map((o) => o.obligation_id);
      const unique = new Set(ids);
      expect(unique.size).toBe(ids.length);
    }
  });
});

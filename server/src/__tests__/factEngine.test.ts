/**
 * Universal fact engine regression matrix — 10 representative products.
 *
 * Each scenario asserts:
 *   - Correct modules activate
 *   - Incorrect modules are absent
 *   - Explicit negatives are respected (no module fires when user says "No X")
 *   - Relevant clarification questions are produced
 *   - Irrelevant module questions are absent
 *   - Final report contains no findings from deactivated modules
 *
 * Tests use extractFacts + activateFromFacts directly, plus evaluateAllModules
 * for end-to-end report verification.
 */

import { describe, it, expect } from 'bun:test';
import {
  extractFacts,
  activateFromFacts,
  detectContradictions,
  MODULE_MANIFESTS,
  type FactSet,
} from '../services/factEngine';
import { evaluateAllModules } from '../services/regulatoryModules/index';
import type { ModuleInput } from '../services/regulatoryModules/index';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeInput(
  htsDigits: string,
  productText: string,
  knownFacts: Record<string, string> = {},
  originCountry = 'China',
): ModuleInput {
  return {
    htsDigits,
    productText,
    attrs: {},
    originCountry,
    importDate: '2026-06-26',
    knownFacts,
  };
}

function activeModules(hts: string, text: string, answers: Record<string, string> = {}): string[] {
  const facts = extractFacts(hts, text, answers);
  return activateFromFacts(facts, MODULE_MANIFESTS);
}

function findingIds(result: ReturnType<typeof evaluateAllModules>): string[] {
  return result.findings.map((f) => f.id);
}

function questionKeys(result: ReturnType<typeof evaluateAllModules>): string[] {
  return result.questions.map((q) => q.key);
}

// ── 1. Bluetooth speaker with lithium battery ─────────────────────────────────
describe('scenario_1: Bluetooth speaker with lithium battery', () => {
  const hts  = '8518220000';
  const text = 'Bluetooth wireless speaker portable rechargeable lithium battery';

  it('facts: contains_electronics=yes, contains_battery=yes, contains_wireless_transmitter=yes', () => {
    const f = extractFacts(hts, text);
    expect(f.contains_electronics.value).toBe('yes');
    expect(f.contains_battery.value).toBe('yes');
    expect(f.contains_wireless_transmitter.value).toBe('yes');
  });

  it('activates electronics and batteries modules', () => {
    const mods = activeModules(hts, text);
    expect(mods).toContain('electronics');
    expect(mods).toContain('batteries');
  });

  it('does NOT activate children, food, cosmetics, textiles, medical_devices', () => {
    const mods = activeModules(hts, text);
    expect(mods).not.toContain('childrens');
    expect(mods).not.toContain('food');
    expect(mods).not.toContain('cosmetics');
    expect(mods).not.toContain('textiles');
    expect(mods).not.toContain('medical_devices');
  });

  it('report contains no findings from absent modules', () => {
    const result = evaluateAllModules(makeInput(hts, text));
    const ids = findingIds(result);
    // None of these ID prefixes should appear
    const forbiddenPrefixes = ['cpsia_', 'fda_food_', 'fda_cosmetic_', 'fsis_'];
    for (const prefix of forbiddenPrefixes) {
      expect(ids.some((id) => id.startsWith(prefix))).toBe(false);
    }
  });

  it('electronics questions are present, children/food questions are absent', () => {
    const result = evaluateAllModules(makeInput(hts, text));
    const keys = questionKeys(result);
    expect(keys).toContain('has_wireless_tx');
    expect(keys).not.toContain('age_range');
    expect(keys).not.toContain('is_meat_or_poultry');
  });
});

// ── 2. Magnetic children's toy — no battery ───────────────────────────────────
describe('scenario_2: Magnetic children\'s toy, no battery', () => {
  const hts  = '9503000073';
  const text = 'Magnetic building tiles set toy for children ages 3 and up';

  it('HTS 9503 → intended_for_children=yes; text "magnetic" → contains_magnets=yes', () => {
    const f = extractFacts(hts, text);
    expect(f.intended_for_children.value).toBe('yes');
    expect(f.contains_magnets.value).toBe('yes');
  });

  it('text alone does NOT infer contains_battery', () => {
    const f = extractFacts(hts, text);
    // "magnetic" must not trigger a battery inference
    expect(f.contains_battery.value).toBe('unknown');
    expect(f.contains_battery.source).toBe('default');
  });

  it('structured "no battery" answer sets contains_battery=no', () => {
    const f = extractFacts(hts, text, { battery_type: 'no_battery' });
    expect(f.contains_battery.value).toBe('no');
    expect(f.contains_battery.source).toBe('structured_answer');
  });

  it('activates childrens only (no battery answer given)', () => {
    const mods = activeModules(hts, text, { battery_type: 'no_battery' });
    expect(mods).toContain('childrens');
    expect(mods).not.toContain('batteries');
    expect(mods).not.toContain('electronics');
    expect(mods).not.toContain('food');
  });

  it('without explicit answer: childrens activates, batteries does NOT (no battery signal)', () => {
    const mods = activeModules(hts, text);
    expect(mods).toContain('childrens');
    expect(mods).not.toContain('batteries');
  });

  it('report has no battery or electronics findings when battery_type=no_battery', () => {
    const result = evaluateAllModules(makeInput(hts, text, { battery_type: 'no_battery' }));
    const ids = findingIds(result);
    expect(ids.some((id) => id.startsWith('battery_') || id.startsWith('un_38_3') || id.startsWith('phmsa_'))).toBe(false);
  });
});

// ── 3. Cotton T-shirt ─────────────────────────────────────────────────────────
describe('scenario_3: Cotton T-shirt', () => {
  const hts  = '6109100010';
  const text = 'Cotton crew neck T-shirt short sleeve knit woven';

  it('HTS chapter 61 → contains_textile=yes', () => {
    const f = extractFacts(hts, text);
    expect(f.contains_textile.value).toBe('yes');
  });

  it('activates textiles only', () => {
    const mods = activeModules(hts, text);
    expect(mods).toContain('textiles');
    expect(mods).not.toContain('batteries');
    expect(mods).not.toContain('electronics');
    expect(mods).not.toContain('childrens');
    expect(mods).not.toContain('food');
    expect(mods).not.toContain('cosmetics');
    expect(mods).not.toContain('chemicals');
    expect(mods).not.toContain('medical_devices');
    expect(mods).not.toContain('furniture');
  });

  it('report has no food, battery, or medical findings', () => {
    const result = evaluateAllModules(makeInput(hts, text));
    const ids = findingIds(result);
    const forbiddenPrefixes = ['fda_food_', 'phmsa_', 'fda_device_'];
    for (const prefix of forbiddenPrefixes) {
      expect(ids.some((id) => id.startsWith(prefix))).toBe(false);
    }
  });
});

// ── 4. Face moisturizer ───────────────────────────────────────────────────────
describe('scenario_4: Face moisturizer', () => {
  const hts  = '3304990000';
  const text = 'Hydrating face moisturizer daily facial cream skincare SPF 15';

  it('HTS 3304 + text "moisturizer" → contains_cosmetic=yes', () => {
    const f = extractFacts(hts, text);
    expect(f.contains_cosmetic.value).toBe('yes');
  });

  it('activates cosmetics only (no drug-specific claims)', () => {
    const mods = activeModules(hts, text);
    expect(mods).toContain('cosmetics');
    expect(mods).not.toContain('medical_devices');
    expect(mods).not.toContain('food');
    expect(mods).not.toContain('batteries');
  });

  it('structured "not_cosmetic" answer deactivates cosmetics module', () => {
    const mods = activeModules(hts, text, { contains_otc_ingredient: 'not_cosmetic' });
    expect(mods).not.toContain('cosmetics');
  });

  it('text "medical-grade" alone does NOT activate medical_devices', () => {
    const f = extractFacts(hts, 'medical-grade moisturizer cream');
    expect(f.medical_intended_use.value).not.toBe('yes');
    const mods = activateFromFacts(f, MODULE_MANIFESTS);
    expect(mods).not.toContain('medical_devices');
  });
});

// ── 5. Canned tuna ────────────────────────────────────────────────────────────
describe('scenario_5: Canned tuna', () => {
  const hts  = '1604140100';
  const text = 'Canned tuna in water ready-to-eat seafood product packed in steel can';

  it('HTS chapter 16 → contains_food=yes', () => {
    const f = extractFacts(hts, text);
    expect(f.contains_food.value).toBe('yes');
  });

  it('activates food only', () => {
    const mods = activeModules(hts, text);
    expect(mods).toContain('food');
    expect(mods).not.toContain('cosmetics');
    expect(mods).not.toContain('batteries');
    expect(mods).not.toContain('medical_devices');
    expect(mods).not.toContain('textiles');
    expect(mods).not.toContain('electronics');
  });

  it('report has no electronics, cosmetics, or children findings', () => {
    const result = evaluateAllModules(makeInput(hts, text));
    const ids = findingIds(result);
    const forbidden = ['fcc_', 'fda_cosmetic_', 'cpsia_'];
    for (const prefix of forbidden) {
      expect(ids.some((id) => id.startsWith(prefix))).toBe(false);
    }
  });
});

// ── 6. Lithium power bank ─────────────────────────────────────────────────────
describe('scenario_6: Lithium power bank', () => {
  const hts  = '8507600000';
  const text = 'Lithium-ion power bank 20000mAh portable USB charger rechargeable battery pack';

  it('HTS 8507 + text → contains_battery=yes, contains_electronics=yes', () => {
    const f = extractFacts(hts, text);
    expect(f.contains_battery.value).toBe('yes');
    expect(f.contains_electronics.value).toBe('yes');
  });

  it('activates electronics and batteries', () => {
    const mods = activeModules(hts, text);
    expect(mods).toContain('batteries');
    expect(mods).toContain('electronics');
  });

  it('does NOT activate food, textiles, children, cosmetics, medical', () => {
    const mods = activeModules(hts, text);
    const unexpected = ['food', 'textiles', 'childrens', 'cosmetics', 'medical_devices'];
    for (const m of unexpected) expect(mods).not.toContain(m);
  });
});

// ── 7. Wooden chair ───────────────────────────────────────────────────────────
describe('scenario_7: Wooden chair', () => {
  const hts  = '9401610000';
  const text = 'Wooden dining chair solid oak seat with upholstered cushion';

  it('HTS 9401 → contains_wood=yes', () => {
    const f = extractFacts(hts, text);
    expect(f.contains_wood.value).toBe('yes');
  });

  it('activates furniture only', () => {
    const mods = activeModules(hts, text);
    expect(mods).toContain('furniture');
    expect(mods).not.toContain('food');
    expect(mods).not.toContain('batteries');
    expect(mods).not.toContain('childrens');
    expect(mods).not.toContain('cosmetics');
    expect(mods).not.toContain('medical_devices');
  });

  it('"no wood" structured answer deactivates furniture', () => {
    const mods = activeModules(hts, text, { contains_composite_wood: 'no' });
    // HTS still fires, but explicit answer overrides
    // The HTS rule sets wood at hts_indication; structured answer overrides at level 1
    const f = extractFacts(hts, text, { contains_composite_wood: 'no' });
    expect(f.contains_wood.value).toBe('no');
    expect(mods).not.toContain('furniture');
  });

  it('does NOT activate children unless stated (plain "wooden chair" is adult furniture)', () => {
    const mods = activeModules(hts, text);
    expect(mods).not.toContain('childrens');
  });
});

// ── 8. Household cleaning liquid ──────────────────────────────────────────────
describe('scenario_8: Household cleaning liquid', () => {
  const hts  = '3402200000';
  const text = 'Multi-surface household cleaning liquid disinfectant spray bleach based';

  it('HTS 3402 + text → contains_chemical=yes', () => {
    const f = extractFacts(hts, text);
    expect(f.contains_chemical.value).toBe('yes');
  });

  it('activates chemicals only', () => {
    const mods = activeModules(hts, text);
    expect(mods).toContain('chemicals');
    expect(mods).not.toContain('cosmetics');
    expect(mods).not.toContain('food');
    expect(mods).not.toContain('batteries');
    expect(mods).not.toContain('textiles');
    expect(mods).not.toContain('medical_devices');
  });

  it('structured "not_chemical_product" deactivates chemicals', () => {
    const mods = activeModules(hts, text, { is_pesticide_or_disinfectant: 'not_chemical_product' });
    // HTS still fires at level 4; structured_answer overrides at level 1
    const f = extractFacts(hts, text, { is_pesticide_or_disinfectant: 'not_chemical_product' });
    expect(f.contains_chemical.value).toBe('no');
    expect(mods).not.toContain('chemicals');
  });

  it('does NOT activate food (cleaning liquid is not food)', () => {
    const f = extractFacts(hts, text);
    expect(f.contains_food.value).not.toBe('yes');
  });
});

// ── 9. Digital medical thermometer ───────────────────────────────────────────
describe('scenario_9: Digital medical thermometer', () => {
  const hts  = '9025190000';
  const text = 'Digital medical thermometer clinical oral temperature measurement device FDA';

  it('text "medical thermometer" → medical_intended_use=yes', () => {
    const f = extractFacts(hts, text);
    expect(f.medical_intended_use.value).toBe('yes');
  });

  it('"digital" → contains_electronics=yes', () => {
    const f = extractFacts(hts, text);
    expect(f.contains_electronics.value).toBe('yes');
  });

  it('activates electronics + medical_devices', () => {
    const mods = activeModules(hts, text);
    expect(mods).toContain('electronics');
    expect(mods).toContain('medical_devices');
  });

  it('batteries module NOT active unless battery is confirmed', () => {
    const mods = activeModules(hts, text);
    // No battery keywords in text → batteries should NOT activate
    expect(mods).not.toContain('batteries');
  });

  it('batteries activates when battery is confirmed', () => {
    const mods = activeModules(hts, text, { battery_type: 'other_chemistry' });
    expect(mods).toContain('batteries');
  });

  it('does NOT activate food, cosmetics, textiles', () => {
    const mods = activeModules(hts, text);
    const unexpected = ['food', 'cosmetics', 'textiles', 'automotive'];
    for (const m of unexpected) expect(mods).not.toContain(m);
  });

  it('"not_medical_device" answer deactivates medical_devices module', () => {
    const mods = activeModules(hts, text, { fda_device_class: 'not_medical_device' });
    expect(mods).not.toContain('medical_devices');
  });
});

// ── 10. Plastic food-storage container ───────────────────────────────────────
describe('scenario_10: Plastic food-storage container', () => {
  const hts  = '3923100000';
  const text = 'BPA-free plastic food storage container food-safe lid for leftovers meal prep';

  it('text → food_contact=yes', () => {
    const f = extractFacts(hts, text);
    expect(f.food_contact.value).toBe('yes');
  });

  it('text does NOT set contains_food=yes (container is not a food product)', () => {
    const f = extractFacts(hts, text);
    // "food storage container" should trigger food_contact, not contains_food
    // No food inference keywords present that would imply the product itself is food
    expect(f.contains_food.value).not.toBe('yes');
  });

  it('activates food module (food_contact is a required fact for food)', () => {
    const mods = activeModules(hts, text);
    expect(mods).toContain('food');
  });

  it('does NOT activate cosmetics, batteries, textiles, medical_devices', () => {
    const mods = activeModules(hts, text);
    const unexpected = ['cosmetics', 'batteries', 'textiles', 'medical_devices', 'automotive'];
    for (const m of unexpected) expect(mods).not.toContain(m);
  });

  it('structured "no food contact" deactivates food module', () => {
    const f = extractFacts(hts, text, { food_contact_use: 'no' });
    expect(f.food_contact.value).toBe('no');
    // food module requires contains_food OR food_contact — both must be non-yes to deactivate
    // contains_food is still unknown/default here so module stays active via inference signal
    // Only fully deactivates when both facts are no
    const f2 = extractFacts(hts, text, { food_contact_use: 'not_applicable' });
    expect(f2.contains_food.value).toBe('no');
    expect(f2.food_contact.value).toBe('no');
    const mods = activateFromFacts(f2, MODULE_MANIFESTS);
    expect(mods).not.toContain('food');
  });
});

// ── Evidence precedence cross-cutting tests ───────────────────────────────────
describe('evidence_precedence: explicit negatives override inferences', () => {
  it('"no battery" description overrides "cordless" battery inference', () => {
    const f = extractFacts('', 'cordless drill no battery sold without battery pack');
    expect(f.contains_battery.value).toBe('no');
    expect(f.contains_battery.source).toBe('explicit_negative');
  });

  it('"no electronics" overrides "bluetooth speaker" inference', () => {
    const f = extractFacts('', 'Bluetooth speaker housing enclosure only — no electronics included');
    expect(f.contains_electronics.value).toBe('no');
  });

  it('structured answer overrides explicit negative in text', () => {
    const f = extractFacts('', 'battery-free device no battery', { battery_type: 'lithium_ion' });
    expect(f.contains_battery.value).toBe('yes');
    expect(f.contains_battery.source).toBe('structured_answer');
  });

  it('contradiction: text says "no battery", answer says "lithium_ion"', () => {
    const contradictions = detectContradictions('', 'battery-free device', { battery_type: 'lithium_ion' });
    const batteryConflict = contradictions.find((c) => c.factKey === 'contains_battery');
    expect(batteryConflict).toBeDefined();
    expect(batteryConflict?.answer_value).toBe('yes');
    expect(batteryConflict?.inferred_value).toBe('no');
  });

  it('no contradiction when text and answer agree', () => {
    const contradictions = detectContradictions('', 'Bluetooth speaker lithium battery', { battery_type: 'lithium_ion' });
    const batteryConflict = contradictions.find((c) => c.factKey === 'contains_battery');
    expect(batteryConflict).toBeUndefined();
  });

  it('"food-safe plastic container" → food_contact yes, contains_food unknown/default', () => {
    const f = extractFacts('', 'food-safe plastic container BPA-free');
    expect(f.food_contact.value).toBe('yes');
    expect(f.contains_food.value).toBe('unknown');
  });

  it('"magnetic toy" → intended_for_children yes, contains_battery default', () => {
    const f = extractFacts('9503000073', 'magnetic building tiles toy for children');
    expect(f.intended_for_children.value).toBe('yes');
    expect(f.contains_battery.source).toBe('default');
  });
});

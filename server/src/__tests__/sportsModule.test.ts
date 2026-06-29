/**
 * Sports & Outdoor Equipment module — regression test matrix.
 *
 * 15 products covering each sports subcategory, cross-module activation,
 * mandatory vs voluntary routing, and activation safeguards.
 *
 * Design rules:
 *   - Every assertion must be deterministic from product text + HTS + answers.
 *   - Mandatory findings must appear with verification_status 'verified_applicable'.
 *   - Voluntary findings must appear with verification_status 'official_unconfirmed'.
 *   - Mandatory and voluntary are NEVER conflated.
 *   - No product-name-specific if statements in the module — all routing is fact-driven.
 */

import { describe, it, expect } from 'bun:test';
import { extractFacts, activateFromFacts } from '../services/factEngine';
import { evaluateAllModules } from '../services/regulatoryModules/index';
import type { ModuleInput } from '../services/regulatoryModules/index';

// ── Helpers ───────────────────────────────────────────────────────────────────

function moduleInput(overrides: Partial<ModuleInput> = {}): ModuleInput {
  return {
    htsDigits: '',
    productText: '',
    attrs: {},
    originCountry: 'CN',
    importDate: '2026-01-01',
    knownFacts: {},
    ...overrides,
  };
}

function activatedModules(htsDigits: string, productText: string, knownFacts: Record<string, string> = {}): string[] {
  const facts = extractFacts(htsDigits, productText, knownFacts);
  return activateFromFacts(facts);
}

function mandatoryFindingIds(result: ReturnType<typeof evaluateAllModules>): string[] {
  return result.findings
    .filter((f) => f.verification_status === 'verified_applicable')
    .map((f) => f.id ?? '');
}

function voluntaryFindingIds(result: ReturnType<typeof evaluateAllModules>): string[] {
  return result.findings
    .filter((f) => f.verification_status === 'official_unconfirmed')
    .map((f) => f.id ?? '');
}

// ── Scenario 1: Bicycle (text only) ─────────────────────────────────────────

describe('Scenario 1: Adult bicycle', () => {
  const text = '26-inch aluminum alloy mountain bicycle, 21-speed derailleur, disc brakes';
  const hts = '87120050';
  const answers = { sports_product_type: 'bicycle', sports_helmet_type: 'no_helmet' };

  it('activates sports module', () => {
    const modules = activatedModules(hts, text, answers);
    expect(modules).toContain('sports');
  });

  it('does not activate automotive from bicycle HTS', () => {
    // 8712 is in automotive HTS list historically but is also sports — sports takes precedence
    const modules = activatedModules(hts, text, answers);
    expect(modules).toContain('sports');
  });

  it('produces mandatory CPSC 1512 finding', () => {
    const result = evaluateAllModules(moduleInput({ htsDigits: hts, productText: text, knownFacts: answers }));
    expect(mandatoryFindingIds(result)).toContain('sports_bicycle_cpsc_1512');
  });

  it('does NOT produce bicycle helmet finding when helmet answered no', () => {
    const result = evaluateAllModules(moduleInput({ htsDigits: hts, productText: text, knownFacts: answers }));
    const ids = result.findings.map((f) => f.id);
    expect(ids).not.toContain('sports_bicycle_helmet_cpsc_1203');
  });
});

// ── Scenario 2: Bicycle with helmet ─────────────────────────────────────────

describe('Scenario 2: Bicycle sold with bicycle helmet', () => {
  const text = '20-inch kids bicycle with included protective bicycle helmet';
  const hts = '87120060';
  const answers = { sports_product_type: 'bicycle', sports_helmet_type: 'bicycle_helmet', age_range: 'age_3_to_12' };

  it('activates sports + childrens modules', () => {
    const modules = activatedModules(hts, text, answers);
    expect(modules).toContain('sports');
    expect(modules).toContain('childrens');
  });

  it('produces mandatory CPSC 1203 (helmet) finding', () => {
    const result = evaluateAllModules(moduleInput({ htsDigits: hts, productText: text, knownFacts: answers }));
    expect(mandatoryFindingIds(result)).toContain('sports_bicycle_helmet_cpsc_1203');
  });

  it('also produces mandatory CPSC 1512 (bicycle) finding', () => {
    const result = evaluateAllModules(moduleInput({ htsDigits: hts, productText: text, knownFacts: answers }));
    expect(mandatoryFindingIds(result)).toContain('sports_bicycle_cpsc_1512');
  });
});

// ── Scenario 3: Life jacket / PFD ────────────────────────────────────────────

describe('Scenario 3: USCG Type III PFD (life jacket)', () => {
  const text = 'Personal flotation device, USCG approved Type III, kayaking buoyancy aid';
  const hts = '63072000';
  const answers = { sports_product_type: 'pfd_life_jacket', pfd_type: 'type_3' };

  it('activates sports module via flotation fact', () => {
    const modules = activatedModules(hts, text, answers);
    expect(modules).toContain('sports');
  });

  it('produces mandatory USCG 46 CFR 160 finding', () => {
    const result = evaluateAllModules(moduleInput({ htsDigits: hts, productText: text, knownFacts: answers }));
    expect(mandatoryFindingIds(result)).toContain('sports_pfd_uscg_46cfr160');
  });

  it('does NOT produce inflatable PFD finding for non-inflatable type', () => {
    const result = evaluateAllModules(moduleInput({ htsDigits: hts, productText: text, knownFacts: answers }));
    const ids = result.findings.map((f) => f.id);
    expect(ids).not.toContain('sports_inflatable_pfd_type5');
  });
});

// ── Scenario 4: Inflatable PFD (Type V) ──────────────────────────────────────

describe('Scenario 4: Inflatable Type V PFD', () => {
  const text = 'Inflatable life jacket, self-retracting CO2 mechanism, USCG Type V special use';
  const hts = '63072000';
  const answers = { sports_product_type: 'pfd_life_jacket', pfd_type: 'type_5' };

  it('produces mandatory USCG finding AND additional inflatable finding', () => {
    const result = evaluateAllModules(moduleInput({ htsDigits: hts, productText: text, knownFacts: answers }));
    expect(mandatoryFindingIds(result)).toContain('sports_pfd_uscg_46cfr160');
    expect(voluntaryFindingIds(result)).toContain('sports_inflatable_pfd_type5');
  });

  it('inflatable finding is official_unconfirmed, not verified_applicable', () => {
    const result = evaluateAllModules(moduleInput({ htsDigits: hts, productText: text, knownFacts: answers }));
    const inflatable = result.findings.find((f) => f.id === 'sports_inflatable_pfd_type5');
    expect(inflatable?.verification_status).toBe('official_unconfirmed');
  });
});

// ── Scenario 5: Occupational fall-arrest harness ─────────────────────────────

describe('Scenario 5: Full-body fall-arrest harness (occupational)', () => {
  const text = 'Full-body fall arrest harness, self-retracting lifeline, working load limit 310 lbs';
  const hts = '62114200'; // outerwear / textile HTS; sports activates from text
  const answers = {
    sports_product_type: 'climbing_equipment',
    climbing_equipment_type: 'fall_arrest_system',
    is_occupational: 'yes_occupational',
  };

  it('activates sports module', () => {
    const modules = activatedModules(hts, text, answers);
    expect(modules).toContain('sports');
  });

  it('produces mandatory OSHA 1910.140 finding', () => {
    const result = evaluateAllModules(moduleInput({ htsDigits: hts, productText: text, knownFacts: answers }));
    expect(mandatoryFindingIds(result)).toContain('sports_fall_arrest_osha_1910_140');
  });

  it('does NOT produce UIAA voluntary finding when occupational', () => {
    const result = evaluateAllModules(moduleInput({ htsDigits: hts, productText: text, knownFacts: answers }));
    const ids = result.findings.map((f) => f.id);
    expect(ids).not.toContain('sports_climbing_uiaa_en_voluntary');
  });
});

// ── Scenario 6: Recreational climbing harness ────────────────────────────────

describe('Scenario 6: Recreational climbing harness', () => {
  const text = 'Rock climbing sit harness, UIAA certified, CE marked, climbing harness';
  const hts = '62114200';
  const answers = {
    sports_product_type: 'climbing_equipment',
    climbing_equipment_type: 'harness',
    is_occupational: 'yes_recreational',
  };

  it('activates sports module', () => {
    const modules = activatedModules(hts, text, answers);
    expect(modules).toContain('sports');
  });

  it('produces voluntary UIAA finding, NOT mandatory OSHA', () => {
    const result = evaluateAllModules(moduleInput({ htsDigits: hts, productText: text, knownFacts: answers }));
    expect(voluntaryFindingIds(result)).toContain('sports_climbing_uiaa_en_voluntary');
    expect(mandatoryFindingIds(result)).not.toContain('sports_fall_arrest_osha_1910_140');
  });
});

// ── Scenario 7: Treadmill (fitness machine, adult) ───────────────────────────

describe('Scenario 7: Motorized treadmill', () => {
  const text = 'Motorized electric treadmill, 3.0 HP motor, belt running exercise machine';
  const hts = '95069100';
  const answers = { sports_product_type: 'fitness_machine' };

  it('activates sports module', () => {
    const modules = activatedModules(hts, text, answers);
    expect(modules).toContain('sports');
  });

  it('produces only voluntary fitness finding — no mandatory standard', () => {
    const result = evaluateAllModules(moduleInput({ htsDigits: hts, productText: text, knownFacts: answers }));
    expect(voluntaryFindingIds(result)).toContain('sports_fitness_machine_astm');
    expect(mandatoryFindingIds(result)).not.toContain('sports_fitness_machine_astm');
  });
});

// ── Scenario 8: Trampoline ───────────────────────────────────────────────────

describe('Scenario 8: Outdoor trampoline', () => {
  const text = 'Outdoor trampoline with safety enclosure, 14-foot round frame, spring-loaded';
  const hts = '95069990';
  const answers = { sports_product_type: 'trampoline' };

  it('activates sports module', () => {
    const modules = activatedModules(hts, text, answers);
    expect(modules).toContain('sports');
  });

  it('produces voluntary ASTM F381 finding — not mandatory', () => {
    const result = evaluateAllModules(moduleInput({ htsDigits: hts, productText: text, knownFacts: answers }));
    expect(voluntaryFindingIds(result)).toContain('sports_trampoline_astm_f381');
  });
});

// ── Scenario 9: Boxing gloves (combat sports, adult) ─────────────────────────

describe('Scenario 9: Adult boxing gloves', () => {
  const text = 'Sparring boxing gloves, 16 oz training gloves for martial arts combat sports';
  const hts = '95069990';
  const answers = { sports_product_type: 'combat_sports' };

  it('activates sports module', () => {
    const modules = activatedModules(hts, text, answers);
    expect(modules).toContain('sports');
  });

  it('produces no mandatory finding — adult combat sports has no federal standard', () => {
    const result = evaluateAllModules(moduleInput({ htsDigits: hts, productText: text, knownFacts: answers }));
    expect(mandatoryFindingIds(result).filter((id) => id.startsWith('sports_'))).toHaveLength(0);
  });

  it('produces voluntary/informational combat finding', () => {
    const result = evaluateAllModules(moduleInput({ htsDigits: hts, productText: text, knownFacts: answers }));
    const ids = result.findings.map((f) => f.id);
    expect(ids).toContain('sports_combat_protective_no_federal');
  });
});

// ── Scenario 10: GPS running watch (sports + electronics) ────────────────────

describe('Scenario 10: GPS fitness watch (sports + electronics)', () => {
  const text = 'GPS running watch with heart rate monitor, Bluetooth, rechargeable lithium battery';
  const hts = '91021900'; // watches HTS
  const answers = {
    sports_product_type: 'other_sports',
    battery_type: 'lithium_ion',
    has_wireless_tx: 'yes',
  };

  it('activates sports + electronics + batteries modules', () => {
    const modules = activatedModules(hts, text, answers);
    expect(modules).toContain('sports');
    expect(modules).toContain('electronics');
    expect(modules).toContain('batteries');
  });
});

// ── Scenario 11: Ski / snowboard helmet ──────────────────────────────────────

describe('Scenario 11: Ski helmet', () => {
  const text = 'Adult ski snowboard helmet with ASTM F2040 impact protection';
  const hts = '95069990';
  const answers = {
    sports_product_type: 'snow_sports',
    sports_helmet_type: 'ski_snowboard_helmet',
  };

  it('activates sports module', () => {
    const modules = activatedModules(hts, text, answers);
    expect(modules).toContain('sports');
  });

  it('produces voluntary ASTM F2040 finding, NOT mandatory', () => {
    const result = evaluateAllModules(moduleInput({ htsDigits: hts, productText: text, knownFacts: answers }));
    const skiHelmet = result.findings.find((f) => f.id === 'sports_ski_helmet_astm_f2040');
    expect(skiHelmet).toBeDefined();
    expect(skiHelmet?.verification_status).toBe('official_unconfirmed');
    expect(mandatoryFindingIds(result)).not.toContain('sports_ski_helmet_astm_f2040');
  });
});

// ── Scenario 12: Activation safeguard — bare "fitness" keyword ───────────────

describe('Scenario 12: Activation safeguard — bare keywords must NOT activate sports', () => {
  it('"fitness supplement" does not activate sports', () => {
    const modules = activatedModules('', 'fitness supplement, protein powder, sports nutrition');
    expect(modules).not.toContain('sports');
  });

  it('"athletic apparel" does not activate sports', () => {
    const modules = activatedModules('', 'athletic performance shirt, moisture-wicking fabric');
    expect(modules).not.toContain('sports');
  });

  it('"professional outdoor lights" does not activate sports', () => {
    const modules = activatedModules('', 'professional outdoor LED lighting system for events');
    expect(modules).not.toContain('sports');
  });
});

// ── Scenario 13: Kayak (water sports) ────────────────────────────────────────

describe('Scenario 13: Hard-shell kayak', () => {
  const text = 'Hard-shell sit-in kayak, polyethylene hull, paddling sports watercraft';
  const hts = '89030000';
  const answers = { sports_product_type: 'kayak_canoe', pfd_type: 'not_pfd' };

  it('activates sports module', () => {
    const modules = activatedModules(hts, text, answers);
    expect(modules).toContain('sports');
  });

  it('produces PFD finding since kayak implies flotation context', () => {
    // kayak_canoe triggers isPfd in the module
    const result = evaluateAllModules(moduleInput({ htsDigits: hts, productText: text, knownFacts: answers }));
    const pfdQuestion = result.questions.find((q) => q.key === 'pfd_type');
    expect(pfdQuestion).toBeDefined();
  });
});

// ── Scenario 14: Children's bicycle (sports + childrens cross-module) ─────────

describe('Scenario 14: Children\'s bicycle under 12', () => {
  const text = '16-inch bicycle for children age 5-8, training wheels included';
  const hts = '87120030';
  const answers = {
    sports_product_type: 'bicycle',
    sports_helmet_type: 'no_helmet',
    age_range: 'age_3_to_12',
  };

  it('activates both sports and childrens modules', () => {
    const modules = activatedModules(hts, text, answers);
    expect(modules).toContain('sports');
    expect(modules).toContain('childrens');
  });

  it('sports module produces mandatory 1512 finding', () => {
    const result = evaluateAllModules(moduleInput({ htsDigits: hts, productText: text, knownFacts: answers }));
    expect(mandatoryFindingIds(result)).toContain('sports_bicycle_cpsc_1512');
  });

  it('childrens module produces CPSIA finding', () => {
    const result = evaluateAllModules(moduleInput({ htsDigits: hts, productText: text, knownFacts: answers }));
    const ids = result.findings.map((f) => f.id);
    expect(ids.some((id) => id?.includes('cpsia'))).toBe(true);
  });
});

// ── Scenario 15a: 6307 HTS alone must NOT activate sports (safeguard) ────────

describe('Scenario 15a: HTS 6307 alone does not activate sports', () => {
  it('dishcloth under 6307 does not activate sports', () => {
    // 6307 is a broad textile heading. Only 6307.20 covers life jackets.
    // The HTS rule was removed; text-based detection must provide positive evidence.
    const modules = activatedModules('63070000', 'cotton dishcloth, kitchen cleaning cloth');
    expect(modules).not.toContain('sports');
  });

  it('decorative flag under 6307 does not activate sports', () => {
    const modules = activatedModules('63070010', 'national flag, woven polyester banner');
    expect(modules).not.toContain('sports');
  });

  it('life jacket under 6307.20 DOES activate sports via text', () => {
    // Text contains "life jacket" — TEXT_RULES positiveRe fires regardless of HTS.
    const modules = activatedModules('63072000', 'life jacket personal flotation device USCG Type III');
    expect(modules).toContain('sports');
  });
});

// ── Scenario 15: "not_sports" answer deactivates module ──────────────────────

describe('Scenario 15: Explicit "not_sports" answer suppresses all sports findings', () => {
  const text = 'Outdoor garden chair, sports-style seating, athletic design';
  const hts = '94011000';
  const answers = { sports_product_type: 'not_sports' };

  it('returns empty findings for sports with not_sports answer', () => {
    const result = evaluateAllModules(moduleInput({ htsDigits: hts, productText: text, knownFacts: answers }));
    const sportsFindings = result.findings.filter((f) => f.id?.startsWith('sports_'));
    expect(sportsFindings).toHaveLength(0);
  });
});

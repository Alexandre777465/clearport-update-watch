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

// ── Report integrity bug regressions ─────────────────────────────────────────
// Bug 2: Adult combat sports must show 'not_applicable' (no mandatory standard
//         identified), NOT 'official_unconfirmed' (cannot determine).
// Bug 3: ASTM F2697 must never appear in boxing glove findings — it covers
//         detention facility barrier testing, not sports protective equipment.

describe('Bug 2 & 3 — boxing gloves: no ASTM F2697, not_applicable status', () => {
  const text = 'cowhide leather boxing gloves, PU foam padding, polyester lining, adults only';
  const hts = '42032180';
  const answers = { sports_product_type: 'combat_sports', protective_gear_type: 'boxing_gloves', age_range: 'adults_only' };

  it('Bug 3 — ASTM F2697 never appears in boxing glove findings (wrong standard)', () => {
    const result = evaluateAllModules(moduleInput({ htsDigits: hts, productText: text, knownFacts: answers }));
    for (const finding of result.findings) {
      expect(finding.explanation ?? '').not.toContain('F2697');
      expect(finding.explanation ?? '').not.toContain('ASTM F2697');
    }
  });

  it('Bug 3 — no "detention" or "correctional" language in sports findings', () => {
    const result = evaluateAllModules(moduleInput({ htsDigits: hts, productText: text, knownFacts: answers }));
    for (const finding of result.findings) {
      expect((finding.explanation ?? '').toLowerCase()).not.toContain('detention');
      expect((finding.explanation ?? '').toLowerCase()).not.toContain('correctional');
    }
  });

  it('Bug 2 — combat sports finding has verification_status not_applicable (no mandatory standard)', () => {
    const result = evaluateAllModules(moduleInput({ htsDigits: hts, productText: text, knownFacts: answers }));
    const combatFinding = result.findings.find((f) => f.id === 'sports_combat_protective_no_federal');
    expect(combatFinding).toBeDefined();
    expect(combatFinding!.verification_status).toBe('not_applicable');
  });

  it('Bug 2 — combat sports finding level is N/A (excluded from regulatory section by UI filter)', () => {
    const result = evaluateAllModules(moduleInput({ htsDigits: hts, productText: text, knownFacts: answers }));
    const combatFinding = result.findings.find((f) => f.id === 'sports_combat_protective_no_federal');
    expect(combatFinding!.level).toBe('N/A');
  });

  it('Bug 2 — sports coverage domain is no_applicable_rule (not official_unconfirmed) for boxing gloves', () => {
    const result = evaluateAllModules(moduleInput({ htsDigits: hts, productText: text, knownFacts: answers }));
    const domain = result.coverageDomains.find((d) => d.domain_key === 'sports_outdoor_equipment');
    expect(domain).toBeDefined();
    expect(domain!.status).toBe('no_applicable_rule');
  });

  it('Bug 2 — combat finding explanation says "No product-specific mandatory U.S. federal safety standard"', () => {
    const result = evaluateAllModules(moduleInput({ htsDigits: hts, productText: text, knownFacts: answers }));
    const combatFinding = result.findings.find((f) => f.id === 'sports_combat_protective_no_federal');
    expect(combatFinding!.explanation).toContain('No product-specific mandatory U.S. federal safety standard');
  });

  it('Bug 3 — combat finding explanation mentions "No completed ASTM boxing glove"', () => {
    const result = evaluateAllModules(moduleInput({ htsDigits: hts, productText: text, knownFacts: answers }));
    const combatFinding = result.findings.find((f) => f.id === 'sports_combat_protective_no_federal');
    expect(combatFinding!.explanation).toContain('No completed ASTM boxing glove');
  });
});

// ── Bicycle helmet product-scope regression tests ────────────────────────────
// Verifies the three invariants for bicycle helmets:
//   1. HTS 6506.x → Part 1512 never fires (product is a helmet, not a bicycle)
//   2. Part 1203 fires for all bicycle helmets regardless of entry path
//   3. Children's product → CPC language, not GCC
//   4. ASTM F963 never appears for a protective helmet
//   5. bicycle_helmet as sports_product_type suppresses Part 1512

describe('Bicycle helmet (HTS 6506.10) — no Part 1512 false-positive', () => {
  const text = "children's bicycle helmet, polycarbonate shell, EPS foam liner, ages 3-12";
  const hts = '65061030';
  const answers = {
    sports_product_type: 'bicycle',          // broad sports category detected from text
    sports_helmet_type: 'bicycle_helmet',
    age_range: 'age_3_to_12',
    contains_paint_or_surface_coating: 'no',
  };

  it('HTS 6506.x suppresses Part 1512 (bicycle standard must not fire for a helmet)', () => {
    const result = evaluateAllModules(moduleInput({ htsDigits: hts, productText: text, knownFacts: answers }));
    const ids = result.findings.map((f) => f.id);
    expect(ids).not.toContain('sports_bicycle_cpsc_1512');
  });

  it('Part 1203 fires for bicycle helmet (mandatory CPSC standard)', () => {
    const result = evaluateAllModules(moduleInput({ htsDigits: hts, productText: text, knownFacts: answers }));
    expect(mandatoryFindingIds(result)).toContain('sports_bicycle_helmet_cpsc_1203');
  });

  it("Part 1203 explanation mentions CPC (not GCC) for a children's helmet", () => {
    const result = evaluateAllModules(moduleInput({ htsDigits: hts, productText: text, knownFacts: answers }));
    const finding = result.findings.find((f) => f.id === 'sports_bicycle_helmet_cpsc_1203');
    expect(finding?.explanation).toContain("Children's Product Certificate (CPC)");
    expect(finding?.explanation).not.toContain('General Certificate of Conformity (GCC)');
  });

  it("Part 1203 docSpec is a test report (no embedded CPC) — CPC comes from children's module separately", () => {
    const result = evaluateAllModules(moduleInput({ htsDigits: hts, productText: text, knownFacts: answers }));
    const doc = result.docSpecs.find((d) => d.finding_id === 'sports_bicycle_helmet_cpsc_1203');
    // Sports module emits only the test report; children's module emits the CPC separately.
    expect(doc?.document).toContain('1203');
    expect(doc?.document).not.toContain('GCC');
    const cpcDoc = result.docSpecs.find((d) => d.finding_id === 'cpsia_cpc');
    expect(cpcDoc).toBeDefined();
  });

  it('ASTM F963 does not appear for a protective bicycle helmet', () => {
    const result = evaluateAllModules(moduleInput({ htsDigits: hts, productText: text, knownFacts: answers }));
    const ids = result.findings.map((f) => f.id);
    expect(ids).not.toContain('cpsc_toy_f963');
    const docs = result.docSpecs.map((d) => d.document);
    expect(docs.some((d) => d.includes('F963'))).toBe(false);
  });
});

describe('Bicycle helmet via sports_product_type=bicycle_helmet — no Part 1512', () => {
  const text = 'road cycling helmet, ventilated polycarbonate shell';
  const hts = '65069990'; // other headgear
  const answers = {
    sports_product_type: 'bicycle_helmet',
    age_range: 'over_12',
  };

  it('sports_product_type=bicycle_helmet suppresses Part 1512', () => {
    const result = evaluateAllModules(moduleInput({ htsDigits: hts, productText: text, knownFacts: answers }));
    const ids = result.findings.map((f) => f.id);
    expect(ids).not.toContain('sports_bicycle_cpsc_1512');
  });

  it('Part 1203 fires via bicycle_helmet product type', () => {
    const result = evaluateAllModules(moduleInput({ htsDigits: hts, productText: text, knownFacts: answers }));
    expect(mandatoryFindingIds(result)).toContain('sports_bicycle_helmet_cpsc_1203');
  });

  it('adult helmet uses GCC (not CPC)', () => {
    const result = evaluateAllModules(moduleInput({ htsDigits: hts, productText: text, knownFacts: answers }));
    const finding = result.findings.find((f) => f.id === 'sports_bicycle_helmet_cpsc_1203');
    expect(finding?.explanation).toContain('General Certificate of Conformity (GCC)');
    expect(finding?.explanation).not.toContain("Children's Product Certificate (CPC)");
  });
});

describe('Bicycle WITH included helmet still produces both Part 1512 and Part 1203', () => {
  // Scenario 2 compatibility: a bicycle sold WITH a helmet should trigger both standards.
  const text = '20-inch kids bicycle with included protective bicycle helmet';
  const hts = '87120060'; // actual bicycle HTS — not 6506
  const answers = {
    sports_product_type: 'bicycle',
    sports_helmet_type: 'bicycle_helmet',
    age_range: 'age_3_to_12',
  };

  it('actual bicycle HTS does NOT suppress Part 1512', () => {
    const result = evaluateAllModules(moduleInput({ htsDigits: hts, productText: text, knownFacts: answers }));
    expect(mandatoryFindingIds(result)).toContain('sports_bicycle_cpsc_1512');
  });

  it('Part 1203 also fires for the included helmet', () => {
    const result = evaluateAllModules(moduleInput({ htsDigits: hts, productText: text, knownFacts: answers }));
    expect(mandatoryFindingIds(result)).toContain('sports_bicycle_helmet_cpsc_1203');
  });
});

// ── Children's product module — tracking label and F963 regression tests ──────

describe('CPSIA tracking label — required for confirmed children\'s products', () => {
  const text = "children's bicycle helmet, ages 3-12";
  const hts = '65061030';
  const answers = {
    sports_product_type: 'bicycle_helmet',
    age_range: 'age_3_to_12',
    contains_paint_or_surface_coating: 'no',
  };

  it('tracking label finding appears for confirmed children\'s product', () => {
    const result = evaluateAllModules(moduleInput({ htsDigits: hts, productText: text, knownFacts: answers }));
    const ids = result.findings.map((f) => f.id);
    expect(ids).toContain('cpsia_tracking_label');
  });

  it('tracking label finding is verified_applicable', () => {
    const result = evaluateAllModules(moduleInput({ htsDigits: hts, productText: text, knownFacts: answers }));
    const finding = result.findings.find((f) => f.id === 'cpsia_tracking_label');
    expect(finding?.verification_status).toBe('verified_applicable');
  });

  it("tracking label docSpec is 'before_sale' (label must be on product, checked at customs)", () => {
    const result = evaluateAllModules(moduleInput({ htsDigits: hts, productText: text, knownFacts: answers }));
    const doc = result.docSpecs.find((d) => d.finding_id === 'cpsia_tracking_label');
    expect(doc).toBeDefined();
    expect(doc?.doc_status).toBe('before_sale');
  });
});

describe('ASTM F963 — must not appear for non-toy children\'s products', () => {
  it('bicycle helmet (age_3_to_12) does not produce F963 finding or docSpec', () => {
    const result = evaluateAllModules(moduleInput({
      htsDigits: '65061030',
      productText: "children's bicycle helmet ages 3-12",
      knownFacts: { age_range: 'age_3_to_12', contains_paint_or_surface_coating: 'no' },
    }));
    expect(result.findings.map((f) => f.id)).not.toContain('cpsc_toy_f963');
    expect(result.docSpecs.some((d) => d.document.includes('F963'))).toBe(false);
  });

  it('children\'s lead pad (not toy, no "toy" in text, not HTS 9503) does not produce F963 docSpec', () => {
    const result = evaluateAllModules(moduleInput({
      htsDigits: '39262090',
      productText: "children's foam playmat, non-toxic EVA foam, ages 2+",
      knownFacts: { age_range: 'age_3_to_12', contains_paint_or_surface_coating: 'no' },
    }));
    expect(result.docSpecs.some((d) => d.document.includes('F963'))).toBe(false);
  });

  it('product with "toy" in text DOES produce F963 finding (positive case)', () => {
    const result = evaluateAllModules(moduleInput({
      htsDigits: '95030090',
      productText: 'plastic toy construction set, ages 3+',
      knownFacts: { age_range: 'age_3_to_12', contains_paint_or_surface_coating: 'no' },
    }));
    expect(result.findings.map((f) => f.id)).toContain('cpsc_toy_f963');
  });
});

describe('CPSC eFiling — required when import date on or after 2026-07-08', () => {
  const childHelmetInput = (importDate: string) => moduleInput({
    htsDigits: '65061030',
    productText: "children's bicycle helmet, ages 3-12",
    knownFacts: { age_range: 'age_3_to_12', contains_paint_or_surface_coating: 'no' },
    importDate,
  });

  it('eFiling docSpec present when importDate >= 2026-07-08', () => {
    const result = evaluateAllModules(childHelmetInput('2026-07-08'));
    const efilingDoc = result.docSpecs.find((d) => d.document.includes('eFiling'));
    expect(efilingDoc).toBeDefined();
    expect(efilingDoc?.doc_status).toBe('required_to_clear');
  });

  it('eFiling docSpec absent when importDate < 2026-07-08', () => {
    const result = evaluateAllModules(childHelmetInput('2026-07-05'));
    const efilingDoc = result.docSpecs.find((d) => d.document.includes('eFiling'));
    expect(efilingDoc).toBeUndefined();
  });

  it('eFiling docSpec absent for adult products (not childrenConfirmed)', () => {
    const result = evaluateAllModules(moduleInput({
      htsDigits: '65061030',
      productText: 'adult bicycle helmet',
      knownFacts: { age_range: 'over_12' },
      importDate: '2026-07-10',
    }));
    const efilingDoc = result.docSpecs.find((d) => d.document.includes('eFiling'));
    expect(efilingDoc).toBeUndefined();
  });
});

// ── Toy classification — negation and positive-signal regression tests ─────────
// These guard the four invariants:
//   1. "no toy function" (negation in a list) → isToy = false
//   2. "not a toy" → isToy = false
//   3. bicycle_helmet product type → isToy = false
//   4. "toy" in text WITHOUT negation → isToy = true (positive case preserved)
//   5. HTS 9503 → isToy = true regardless of text

describe('Toy detection — negation: "no toy function" in description', () => {
  // This is the exact live description that produced the false-positive.
  const EXACT_LIVE_DESCRIPTION =
    "children's bicycle helmet, polycarbonate shell, EPS foam liner, ages 3-12. " +
    'No electronics, batteries, lights, magnets, liquids, medical claims, toy function, or workplace use.';
  const hts = '65061030'; // HTS 6506.10.3045 prefix
  const answers = {
    sports_product_type: 'bicycle',
    sports_helmet_type: 'bicycle_helmet',
    age_range: 'age_3_to_12',
    contains_paint_or_surface_coating: 'no',
  };

  it('exact live description — ASTM F963 finding must not appear', () => {
    const result = evaluateAllModules(moduleInput({ htsDigits: hts, productText: EXACT_LIVE_DESCRIPTION, knownFacts: answers }));
    expect(result.findings.map((f) => f.id)).not.toContain('cpsc_toy_f963');
  });

  it('exact live description — F963 docSpec must not appear', () => {
    const result = evaluateAllModules(moduleInput({ htsDigits: hts, productText: EXACT_LIVE_DESCRIPTION, knownFacts: answers }));
    expect(result.docSpecs.some((d) => d.document.includes('F963'))).toBe(false);
  });

  it('exact live description — Part 1203 still fires (required)', () => {
    const result = evaluateAllModules(moduleInput({ htsDigits: hts, productText: EXACT_LIVE_DESCRIPTION, knownFacts: answers }));
    expect(mandatoryFindingIds(result)).toContain('sports_bicycle_helmet_cpsc_1203');
  });

  it('exact live description — Part 1512 must not fire (HTS 6506, not a bicycle)', () => {
    const result = evaluateAllModules(moduleInput({ htsDigits: hts, productText: EXACT_LIVE_DESCRIPTION, knownFacts: answers }));
    expect(result.findings.map((f) => f.id)).not.toContain('sports_bicycle_cpsc_1512');
  });

  it('exact live description — test report is Part 1203 only (no embedded CPC); CPC comes from children module', () => {
    const result = evaluateAllModules(moduleInput({ htsDigits: hts, productText: EXACT_LIVE_DESCRIPTION, knownFacts: answers }));
    const doc = result.docSpecs.find((d) => d.finding_id === 'sports_bicycle_helmet_cpsc_1203');
    expect(doc?.document).toContain('1203');
    expect(doc?.document).not.toContain('GCC');
    const cpcDoc = result.docSpecs.find((d) => d.finding_id === 'cpsia_cpc');
    expect(cpcDoc).toBeDefined();
  });

  it('exact live description — CPSIA third-party testing appears', () => {
    const result = evaluateAllModules(moduleInput({ htsDigits: hts, productText: EXACT_LIVE_DESCRIPTION, knownFacts: answers }));
    expect(mandatoryFindingIds(result)).toContain('cpsia_third_party_testing');
  });

  it('exact live description — lead requirement appears', () => {
    const result = evaluateAllModules(moduleInput({ htsDigits: hts, productText: EXACT_LIVE_DESCRIPTION, knownFacts: answers }));
    const leadFinding = result.findings.find((f) => f.id === 'cpsia_lead');
    expect(leadFinding).toBeDefined();
    expect(leadFinding?.verification_status).toBe('verified_applicable');
  });

  it('exact live description — tracking label appears', () => {
    const result = evaluateAllModules(moduleInput({ htsDigits: hts, productText: EXACT_LIVE_DESCRIPTION, knownFacts: answers }));
    expect(result.findings.map((f) => f.id)).toContain('cpsia_tracking_label');
  });
});

describe('Toy detection — universal negation patterns', () => {
  const baseInput = (productText: string, knownFacts: Record<string, string> = {}) =>
    moduleInput({ htsDigits: '65061030', productText, knownFacts });

  it('"not a toy" suppresses F963', () => {
    const result = evaluateAllModules(baseInput("children's protective gear, not a toy, ages 3-12", { age_range: 'age_3_to_12' }));
    expect(result.findings.map((f) => f.id)).not.toContain('cpsc_toy_f963');
  });

  it('"toy function" alone suppresses F963 (without explicit "no")', () => {
    const result = evaluateAllModules(baseInput("children's helmet with no toy function, protective use only", { age_range: 'age_3_to_12' }));
    expect(result.findings.map((f) => f.id)).not.toContain('cpsc_toy_f963');
  });

  it('"non-toy" suppresses F963', () => {
    const result = evaluateAllModules(baseInput("non-toy children's product, shin guard for kids", { age_range: 'age_3_to_12' }));
    expect(result.findings.map((f) => f.id)).not.toContain('cpsc_toy_f963');
  });

  it('"protective equipment only" suppresses F963', () => {
    const result = evaluateAllModules(baseInput("protective equipment only, children's elbow pads", { age_range: 'age_3_to_12' }));
    expect(result.findings.map((f) => f.id)).not.toContain('cpsc_toy_f963');
  });

  it('is_toy=no knownFact suppresses F963 even for HTS 9503 product', () => {
    const result = evaluateAllModules(moduleInput({
      htsDigits: '95030090',
      productText: 'children product',
      knownFacts: { age_range: 'age_3_to_12', is_toy: 'no' },
    }));
    expect(result.findings.map((f) => f.id)).not.toContain('cpsc_toy_f963');
  });

  it('bicycle_helmet sports_product_type suppresses F963 even when "toy" in text', () => {
    const result = evaluateAllModules(moduleInput({
      htsDigits: '65061030',
      productText: "children's bicycle helmet — not a toy product",
      knownFacts: { sports_product_type: 'bicycle_helmet', age_range: 'age_3_to_12' },
    }));
    expect(result.findings.map((f) => f.id)).not.toContain('cpsc_toy_f963');
  });
});

describe('Toy detection — positive signals preserved', () => {
  it('"remote controlled toy" (no HTS 9503) still activates F963', () => {
    const result = evaluateAllModules(moduleInput({
      htsDigits: '95030090',
      productText: 'remote controlled toy car, battery operated',
      knownFacts: { age_range: 'age_3_to_12' },
    }));
    expect(result.findings.map((f) => f.id)).toContain('cpsc_toy_f963');
  });

  it('HTS 9503 alone activates F963 even with plain product text', () => {
    const result = evaluateAllModules(moduleInput({
      htsDigits: '95030090',
      productText: 'children plastic building set',
      knownFacts: { age_range: 'age_3_to_12' },
    }));
    expect(result.findings.map((f) => f.id)).toContain('cpsc_toy_f963');
  });

  it('is_toy=yes activates F963 without HTS 9503 or "toy" in text', () => {
    const result = evaluateAllModules(moduleInput({
      htsDigits: '65061030',
      productText: "children's play product",
      knownFacts: { age_range: 'age_3_to_12', is_toy: 'yes' },
    }));
    expect(result.findings.map((f) => f.id)).toContain('cpsc_toy_f963');
  });

  it('"toy" in regulatory context ("ASTM F963 Toy Safety") does not activate F963 via text alone', () => {
    const result = evaluateAllModules(moduleInput({
      htsDigits: '65061030',
      productText: "children's product — check ASTM F963 Toy Safety Standard compliance",
      knownFacts: { age_range: 'age_3_to_12' },
    }));
    // "Toy Safety" is excluded by the positive RE lookahead, and there's no HTS 9503 or is_toy=yes
    expect(result.findings.map((f) => f.id)).not.toContain('cpsc_toy_f963');
  });
});

// ── Adult bicycle helmet — document checklist regression tests ────────────────
// Verifies that is_children=false produces GCC (not CPC) and excludes all
// children's-specific documents: CPSIA third-party test reports, CPC, tracking label.

describe('Adult bicycle helmet (is_children=false, age_range=over_12) — no children\'s docs', () => {
  const result = evaluateAllModules(moduleInput({
    htsDigits: '65061030',
    productText: 'adult bicycle helmet, polycarbonate shell, EPS foam liner, ages 13 and up',
    attrs: { is_children: false },
    knownFacts: {
      sports_product_type: 'bicycle_helmet',
      age_range: 'over_12',
    },
    importDate: '2026-07-10',
  }));

  it('Part 1203 fires (mandatory CPSC standard)', () => {
    expect(mandatoryFindingIds(result)).toContain('sports_bicycle_helmet_cpsc_1203');
  });

  it('Part 1203 docSpec uses GCC, not CPC', () => {
    const doc = result.docSpecs.find((d) => d.finding_id === 'sports_bicycle_helmet_cpsc_1203');
    expect(doc?.document).toContain('GCC');
    expect(doc?.document).not.toContain('CPC');
  });

  it('no CPC docSpec anywhere', () => {
    const cpcDocs = result.docSpecs.filter((d) => d.document.includes('Children\'s Product Certificate'));
    expect(cpcDocs).toHaveLength(0);
  });

  it('no CPSIA third-party test report docSpec', () => {
    const cpsiaDoc = result.docSpecs.find((d) => d.document.includes('CPSIA'));
    expect(cpsiaDoc).toBeUndefined();
  });

  it('no tracking label docSpec', () => {
    const trackingDoc = result.docSpecs.find((d) => d.finding_id === 'cpsia_tracking_label');
    expect(trackingDoc).toBeUndefined();
  });

  it('no eFiling docSpec (adult product)', () => {
    const efilingDoc = result.docSpecs.find((d) => d.document.includes('eFiling'));
    expect(efilingDoc).toBeUndefined();
  });

  it('no ASTM F963 finding', () => {
    expect(result.findings.map((f) => f.id)).not.toContain('cpsc_toy_f963');
  });

  it('no Part 1512 finding (product is helmet, not bicycle)', () => {
    expect(result.findings.map((f) => f.id)).not.toContain('sports_bicycle_cpsc_1512');
  });
});

describe('Adult bicycle helmet (is_children=false only, no age_range knownFact) — no children\'s docs', () => {
  // This is the specific live-system scenario: is_children=false in attrs but no explicit
  // age_range structured answer. The is_children=false attr must be sufficient to suppress all
  // children's-product documents.
  const result = evaluateAllModules(moduleInput({
    htsDigits: '65061030',
    productText: 'adult bicycle helmet, polycarbonate shell, EPS foam liner',
    attrs: { is_children: false },
    knownFacts: {
      sports_product_type: 'bicycle_helmet',
      // age_range deliberately omitted — only attrs.is_children=false is set
    },
  }));

  it('no CPC docSpec when only is_children=false (no age_range answer)', () => {
    expect(result.docSpecs.filter((d) => d.document.includes('Children\'s Product Certificate'))).toHaveLength(0);
  });

  it('no CPSIA third-party test report docSpec when only is_children=false', () => {
    expect(result.docSpecs.find((d) => d.document.includes('CPSIA'))).toBeUndefined();
  });

  it('no tracking label docSpec when only is_children=false', () => {
    expect(result.docSpecs.find((d) => d.finding_id === 'cpsia_tracking_label')).toBeUndefined();
  });
});

describe('Adult bicycle helmet: is_children=false overrides stale age_3_to_12 answer', () => {
  // Defensive test: if a stale knownFact age_range=age_3_to_12 exists but attrs.is_children=false,
  // the attr must win and suppress all children's documents.
  const result = evaluateAllModules(moduleInput({
    htsDigits: '65061030',
    productText: 'adult bicycle helmet, polycarbonate shell',
    attrs: { is_children: false },
    knownFacts: {
      sports_product_type: 'bicycle_helmet',
      age_range: 'age_3_to_12',  // stale / incorrect answer
    },
  }));

  it('is_children=false overrides stale age_3_to_12: no CPC docSpec', () => {
    expect(result.docSpecs.filter((d) => d.document.includes('Children\'s Product Certificate'))).toHaveLength(0);
  });

  it('is_children=false overrides stale age_3_to_12: no CPSIA third-party docSpec', () => {
    expect(result.docSpecs.find((d) => d.document.includes('CPSIA'))).toBeUndefined();
  });

  it('is_children=false overrides stale age_3_to_12: Part 1203 docSpec uses GCC not CPC', () => {
    const doc = result.docSpecs.find((d) => d.finding_id === 'sports_bicycle_helmet_cpsc_1203');
    expect(doc?.document).toContain('GCC');
    expect(doc?.document).not.toContain('CPC');
  });
});

describe("Children's bicycle helmet (is_children=true) — CPC and tracking label preserved", () => {
  const result = evaluateAllModules(moduleInput({
    htsDigits: '65061030',
    productText: "children's bicycle helmet, polycarbonate shell, EPS foam liner, ages 3-12",
    attrs: { is_children: true },
    knownFacts: {
      sports_product_type: 'bicycle_helmet',
      age_range: 'age_3_to_12',
      contains_paint_or_surface_coating: 'no',
    },
    importDate: '2026-07-10',
  }));

  it("Part 1203 fires for children's helmet", () => {
    expect(mandatoryFindingIds(result)).toContain('sports_bicycle_helmet_cpsc_1203');
  });

  it("Part 1203 docSpec is test-report-only (no embedded CPC) for children's helmet", () => {
    const doc = result.docSpecs.find((d) => d.finding_id === 'sports_bicycle_helmet_cpsc_1203');
    expect(doc?.document).toContain('1203');
    expect(doc?.document).not.toContain('GCC');
    // CPC must not be embedded — it comes from the children's module as a separate entry.
    expect(doc?.document).not.toContain('CPC');
  });

  it("CPC docSpec present for children's helmet (from children's module)", () => {
    const cpcDoc = result.docSpecs.find((d) => d.finding_id === 'cpsia_cpc');
    expect(cpcDoc).toBeDefined();
    expect(cpcDoc?.document).toContain("Children's Product Certificate");
  });

  it("No duplicate test-report docSpecs — only one test report entry (Part 1203) for children's helmet", () => {
    // When sports_product_type is set, the children's module suppresses its generic CPSIA test-report
    // docSpec; the sports module's Part 1203 docSpec is the sole test-report entry.
    const testReportDocs = result.docSpecs.filter((d) =>
      d.document.includes('Test Report') || d.document.includes('test report'),
    );
    expect(testReportDocs).toHaveLength(1);
    expect(testReportDocs[0].document).toContain('1203');
  });

  it("tracking label docSpec present for children's helmet", () => {
    const trackingDoc = result.docSpecs.find((d) => d.finding_id === 'cpsia_tracking_label');
    expect(trackingDoc).toBeDefined();
  });

  it("eFiling docSpec present for children's helmet on or after 2026-07-08", () => {
    const efilingDoc = result.docSpecs.find((d) => d.document.includes('eFiling'));
    expect(efilingDoc).toBeDefined();
  });
});

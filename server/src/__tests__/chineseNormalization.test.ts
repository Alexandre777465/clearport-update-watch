/**
 * Regression tests for Chinese product text normalization.
 *
 * Verifies that:
 * - Chinese bicycle helmet names trigger 16 CFR Part 1203 / GCC / third-party test report
 * - Chinese children's helmet triggers CPC + CPSIA tracking label (not just helmet rules)
 * - Chinese mountain bicycle triggers 16 CFR Part 1512
 * - Chinese mountain bicycle does NOT trigger helmet rules
 * - Non-electric / no-battery Chinese descriptions do NOT set is_children or battery facts
 * - English-only text passes through unchanged
 * - Normalization appends English keywords without removing original Chinese
 */

import { describe, it, expect } from 'bun:test';
import { normalizeProductTextForDetection } from '../services/chineseNormalization';
import { extractFacts, activateFromFacts, MODULE_MANIFESTS } from '../services/factEngine';
import { evaluateAllModules } from '../services/regulatoryModules/index';
import type { ModuleInput } from '../services/regulatoryModules/index';

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalize(text: string): string {
  return normalizeProductTextForDetection(text);
}

function makeInput(
  htsDigits: string,
  productText: string,
  knownFacts: Record<string, string> = {},
  attrs: ModuleInput['attrs'] = {},
): ModuleInput {
  return {
    htsDigits,
    productText: normalizeProductTextForDetection(productText),
    attrs,
    originCountry: 'China',
    importDate: '2026-07-09',
    knownFacts,
  };
}

function findingIds(result: ReturnType<typeof evaluateAllModules>): string[] {
  return result.findings.map((f) => f.id);
}

function activeModules(hts: string, text: string, answers: Record<string, string> = {}): string[] {
  const facts = extractFacts(hts, normalizeProductTextForDetection(text), answers);
  return activateFromFacts(facts, MODULE_MANIFESTS);
}

// ── normalizeProductTextForDetection unit tests ───────────────────────────────

describe('normalizeProductTextForDetection: basic behaviour', () => {
  it('returns English text unchanged', () => {
    const text = 'adult bicycle helmet non-electric';
    expect(normalize(text)).toBe(text);
  });

  it('preserves original Chinese characters in the output', () => {
    const result = normalize('成人自行车头盔');
    expect(result).toContain('成人自行车头盔');
  });

  it('appends English keywords when Chinese is present', () => {
    const result = normalize('自行车头盔');
    expect(result).toContain('bicycle helmet');
  });

  it('bicycle helmet: appends bicycle and helmet keywords', () => {
    const result = normalize('成人自行车头盔');
    expect(result).toContain('bicycle');
    expect(result).toContain('helmet');
    expect(result).toContain('adult');
  });

  it('mountain bicycle: appends mountain bicycle keywords', () => {
    const result = normalize('山地自行车');
    expect(result).toContain('mountain bicycle');
  });

  it('children: appends child/children keywords', () => {
    const result = normalize('儿童头盔');
    expect(result).toContain('children');
    expect(result).toContain('child');
    expect(result).toContain('helmet');
  });

  it('non-electric: appends non-electric keyword', () => {
    const result = normalize('非电动成人自行车头盔');
    expect(result).toContain('non-electric');
  });

  it('battery: appends battery keyword', () => {
    const result = normalize('锂电池产品');
    expect(result).toContain('battery');
    expect(result).toContain('lithium battery');
  });

  it('empty string returns empty string', () => {
    expect(normalize('')).toBe('');
  });

  it('mixed Chinese + English text preserves both', () => {
    const result = normalize('成人 adult bicycle');
    expect(result).toContain('成人');
    expect(result).toContain('adult bicycle');
  });
});

// ── Chinese adult bicycle helmet ──────────────────────────────────────────────
// HTS 6506.10.3045 — safety headgear
// Expected: is_sports_equipment yes (via helmet+bicycle text), head_protection yes
// Findings: 16 CFR Part 1203 + GCC + third-party test report
// NOT expected: CPC (adult), CPSIA tracking label (adult)

describe('scenario: Chinese adult bicycle helmet (HTS 6506.10.3045)', () => {
  const hts  = '6506103045';
  const text = '成人自行车头盔 非电动 不含电池 不含电子元件 符合CPSC 16 CFR Part 1203标准';

  it('normalized text contains bicycle and helmet', () => {
    const n = normalize(text);
    expect(n).toContain('bicycle');
    expect(n).toContain('helmet');
    expect(n).toContain('adult');
    expect(n).toContain('non-electric');
  });

  it('extracts head_protection=yes from normalized text', () => {
    const n = normalize(text);
    const facts = extractFacts(hts, n);
    expect(facts.head_protection.value).toBe('yes');
  });

  it('activates sports module', () => {
    const mods = activeModules(hts, text);
    expect(mods).toContain('sports');
  });

  it('does NOT activate childrens module (adult product)', () => {
    const mods = activeModules(hts, text);
    expect(mods).not.toContain('childrens');
  });

  it('does NOT activate electronics or batteries modules (no electronics/battery)', () => {
    const mods = activeModules(hts, text);
    expect(mods).not.toContain('electronics');
    expect(mods).not.toContain('batteries');
  });

  it('findings include bicycle helmet standard (16 CFR Part 1203)', () => {
    const input = makeInput(hts, text, { sports_product_type: 'bicycle_helmet' });
    const result = evaluateAllModules(input);
    const ids = findingIds(result);
    expect(ids.some((id) => id.includes('bicycle_helmet') || id.includes('1203') || id.includes('cpsc_helmet'))).toBe(true);
  });
});

// ── Chinese children's bicycle helmet ─────────────────────────────────────────
// Expected: is_sports_equipment yes, head_protection yes, intended_for_children yes
// Findings: Part 1203 + CPC + CPSIA tracking label

describe('scenario: Chinese children bicycle helmet', () => {
  const hts  = '6506103045';
  const text = '儿童自行车头盔 儿童安全帽 适合5-12岁儿童使用';

  it('normalized text contains bicycle, helmet, and children', () => {
    const n = normalize(text);
    expect(n).toContain('bicycle');
    expect(n).toContain('helmet');
    expect(n).toContain('children');
    expect(n).toContain('child');
  });

  it('extracts head_protection=yes and intended_for_children=yes', () => {
    const n = normalize(text);
    const facts = extractFacts(hts, n);
    expect(facts.head_protection.value).toBe('yes');
    expect(facts.intended_for_children.value).toBe('yes');
  });

  it('activates sports and childrens modules', () => {
    const mods = activeModules(hts, text);
    expect(mods).toContain('sports');
    expect(mods).toContain('childrens');
  });

  it('findings include CPSC / children safety requirements', () => {
    const input = makeInput(hts, text, {
      sports_product_type: 'bicycle_helmet',
      child_age_group: 'child_3_12',
    });
    const result = evaluateAllModules(input);
    const ids = findingIds(result);
    // Should include at least one children's product finding (CPC or CPSIA)
    expect(ids.some((id) =>
      id.includes('cpc') || id.includes('cpsia') || id.includes('children') || id.includes('childrens')
    )).toBe(true);
  });
});

// ── Chinese adult mountain bicycle ────────────────────────────────────────────
// HTS 8712.00.2500 (adult bicycle > 20" wheels)
// Expected: is_sports_equipment yes (both text + HTS 8712), head_protection NOT yes
// Findings: 16 CFR Part 1512 (bicycle safety standard), NOT Part 1203

describe('scenario: Chinese adult mountain bicycle (HTS 8712.00.2500)', () => {
  const hts  = '8712002500';
  const text = '成人山地自行车 26英寸车轮 铝合金车架 非电动';

  it('normalized text contains mountain bicycle and adult but NOT helmet', () => {
    const n = normalize(text);
    expect(n).toContain('mountain bicycle');
    expect(n).toContain('bicycle');
    expect(n).toContain('adult');
    expect(n).not.toContain('helmet');
  });

  it('is_sports_equipment=yes (HTS 8712 activates it)', () => {
    const n = normalize(text);
    const facts = extractFacts(hts, n);
    expect(facts.is_sports_equipment.value).toBe('yes');
  });

  it('head_protection is NOT yes (no helmet in description)', () => {
    const n = normalize(text);
    const facts = extractFacts(hts, n);
    expect(facts.head_protection.value).not.toBe('yes');
  });

  it('activates sports module', () => {
    const mods = activeModules(hts, text);
    expect(mods).toContain('sports');
  });

  it('does NOT activate childrens module', () => {
    const mods = activeModules(hts, text);
    expect(mods).not.toContain('childrens');
  });

  it('findings include bicycle standard (Part 1512)', () => {
    const input = makeInput(hts, text, { sports_product_type: 'bicycle' });
    const result = evaluateAllModules(input);
    const ids = findingIds(result);
    expect(ids.some((id) => id.includes('bicycle') || id.includes('1512'))).toBe(true);
  });

  it('findings do NOT include bicycle helmet standard (Part 1203) — no helmet', () => {
    const input = makeInput(hts, text);
    const result = evaluateAllModules(input);
    const ids = findingIds(result);
    // Bicycle module should fire (Part 1512), but helmet-specific finding should not
    // unless the user explicitly answers sports_product_type = bicycle_helmet
    expect(ids.some((id) => id.includes('1203') || id === 'cpsc_helmet')).toBe(false);
  });
});

// ── Chinese adult non-electric description: does not set is_children ──────────

describe('scenario: Chinese adult non-electric product — no children activation', () => {
  const hts  = '6506103045';
  const text = '成人用头盔 非电动 无电池';

  it('adult (成人) does NOT trigger intended_for_children', () => {
    const n = normalize(text);
    const facts = extractFacts(hts, n);
    expect(facts.intended_for_children.value).not.toBe('yes');
  });

  it('non-electric (非电动) does NOT trigger contains_battery', () => {
    const n = normalize(text);
    const facts = extractFacts(hts, n);
    expect(facts.contains_battery.value).not.toBe('yes');
  });

  it('does not activate childrens module', () => {
    const mods = activeModules(hts, text);
    expect(mods).not.toContain('childrens');
  });
});

// ── Task 7: sports.ts isChildrensProduct fix ──────────────────────────────────
// Before the fix, sports.ts only checked attrs.is_children and knownFacts
// age_range — it ignored the factEngine text-derived intended_for_children fact.
// These tests verify that Chinese children's text now produces CPC (not GCC)
// from the sports module even without structured age_range answers.

describe('Task 7: Chinese children bicycle helmet — CPC from text alone', () => {
  const hts  = '6506103045';
  // Full Chinese description matching the user's reported test case
  const text = '儿童自行车头盔 适用于5至12岁儿童 CPSC认证 符合16 CFR Part 1203标准';

  it('extracts intended_for_children=yes from Chinese text', () => {
    const n = normalize(text);
    const facts = extractFacts(hts, n);
    expect(facts.intended_for_children.value).toBe('yes');
  });

  it('activates both sports and childrens modules', () => {
    const mods = activeModules(hts, text);
    expect(mods).toContain('sports');
    expect(mods).toContain('childrens');
  });

  it('sports module emits CPC (not GCC) when children text detected — core fix', () => {
    // No structured age answer — sports.ts must derive isChildrensProduct from text
    const input = makeInput(hts, text, {});
    // Simulate user answering bicycle_helmet in the dynamic question flow
    const inputWithAnswer: ModuleInput = {
      ...input,
      knownFacts: { ...input.knownFacts, sports_product_type: 'bicycle_helmet' },
    };
    const result = evaluateAllModules(inputWithAnswer);
    const helmetFinding = result.findings.find((f) => f.id === 'sports_bicycle_helmet_cpsc_1203');
    expect(helmetFinding).toBeDefined();
    expect(helmetFinding!.explanation).toContain("Children's Product Certificate (CPC)");
    expect(helmetFinding!.explanation).not.toContain('General Conformity Certificate (GCC)');
  });

  it('childrens module emits cpsia_cpc finding', () => {
    const input = makeInput(hts, text, { sports_product_type: 'bicycle_helmet' });
    const result = evaluateAllModules(input);
    const ids = findingIds(result);
    expect(ids).toContain('cpsia_cpc');
  });

  it('childrens module emits cpsia_tracking_label finding', () => {
    const input = makeInput(hts, text, { sports_product_type: 'bicycle_helmet' });
    const result = evaluateAllModules(input);
    const ids = findingIds(result);
    expect(ids).toContain('cpsia_tracking_label');
  });

  it('childrens module emits cpsia_third_party_testing finding', () => {
    const input = makeInput(hts, text, { sports_product_type: 'bicycle_helmet' });
    const result = evaluateAllModules(input);
    const ids = findingIds(result);
    expect(ids).toContain('cpsia_third_party_testing');
  });

  it('sports module emits sports_bicycle_helmet_cpsc_1203 finding', () => {
    const input = makeInput(hts, text, { sports_product_type: 'bicycle_helmet' });
    const result = evaluateAllModules(input);
    const ids = findingIds(result);
    expect(ids).toContain('sports_bicycle_helmet_cpsc_1203');
  });
});

// ── Task 7: Chinese adult bicycle helmet — still no CPC ───────────────────────

describe('Task 7: Chinese adult bicycle helmet — no CPC after fix', () => {
  const hts  = '6506103045';
  const text = '成人自行车头盔 非电动 不含电池 不含电子元件 适合成人骑行';

  it('does NOT extract intended_for_children=yes', () => {
    const n = normalize(text);
    const facts = extractFacts(hts, n);
    expect(facts.intended_for_children.value).not.toBe('yes');
  });

  it('does NOT activate childrens module', () => {
    const mods = activeModules(hts, text);
    expect(mods).not.toContain('childrens');
  });

  it('sports module emits GCC (not CPC) for adult helmet', () => {
    const input = makeInput(hts, text, { sports_product_type: 'bicycle_helmet' });
    const result = evaluateAllModules(input);
    const helmetFinding = result.findings.find((f) => f.id === 'sports_bicycle_helmet_cpsc_1203');
    expect(helmetFinding).toBeDefined();
    expect(helmetFinding!.explanation).not.toContain("Children's Product Certificate (CPC)");
  });

  it('does NOT produce cpsia_cpc finding', () => {
    const input = makeInput(hts, text, { sports_product_type: 'bicycle_helmet' });
    const result = evaluateAllModules(input);
    expect(findingIds(result)).not.toContain('cpsia_cpc');
  });

  it('does NOT produce cpsia_tracking_label finding', () => {
    const input = makeInput(hts, text, { sports_product_type: 'bicycle_helmet' });
    const result = evaluateAllModules(input);
    expect(findingIds(result)).not.toContain('cpsia_tracking_label');
  });
});

// ── Task 7: Negative Chinese child phrases ────────────────────────────────────

describe('Task 7: negative Chinese child phrases override positive substrings', () => {
  const hts = '6506103045';

  it('"不是儿童产品" normalizes to include "not a children"', () => {
    const n = normalize('自行车头盔 不是儿童产品');
    expect(n).toContain('not a children');
    expect(n).toContain('children'); // substring still matched
  });

  it('"不是儿童产品" → intended_for_children NOT yes (negative wins)', () => {
    const n = normalize('自行车头盔 不是儿童产品');
    const facts = extractFacts(hts, n);
    expect(facts.intended_for_children.value).not.toBe('yes');
  });

  it('"不面向儿童销售" → intended_for_children NOT yes', () => {
    const n = normalize('自行车头盔 不面向儿童销售');
    const facts = extractFacts(hts, n);
    expect(facts.intended_for_children.value).not.toBe('yes');
  });

  it('"仅适用于成人" → intended_for_children NOT yes', () => {
    const n = normalize('自行车头盔 仅适用于成人');
    const facts = extractFacts(hts, n);
    expect(facts.intended_for_children.value).not.toBe('yes');
  });

  it('"成人专用" → intended_for_children NOT yes', () => {
    const n = normalize('自行车头盔 成人专用');
    const facts = extractFacts(hts, n);
    expect(facts.intended_for_children.value).not.toBe('yes');
  });

  it('"不是儿童产品" does NOT activate childrens module', () => {
    const mods = activeModules(hts, '自行车头盔 不是儿童产品');
    expect(mods).not.toContain('childrens');
  });
});

// ── Task 7: Positive explicit Chinese child phrases ───────────────────────────

describe('Task 7: explicit positive Chinese child phrases activate children module', () => {
  const hts = '6506103045';

  it('"面向儿童销售" → intended_for_children=yes', () => {
    const n = normalize('自行车头盔 面向儿童销售');
    const facts = extractFacts(hts, n);
    expect(facts.intended_for_children.value).toBe('yes');
  });

  it('"12岁以下" → intended_for_children=yes', () => {
    const n = normalize('自行车头盔 12岁以下');
    const facts = extractFacts(hts, n);
    expect(facts.intended_for_children.value).toBe('yes');
  });

  it('"适用于5至12岁儿童" → intended_for_children=yes', () => {
    const n = normalize('自行车头盔 适用于5至12岁儿童');
    const facts = extractFacts(hts, n);
    expect(facts.intended_for_children.value).toBe('yes');
  });

  it('"面向儿童销售" activates childrens module', () => {
    const mods = activeModules(hts, '自行车头盔 面向儿童销售');
    expect(mods).toContain('childrens');
  });
});

// ── Production-path integration test (attrs.is_children=false default) ────────
// This is the EXACT scenario from the live bug report (commit 15eafa6).
// The form always submits is_children=false by default (the UI checkbox is not
// exposed). This must NOT block text-derived children's detection.

describe('Production-path integration: Chinese children helmet with is_children=false default', () => {
  // Exact product name and description from the live bug report
  const hts = '6506103045';
  const productName = '儿童自行车头盔 测试15eafa6';
  const productDesc =
    '儿童自行车头盔，用于休闲骑行，适用于5至12岁儿童。EPS泡沫缓冲层，聚碳酸酯外壳，可调节尼龙下巴带。' +
    '面向儿童销售。无电子元件、无电池、无蓝牙、无灯光、无电机、非纺织服装、无化学处理、' +
    '无抗菌或杀虫声明、非摩托车头盔。';
  const combinedText = `${productName} ${productDesc}`;

  it('normalized text contains positive child keywords', () => {
    const n = normalize(combinedText);
    expect(n).toContain('for children');
    expect(n).toContain('children');
  });

  it('extractFacts returns intended_for_children=yes from normalized text', () => {
    const n = normalize(combinedText);
    const facts = extractFacts(hts, n);
    expect(facts.intended_for_children.value).toBe('yes');
  });

  it('childrens module activates despite is_children=false default attr', () => {
    // Simulate the production scan path: attrs.is_children=false (form default)
    const mods = activeModules(hts, combinedText);
    expect(mods).toContain('childrens');
    expect(mods).toContain('sports');
  });

  it('cpsia_cpc emitted with attrs.is_children=false (production scenario)', () => {
    // knownFacts matches the user-submitted answers from the live bug report
    const input = makeInput(hts, combinedText, {
      sports_product_type: 'bicycle',
      head_protection_type: 'bicycle_helmet',
    }, { is_children: false });  // production default
    const result = evaluateAllModules(input);
    expect(findingIds(result)).toContain('cpsia_cpc');
  });

  it('cpsia_tracking_label emitted with attrs.is_children=false (production scenario)', () => {
    const input = makeInput(hts, combinedText, {
      sports_product_type: 'bicycle',
      head_protection_type: 'bicycle_helmet',
    }, { is_children: false });
    const result = evaluateAllModules(input);
    expect(findingIds(result)).toContain('cpsia_tracking_label');
  });

  it('cpsia_third_party_testing emitted with attrs.is_children=false', () => {
    const input = makeInput(hts, combinedText, {
      sports_product_type: 'bicycle',
      head_protection_type: 'bicycle_helmet',
    }, { is_children: false });
    const result = evaluateAllModules(input);
    expect(findingIds(result)).toContain('cpsia_third_party_testing');
  });

  it('sports_bicycle_helmet_cpsc_1203 emitted (HTS 6506 activates helmet standard)', () => {
    const input = makeInput(hts, combinedText, {
      sports_product_type: 'bicycle',
      head_protection_type: 'bicycle_helmet',
    }, { is_children: false });
    const result = evaluateAllModules(input);
    expect(findingIds(result)).toContain('sports_bicycle_helmet_cpsc_1203');
  });

  it('Part 1203 finding uses CPC language (not GCC) for Chinese children helmet', () => {
    const input = makeInput(hts, combinedText, {
      sports_product_type: 'bicycle',
      head_protection_type: 'bicycle_helmet',
    }, { is_children: false });
    const result = evaluateAllModules(input);
    const helmetFinding = result.findings.find((f) => f.id === 'sports_bicycle_helmet_cpsc_1203');
    expect(helmetFinding).toBeDefined();
    expect(helmetFinding!.explanation).toContain("Children's Product Certificate (CPC)");
    expect(helmetFinding!.explanation).not.toContain('General Conformity Certificate (GCC)');
  });

  it('adult Chinese helmet with is_children=false still shows GCC (no children keyword)', () => {
    const adultInput = makeInput(hts, '成人自行车头盔 非电动 不含电池', {
      sports_product_type: 'bicycle',
    }, { is_children: false });
    const result = evaluateAllModules(adultInput);
    const helmetFinding = result.findings.find((f) => f.id === 'sports_bicycle_helmet_cpsc_1203');
    // Adult text has no "children" keyword → isChildrensProduct=false → GCC
    expect(helmetFinding?.explanation).not.toContain("Children's Product Certificate (CPC)");
    expect(findingIds(result)).not.toContain('cpsia_cpc');
    expect(findingIds(result)).not.toContain('cpsia_tracking_label');
  });

  it('explicit age_range=not_for_children still suppresses children docs', () => {
    const input = makeInput(hts, combinedText, {
      sports_product_type: 'bicycle',
      age_range: 'not_for_children',  // explicit user denial via dynamic question
    }, { is_children: false });
    const result = evaluateAllModules(input);
    expect(findingIds(result)).not.toContain('cpsia_cpc');
    expect(findingIds(result)).not.toContain('cpsia_tracking_label');
    const helmetFinding = result.findings.find((f) => f.id === 'sports_bicycle_helmet_cpsc_1203');
    expect(helmetFinding?.explanation).not.toContain("Children's Product Certificate (CPC)");
  });
});

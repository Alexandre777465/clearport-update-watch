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
): ModuleInput {
  return {
    htsDigits,
    productText: normalizeProductTextForDetection(productText),
    attrs: {},
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

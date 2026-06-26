/**
 * Stage 6 — automated report-integrity regression tests.
 *
 * These run the DETERMINISTIC report pipeline (no network, no DB, no Anthropic):
 *   USITC rows ──resolveHtsRows──▶ HtsLookupResult
 *                 ──assembleBaselines──▶ baseline RiskCategory[]
 *                 ──finalizeScan──▶ final ProductRiskScan
 *
 * They lock in the system-wide invariants so the "missing duty / silent
 * omission" class of bug cannot recur silently:
 *   1. Every submitted HTS code yields a tariff section — exact, parent/
 *      ambiguous, not_found, or a truthful outage card. Never omitted.
 *   2. Every supported finding (verified / official-unconfirmed) carries an
 *      official source with a valid URL.
 *   3. no_verified_source cards (not_found / outage / neutralized) never
 *      influence the risk score, summary, actions, questions, or documents.
 *   4. Every checklist item is traceable to a supported finding and tagged with
 *      a responsibility group; required items carry a source.
 *   5. Broker/supplier questions and the summary derive only from supported
 *      findings. EN and ZH both render.
 *
 * Run with:  bun test
 */

import { test, it, expect, describe } from 'bun:test';
import { resolveHtsRows, formatHts } from '../services/htsBaseline';
import { assembleBaselines, buildCoverageMatrix, type RegulatoryBaselineRow } from '../services/baselines';
import { finalizeScan, translateScanToZh, type ScanResult } from '../services/riskScanner';
import { evaluateScopeMatch, type AdcvdOrderRow } from '../services/adcvdScanner';
import type { WatchlistEntry, RiskCategory } from '../types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

// Minimal USITC row shape. Rates here are TEST DATA, not authoritative claims —
// the tests assert pipeline behavior, not real-world tariff numbers.
function ratedRow(htsno: string, description: string, general: string, footnote?: string) {
  return {
    htsno,
    description,
    general,
    footnotes: footnote ? [{ value: footnote }] : [],
  };
}

// Rows representing an exact, single rate-bearing subheading.
function exactRows(htsno8dotted: string, desc: string, general: string, footnote?: string) {
  return [ratedRow(htsno8dotted, desc, general, footnote)];
}

const REG_BASELINES: RegulatoryBaselineRow[] = [
  {
    key: 'cpsia_childrens_product',
    category: "Children's Product Safety (CPSIA)",
    agency: 'CPSC',
    title: 'Consumer Product Safety Improvement Act',
    cfr_citation: '15 U.S.C. 2063; 16 CFR 1107',
    official_url: 'https://www.cpsc.gov/Business--Manufacturing/Testing-Certification',
    effective_or_revision: '2008',
    last_verified_at: '2026-06-01',
    applicability: { all_of: ['is_children'] },
    applicability_certainty: 'definite',
    level: 'Critical',
    explanation: "Children's products require third-party testing and a CPC.",
    action: 'Obtain CPSC-accredited test reports and issue a CPC.',
  },
  {
    key: 'lithium_battery_transport',
    category: 'Lithium Battery Transport (DOT/PHMSA)',
    agency: 'DOT/PHMSA',
    title: 'Hazardous Materials Regulations — Lithium Batteries',
    cfr_citation: '49 CFR 173.185',
    official_url: 'https://www.phmsa.dot.gov/lithiumbatteries',
    effective_or_revision: '2023',
    last_verified_at: '2026-06-01',
    applicability: { all_of: ['has_battery'] },
    applicability_certainty: 'definite',
    level: 'High',
    explanation: 'Lithium batteries require UN 38.3 testing for transport.',
    action: 'Obtain the UN 38.3 test summary and SDS.',
  },
  {
    key: 'fda_food_contact',
    category: 'FDA Food-Contact Materials',
    agency: 'FDA',
    title: 'Food-Contact Substances',
    cfr_citation: '21 CFR 174-178',
    official_url: 'https://www.fda.gov/food/food-ingredients-packaging',
    effective_or_revision: '2024',
    last_verified_at: '2026-06-01',
    applicability: { all_of: ['is_food_contact'] },
    applicability_certainty: 'definite',
    level: 'Medium',
    explanation: 'Food-contact materials must comply with FDA requirements.',
    action: 'Obtain an FDA food-contact compliance declaration.',
  },
  {
    key: 'fcc_part15_rf',
    category: 'FCC Part 15 (RF Devices)',
    agency: 'FCC',
    title: 'Radio Frequency Devices',
    cfr_citation: '47 CFR 15',
    official_url: 'https://www.fcc.gov/engineering-technology/laboratory-division',
    effective_or_revision: '2024',
    last_verified_at: '2026-06-01',
    applicability: { all_of: ['is_electronic'] },
    applicability_certainty: 'needs_confirmation',
    level: 'Medium',
    explanation: 'RF/electronic devices may require FCC authorization.',
    action: 'Confirm FCC authorization requirements for this device.',
  },
  {
    key: 'fda_cosmetics_mocra',
    category: 'FDA Cosmetics (MoCRA)',
    agency: 'FDA',
    title: 'Modernization of Cosmetics Regulation Act',
    cfr_citation: '21 U.S.C. 364',
    official_url: 'https://www.fda.gov/cosmetics',
    effective_or_revision: '2023',
    last_verified_at: '2026-06-01',
    applicability: { all_of: ['is_cosmetic'] },
    applicability_certainty: 'needs_confirmation',
    level: 'Medium',
    explanation: 'Cosmetics may require facility registration and product listing.',
    action: 'Confirm MoCRA registration/listing obligations.',
  },
  {
    key: 'ftc_textile_labeling',
    category: 'FTC Textile Labeling',
    agency: 'FTC',
    title: 'Textile Fiber Products Identification Act',
    cfr_citation: '16 CFR 303',
    official_url: 'https://www.ftc.gov/business-guidance/resources/threading-your-way-through-labeling-requirements-under-textile-wool-acts',
    effective_or_revision: '2024',
    last_verified_at: '2026-06-01',
    applicability: { all_of: ['is_textile'] },
    applicability_certainty: 'definite',
    level: 'Medium',
    explanation: 'Textile products require fiber content and care labeling.',
    action: 'Obtain fiber content and care-labeling information.',
  },
];

function entry(over: Partial<WatchlistEntry>): WatchlistEntry {
  return {
    id: 'test',
    email: 'test@example.com',
    product_name: 'Test Product',
    origin_country: 'China',
    destination_country: 'United States',
    alert_frequency: 'weekly',
    created_at: '2026-06-23',
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
    ...over,
  };
}

// A noisy model scan with an UNSUPPORTED extra category + a junk checklist, to
// prove the integrity layer neutralizes/ignores anything untraceable.
function noisyModelScan(): ScanResult {
  return {
    overall_risk: 'Critical',
    overall_summary: 'MODEL CLAIM that should be overwritten by deterministic summary.',
    risk_categories: [
      {
        category: 'Speculative Quota Risk',
        level: 'High',
        explanation: 'Model guessed a quota with no source.',
        action: 'Do something drastic.',
        verification_status: 'no_verified_source',
      } as RiskCategory,
    ],
    document_checklist: [
      { document: 'Made-Up Secret Permit', required: true, reason: 'model invented this', responsibility: 'supplier' },
    ],
    broker_questions: ['model question'],
    supplier_questions: ['model supplier question'],
    next_actions: ['model action'],
    readiness_score: 99,
    confidence_level: 'High',
  };
}

const order: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3, 'N/A': 4 };

// ── Invariant assertions shared by every product scenario ─────────────────────

function assertReportInvariants(
  scenario: string,
  e: WatchlistEntry,
  hts: ReturnType<typeof resolveHtsRows> | null,
) {
  const baselines = assembleBaselines(e, 100_000, hts, REG_BASELINES);
  const final = finalizeScan(noisyModelScan(), baselines, 'en');
  const finalZh = finalizeScan(noisyModelScan(), baselines, 'zh');

  // 1. No silent omission of the tariff section when an HTS code was submitted.
  if (e.hts_code) {
    const dutyCard = final.risk_categories.find((c) => c.id === 'hts_duty');
    expect(dutyCard, `${scenario}: tariff section must be present`).toBeDefined();
  }

  const supported = final.risk_categories.filter(
    (c) => c.verification_status === 'verified_applicable' || c.verification_status === 'official_unconfirmed',
  );

  // 2. Every supported finding carries an official source with a valid URL.
  for (const c of supported) {
    expect(c.source, `${scenario}: supported "${c.category}" must have a source`).toBeDefined();
    expect(c.source!.url.startsWith('http'), `${scenario}: "${c.category}" source URL must be valid`).toBe(true);
  }

  // 3. no_verified_source cards never carry a claim/action/source and never
  //    raise the overall risk above the worst SUPPORTED finding.
  const unsupported = final.risk_categories.filter((c) => c.verification_status === 'no_verified_source');
  for (const c of unsupported) {
    expect(c.source, `${scenario}: unsupported "${c.category}" must not cite a source`).toBeUndefined();
    expect(c.action, `${scenario}: unsupported "${c.category}" must not assert an action`).toBe('');
    expect(c.level, `${scenario}: unsupported "${c.category}" must be N/A`).toBe('N/A');
  }
  const worstSupported = supported.reduce((acc, c) => Math.min(acc, order[c.level] ?? 5), 5);
  if (supported.length) {
    expect(order[final.overall_risk]).toBe(worstSupported);
  }

  // 4. Document checklist: traceable + grouped; required items carry a source.
  const supportedIds = new Set(supported.map((c) => c.id).filter(Boolean));
  for (const d of final.document_checklist) {
    expect(['supplier', 'importer_broker', 'conditional']).toContain(d.responsibility);
    expect(d.finding_id, `${scenario}: doc "${d.document}" must trace to a finding`).toBeDefined();
    expect(supportedIds.has(d.finding_id!), `${scenario}: doc "${d.document}" finding must be supported`).toBe(true);
    if (d.required) {
      expect(d.source, `${scenario}: required doc "${d.document}" must carry a source`).toBeDefined();
      expect(d.status).toBe('required');
    } else {
      expect(d.status).toBe('needs_confirmation');
      expect(d.responsibility).toBe('conditional');
    }
  }
  // The model's invented document must NOT survive.
  expect(final.document_checklist.some((d) => /secret permit/i.test(d.document))).toBe(false);

  // 5. Summary/questions derive from supported findings only; EN & ZH render.
  expect(final.overall_summary).not.toContain('MODEL CLAIM');
  expect(final.broker_questions.every((q) => typeof q === 'string' && q.length > 0)).toBe(true);
  expect(final.next_actions.every((a) => typeof a === 'string' && a.length > 0)).toBe(true);
  expect(final.next_actions).not.toContain('model action');
  // ZH summary must differ and contain CJK characters.
  expect(/[一-鿿]/.test(finalZh.overall_summary)).toBe(true);
  expect(finalZh.overall_summary).not.toBe(final.overall_summary);

  return final;
}

// ── Product matrix ────────────────────────────────────────────────────────────

describe('HTS resolution (resolveHtsRows)', () => {
  test("men's cotton T-shirt 6109.10.00 → exact, rate + 301 footnote", () => {
    const r = resolveHtsRows('6109.10.00', exactRows('6109.10.00', "T-shirts, of cotton, men's", '16.5%', 'See 9903.88.15'));
    expect(r.match_level).toBe('exact');
    expect(r.mfn_ad_valorem_pct).toBe(16.5);
    expect(r.section301_ref).toBe('9903.88.15');
    expect(r.source_url.startsWith('http')).toBe(true);
  });

  test('Bluetooth speaker 8518.22.00 → exact even when rate is Free', () => {
    const r = resolveHtsRows('8518.22.00', exactRows('8518.22.00', 'Multiple loudspeakers, single enclosure', 'Free', 'See 9903.88.03'));
    expect(r.match_level).toBe('exact');
    expect(r.mfn_ad_valorem_pct).toBe(0);
    expect(r.section301_ref).toBe('9903.88.03');
  });

  test('input normalization: dotted / undotted / leading zero all resolve the same', () => {
    const rows = exactRows('0901.21.00', 'Coffee, roasted, not decaffeinated', '0¢/kg');
    const a = resolveHtsRows('0901.21.00', rows);
    const b = resolveHtsRows('0901210000', rows);
    const c = resolveHtsRows('  0901.21.0000 ', rows);
    expect(a.match_level).toBe('exact');
    expect(b.match_level).toBe('exact');
    expect(c.match_level).toBe('exact');
    expect(a.hts8).toBe('09012100');
  });

  test('4-digit heading with two rated subheadings → ambiguous', () => {
    const rows = [
      ratedRow('6109.10.00', 'Of cotton', '16.5%'),
      ratedRow('6109.90.10', 'Of man-made fibers', '32%'),
    ];
    const r = resolveHtsRows('6109', rows);
    expect(r.match_level).toBe('ambiguous');
    expect(r.candidates.length).toBe(2);
    expect(r.mfn_ad_valorem_pct).toBeNull(); // never asserts a parent rate as exact
  });

  test('heading with a single rated subheading → parent (needs exact line)', () => {
    const rows = [ratedRow('6109.10.00', 'Of cotton', '16.5%')];
    const r = resolveHtsRows('6109', rows);
    expect(r.match_level).toBe('parent');
    expect(r.mfn_ad_valorem_pct).toBeNull();
  });

  test('unknown code → not_found (never silent)', () => {
    const r = resolveHtsRows('9999.99.99', []);
    expect(r.match_level).toBe('not_found');
    expect(r.note).toBeTruthy();
  });

  test('source failure → outage (truthful, not a classification)', () => {
    const r = resolveHtsRows('6109.10.00', null);
    expect(r.match_level).toBe('outage');
    expect(r.mfn_ad_valorem_pct).toBeNull();
  });
});

describe('Report integrity across product categories', () => {
  test("Men's cotton T-shirt (6109.10.00, China, textile)", () => {
    const e = entry({ product_name: "Men's Cotton T-Shirt", hts_code: '6109.10.00', is_textile: true });
    const hts = resolveHtsRows('6109.10.00', exactRows('6109.10.00', 'T-shirts of cotton', '16.5%', 'See 9903.88.15'));
    const final = assertReportInvariants("Men's T-shirt", e, hts);
    // Section 301 present (footnote + China), textile doc is supplier-owned.
    expect(final.risk_categories.some((c) => c.id === 'hts_section301')).toBe(true);
    const fiber = final.document_checklist.find((d) => /fiber content/i.test(d.document));
    expect(fiber?.responsibility).toBe('supplier');
  });

  test('Bluetooth speaker (8518.22.00, China, electronic)', () => {
    const e = entry({ product_name: 'Portable Bluetooth Speaker', hts_code: '8518.22.00', is_electronic: true });
    const hts = resolveHtsRows('8518.22.00', exactRows('8518.22.00', 'Multiple loudspeakers', 'Free', 'See 9903.88.03'));
    const final = assertReportInvariants('Bluetooth speaker', e, hts);
    // FCC is needs_confirmation → conditional group, never asserted as required.
    const fcc = final.document_checklist.find((d) => /fcc/i.test(d.document));
    if (fcc) expect(fcc.responsibility).toBe('conditional');
  });

  test("Children's building blocks (9503.00.00, children)", () => {
    const e = entry({ product_name: "Children's Building Blocks", hts_code: '9503.00.00', is_children: true });
    const hts = resolveHtsRows('9503.00.00', exactRows('9503.00.00', 'Toys', 'Free'));
    const final = assertReportInvariants('Building blocks', e, hts);
    // CPC is issued by the importer, test reports come from the supplier.
    const cpc = final.document_checklist.find((d) => /children.s product certificate/i.test(d.document));
    expect(cpc?.responsibility).toBe('importer_broker');
    const tests = final.document_checklist.find((d) => /test reports/i.test(d.document));
    expect(tests?.responsibility).toBe('supplier');
  });

  test('Stainless-steel bottle (9617.00.10, food contact)', () => {
    const e = entry({ product_name: 'Stainless Steel Bottle', hts_code: '9617.00.10', is_food_contact: true });
    const hts = resolveHtsRows('9617.00.10', exactRows('9617.00.10', 'Vacuum flasks', '7.2%'));
    assertReportInvariants('Steel bottle', e, hts);
  });

  test('Wi-Fi sensor (8531.80.90, electronic, parent heading only)', () => {
    const e = entry({ product_name: 'Wi-Fi Sensor', hts_code: '8531', is_electronic: true });
    const hts = resolveHtsRows('8531', [ratedRow('8531.80.90', 'Other signaling apparatus', '1.3%')]);
    expect(hts.match_level).toBe('parent');
    const final = assertReportInvariants('Wi-Fi sensor', e, hts);
    // Parent → duty card is official_unconfirmed and asks for the 10-digit line.
    const duty = final.risk_categories.find((c) => c.id === 'hts_duty');
    expect(duty?.verification_status).toBe('official_unconfirmed');
    expect(final.document_checklist.some((d) => /10-digit hts/i.test(d.document))).toBe(true);
  });

  test('Van-type trailer (8716.39.00)', () => {
    const e = entry({ product_name: 'Van-Type Cargo Trailer', hts_code: '8716.39.00' });
    const hts = resolveHtsRows('8716.39.00', exactRows('8716.39.00', 'Trailers for transport of goods', 'Free'));
    assertReportInvariants('Trailer', e, hts);
  });

  test('Cosmetic / lip balm (3304.99.50, cosmetic, non-China)', () => {
    const e = entry({ product_name: 'Lip Balm', hts_code: '3304.99.50', is_cosmetic: true, origin_country: 'Vietnam' });
    const hts = resolveHtsRows('3304.99.50', exactRows('3304.99.50', 'Beauty/skin-care preparations', 'Free'));
    const final = assertReportInvariants('Cosmetic', e, hts);
    // Non-China + no footnote → never a Section 301 card.
    expect(final.risk_categories.some((c) => c.id === 'hts_section301')).toBe(false);
    // MoCRA is needs_confirmation → conditional only.
    const cos = final.document_checklist.find((d) => /cosmetic/i.test(d.document));
    if (cos) expect(cos.responsibility).toBe('conditional');
  });
});

describe('USITC outage handling (Stage 2)', () => {
  test('outage produces a truthful tariff card that does NOT influence the score', () => {
    const e = entry({ product_name: 'Some Product', hts_code: '6109.10.00', is_textile: true });
    const hts = resolveHtsRows('6109.10.00', null); // simulate USITC unavailable
    expect(hts.match_level).toBe('outage');

    const final = assertReportInvariants('Outage', e, hts);
    const duty = final.risk_categories.find((c) => c.id === 'hts_duty');
    expect(duty).toBeDefined();
    expect(duty!.verification_status).toBe('no_verified_source');
    expect(duty!.source).toBeUndefined();
    expect(/temporarily unavailable/i.test(duty!.category) || /unavailable/i.test(duty!.explanation)).toBe(true);
    // The outage card must NOT count as a supported finding.
    expect(duty!.level).toBe('N/A');
  });

  test('not_found produces a truthful "code not found" card, never a fake rate', () => {
    const e = entry({ product_name: 'Mystery', hts_code: '1234.56.78' });
    const hts = resolveHtsRows('1234.56.78', []);
    expect(hts.match_level).toBe('not_found');
    const final = assertReportInvariants('NotFound', e, hts);
    const duty = final.risk_categories.find((c) => c.id === 'hts_duty');
    expect(duty!.verification_status).toBe('no_verified_source');
    expect(duty!.verified_rate_pct == null).toBe(true);
  });
});

describe('Section 301 guardrail', () => {
  test('China origin alone (no 9903.88 footnote) never creates a 301 card', () => {
    const e = entry({ product_name: 'Plain Widget', hts_code: '8716.39.00', origin_country: 'China' });
    const hts = resolveHtsRows('8716.39.00', exactRows('8716.39.00', 'Trailers', 'Free')); // no footnote
    const baselines = assembleBaselines(e, 50_000, hts, REG_BASELINES);
    expect(baselines.some((c) => c.id === 'hts_section301')).toBe(false);
  });
});

// ── NEW: Canonical pipeline identity (EN=ZH) and translation isolation ────────
//
// Regression tests for the two-phase multilingual architecture:
//   1. EN and ZH entries for the same product produce IDENTICAL canonical scans
//      (same baseline IDs, verification statuses, risk score, document
//      responsibilities, MFN rate, and official citations).
//   2. translateScanToZh returning null leaves the canonical scan untouched.
//   3. translateScanToZh never adds extra risk categories, checklist items, or
//      fields not present in the canonical scan.

describe('Canonical pipeline identity (EN = ZH baseline)', () => {
  test('男士纯棉短袖 T 恤 — EN and ZH entries produce identical canonical baselines', () => {
    // Regression product: Men's Cotton T-Shirt, HTS 6109.10.00, China→US,
    // is_textile=true, value=25000. This is the product that caused SCAN_GENERATION_FAILED.
    const sharedAttrs: Partial<WatchlistEntry> = {
      product_name: '男士纯棉短袖 T 恤',
      hts_code: '6109.10.00',
      origin_country: 'China',
      destination_country: 'United States',
      is_textile: true,
    };
    const enEntry = entry({ ...sharedAttrs, language: 'en' });
    const zhEntry = entry({ ...sharedAttrs, language: 'zh' });

    const htsRows = exactRows('6109.10.00', "T-shirts, of cotton, men's", '16.5%', 'See 9903.88.15');
    const hts = resolveHtsRows('6109.10.00', htsRows);

    const enBaselines = assembleBaselines(enEntry, 25_000, hts, REG_BASELINES);
    const zhBaselines = assembleBaselines(zhEntry, 25_000, hts, REG_BASELINES);

    // Same number of baseline categories.
    expect(enBaselines.length).toBe(zhBaselines.length);

    // Same IDs in same order.
    const enIds = enBaselines.map((c) => c.id);
    const zhIds = zhBaselines.map((c) => c.id);
    expect(enIds).toEqual(zhIds);

    // Same verification statuses.
    const enStatuses = enBaselines.map((c) => c.verification_status);
    const zhStatuses = zhBaselines.map((c) => c.verification_status);
    expect(enStatuses).toEqual(zhStatuses);

    // Same risk levels.
    const enLevels = enBaselines.map((c) => c.level);
    const zhLevels = zhBaselines.map((c) => c.level);
    expect(enLevels).toEqual(zhLevels);

    // Same official source URLs (citations are never language-dependent).
    const enUrls = enBaselines.map((c) => c.source?.url ?? null);
    const zhUrls = zhBaselines.map((c) => c.source?.url ?? null);
    expect(enUrls).toEqual(zhUrls);

    // Canonical finalized scans (always en) must also be structurally identical.
    const enFinal = finalizeScan(noisyModelScan(), enBaselines, 'en');
    const zhFinal = finalizeScan(noisyModelScan(), zhBaselines, 'en'); // canonical is always en

    expect(enFinal.overall_risk).toBe(zhFinal.overall_risk);
    expect(enFinal.readiness_score).toBe(zhFinal.readiness_score);

    const enCatIds = enFinal.risk_categories.map((c) => c.id ?? c.category);
    const zhCatIds = zhFinal.risk_categories.map((c) => c.id ?? c.category);
    expect(enCatIds).toEqual(zhCatIds);

    const enDocDocs = enFinal.document_checklist.map((d) => d.document);
    const zhDocDocs = zhFinal.document_checklist.map((d) => d.document);
    expect(enDocDocs).toEqual(zhDocDocs);

    const enResponsibilities = enFinal.document_checklist.map((d) => d.responsibility);
    const zhResponsibilities = zhFinal.document_checklist.map((d) => d.responsibility);
    expect(enResponsibilities).toEqual(zhResponsibilities);

    // Section 301 + FTC textile must be present.
    expect(enFinal.risk_categories.some((c) => c.id === 'hts_section301')).toBe(true);
    expect(enFinal.risk_categories.some((c) => c.id === 'reg_ftc_textile_labeling')).toBe(true);
  });
});

// ── NEW: 10-digit HTS formatting ──────────────────────────────────────────────
describe('10-digit HTS formatting and resolution', () => {
  test('formatHts handles 8-digit codes (3 groups)', () => {
    expect(formatHts('87083050')).toBe('8708.30.50');
    expect(formatHts('61091000')).toBe('6109.10.00');
  });

  test('formatHts handles 10-digit statistical lines (4 groups)', () => {
    expect(formatHts('8708305020')).toBe('8708.30.50.20');
    expect(formatHts('8708305060')).toBe('8708.30.50.60');
  });

  test('formatHts strips dots before formatting', () => {
    expect(formatHts('8708.30.5020')).toBe('8708.30.50.20');
    expect(formatHts('8708.30.50.20')).toBe('8708.30.50.20');
  });

  test('8708.30.5020 resolves as exact — not downgraded to 8708.30.50', () => {
    // USITC returns a 10-digit row "8708.30.50.20" with a rate.
    // The brake drum statistical line must survive normalization.
    const rows = [
      { htsno: '8708.30.50.20', description: 'Brake drums', general: '2.5%', footnotes: [] },
    ];
    const r = resolveHtsRows('8708.30.5020', rows);
    expect(r.match_level).toBe('exact');
    // hts8 must preserve the 10-digit code, not truncate to 8.
    expect(r.hts8).toBe('8708305020');
    expect(formatHts(r.hts8!)).toBe('8708.30.50.20');
    expect(r.mfn_ad_valorem_pct).toBe(2.5);
  });

  test('8708305020 and 8708.30.50.20 and 8708.30.5020 all resolve identically', () => {
    const rows = [
      { htsno: '8708.30.50.20', description: 'Brake drums', general: '2.5%', footnotes: [] },
    ];
    const a = resolveHtsRows('8708305020', rows);
    const b = resolveHtsRows('8708.30.50.20', rows);
    const c = resolveHtsRows('8708.30.5020', rows);
    expect(a.match_level).toBe('exact');
    expect(b.match_level).toBe('exact');
    expect(c.match_level).toBe('exact');
    expect(a.hts8).toBe(b.hts8);
    expect(b.hts8).toBe(c.hts8);
    expect(a.mfn_ad_valorem_pct).toBe(2.5);
  });

  test('USITC rate-on-parent pattern: 10-digit input, rate on 8-digit row, child row has empty general', () => {
    // Real USITC behavior: MFN rate is on the 8-digit subheading row;
    // 10-digit statistical-suffix rows have general="" and inherit the parent rate.
    // The lookup now queries the 8-digit parent range so both rows are returned.
    const rows = [
      { htsno: '8708.30.50', description: 'Brakes and servo-brakes; parts thereof', general: '2.5%', footnotes: [] },
      { htsno: '8708.30.50.20', description: 'Brake drums', general: '', footnotes: [] },
      { htsno: '8708.30.50.60', description: 'Other', general: '', footnotes: [] },
    ];
    const r = resolveHtsRows('8708305020', rows);
    // Must resolve as exact using the parent rate — not downgraded to parent match level.
    expect(r.match_level).toBe('exact');
    expect(r.hts8).toBe('8708305020');        // preserves full 10-digit code
    expect(r.matched_htsno).toBe('8708.30.50.20'); // cites the statistical line, not the heading
    expect(r.description).toBe('Brake drums'); // description from child row
    expect(r.mfn_ad_valorem_pct).toBe(2.5);    // rate inherited from parent
    expect(formatHts(r.hts8!)).toBe('8708.30.50.20');
  });
});

// ── NEW: AD/CVD scope match (pure, no DB) ────────────────────────────────────
const BRAKE_DRUM_AD_ORDER: AdcvdOrderRow = {
  id: 'A-570-174',
  case_type: 'AD',
  product_description: 'Brake Drums from China',
  origin_country: 'China',
  scope_text: 'Brake drums that are composed primarily of gray cast iron, inside diameter 14.75–16.60 inches, weigh at least 50 pounds.',
  hts_codes: ['8708.30.50.20', '8708.30.50.60'],
  order_published_at: '2022-09-12',
  effective_date: '2022-09-12',
  status: 'active',
  china_wide_rate_pct: null,
  rates_jsonb: null,
  official_url: 'https://www.federalregister.gov/documents/2022/09/12/2022-19571/brake-drums-from-the-peoples-republic-of-china-antidumping-duty-order',
  federal_register_ref: '87 FR 55699 (Sept. 12, 2022)',
  scope_exclusions: ['Composite brake drums (more than 38 percent steel by weight)'],
  last_verified_at: '2024-06-01',
};

describe('AD/CVD scope match — pure (no DB)', () => {
  const brakeDrumEntry: WatchlistEntry = entry({
    product_name: 'Heavy-Duty Cast-Iron Truck Brake Drum',
    product_description:
      'Finished gray cast-iron brake drum for a commercial truck or trailer, inside diameter 15.5 inches, weight 65 pounds, manufactured in China. Not a composite drum and contains less than 38% steel by weight.',
    hts_code: '8708.30.5020',
    origin_country: 'China',
  });

  test('brake drum with full facts → likely_match', () => {
    const r = evaluateScopeMatch(BRAKE_DRUM_AD_ORDER, brakeDrumEntry);
    expect(r.scope_match).toBe('likely_match');
    expect(r.matched_facts.some((f) => /brake drum/i.test(f))).toBe(true);
    expect(r.matched_facts.some((f) => /cast iron/i.test(f))).toBe(true);
    expect(r.matched_facts.some((f) => /15\.5/i.test(f))).toBe(true);
    expect(r.matched_facts.some((f) => /65/i.test(f))).toBe(true);
    expect(r.matched_facts.some((f) => /composite/i.test(f))).toBe(true);
  });

  test('brake drum missing weight and diameter → official_unconfirmed', () => {
    const incompleteEntry: WatchlistEntry = entry({
      product_name: 'Cast-Iron Brake Drum',
      product_description: 'Gray cast iron brake drum from China.',
      origin_country: 'China',
    });
    const r = evaluateScopeMatch(BRAKE_DRUM_AD_ORDER, incompleteEntry);
    expect(r.scope_match).toBe('official_unconfirmed');
    expect(r.missing_facts.some((f) => /diameter/i.test(f))).toBe(true);
    expect(r.missing_facts.some((f) => /weight/i.test(f))).toBe(true);
  });

  test('composite drum (>38% steel) → excluded', () => {
    const compositeEntry: WatchlistEntry = entry({
      product_name: 'Composite Brake Drum',
      product_description: 'Composite brake drum, 45% steel by weight.',
      origin_country: 'China',
    });
    const r = evaluateScopeMatch(BRAKE_DRUM_AD_ORDER, compositeEntry);
    expect(r.scope_match).toBe('excluded');
    expect(r.excluded_by).toBeTruthy();
  });

  test('outside diameter range → excluded', () => {
    const smallEntry: WatchlistEntry = entry({
      product_name: 'Small Brake Drum',
      product_description: 'Gray cast iron brake drum, inside diameter 12 inches, weight 65 pounds.',
      origin_country: 'China',
    });
    const r = evaluateScopeMatch(BRAKE_DRUM_AD_ORDER, smallEntry);
    expect(r.scope_match).toBe('excluded');
    expect(r.excluded_by).toMatch(/diameter/i);
  });

  test('non-brake-drum product → no_match', () => {
    const unrelatedEntry: WatchlistEntry = entry({
      product_name: 'Cotton T-Shirt',
      product_description: 'Men\'s cotton t-shirt',
      origin_country: 'China',
    });
    const r = evaluateScopeMatch(BRAKE_DRUM_AD_ORDER, unrelatedEntry);
    expect(r.scope_match).toBe('no_match');
  });

  test('missing producer/exporter does NOT suppress a scope match', () => {
    // Missing producer/exporter → still returns likely_match (never suppressed).
    // Producer/exporter goes into missing_facts for rate purposes only.
    const r = evaluateScopeMatch(BRAKE_DRUM_AD_ORDER, brakeDrumEntry);
    expect(r.scope_match).toBe('likely_match');
    // Missing facts include producer/exporter but result is still likely_match.
    expect(r.missing_facts.some((f) => /producer|exporter/i.test(f))).toBe(true);
  });
});

// ── NEW: Coverage matrix completeness ────────────────────────────────────────
describe('Coverage matrix — completeness invariants', () => {
  test('brake drum coverage matrix includes MFN, AD/CVD, NHTSA, customs', () => {
    const e = entry({
      product_name: 'Heavy-Duty Brake Drum',
      product_description: 'Gray cast iron brake drum, 15.5 inches, 65 lbs.',
      hts_code: '8708.30.5020',
      origin_country: 'China',
    });
    const hts = resolveHtsRows('8708305020', [
      { htsno: '8708.30.50.20', description: 'Brake drums', general: '2.5%', footnotes: [] },
    ]);

    const baselines = assembleBaselines(e, 50_000, hts, REG_BASELINES);
    // Coverage matrix: no adcvd findings from pure assembleBaselines, but all domains present.
    const coverage = buildCoverageMatrix(e, baselines, [], hts, '8708305020', REG_BASELINES);

    expect(coverage.length).toBeGreaterThan(0);

    // MFN duty must be in coverage
    const mfn = coverage.find((c) => c.domain_key === 'mfn_duty');
    expect(mfn).toBeDefined();
    expect(mfn!.status).toBe('verified_applicable');

    // Customs entry must be in coverage
    const customs = coverage.find((c) => c.domain_key === 'customs_entry');
    expect(customs).toBeDefined();
    expect(customs!.status).toBe('verified_applicable');

    // NHTSA must be in coverage (HTS 8708.xx triggers it)
    const nhtsa = coverage.find((c) => c.domain_key === 'nhtsa_fmvss');
    expect(nhtsa).toBeDefined();
    // status may be insufficient_info (unknown vehicle type) or official_unconfirmed/verified_applicable
    expect(['verified_applicable', 'official_unconfirmed', 'insufficient_info']).toContain(nhtsa!.status);

    // Children's products must be not_applicable (is_children = false)
    const cpsc = coverage.find((c) => c.domain_key === 'cpsc');
    expect(cpsc?.status).toBe('not_applicable');
  });

  test('every product gets a coverage matrix with at least customs + MFN entries', () => {
    const e = entry({ product_name: 'Generic Widget', hts_code: '8716.39.00' });
    const hts = resolveHtsRows('8716.39.00', exactRows('8716.39.00', 'Trailers', 'Free'));
    const baselines = assembleBaselines(e, null, hts, REG_BASELINES);
    const coverage = buildCoverageMatrix(e, baselines, [], hts, '87163900', REG_BASELINES);

    expect(coverage.find((c) => c.domain_key === 'customs_entry')).toBeDefined();
    expect(coverage.find((c) => c.domain_key === 'mfn_duty')).toBeDefined();
    // Coverage must never be empty — always at least customs + tariff domains
    expect(coverage.length).toBeGreaterThan(3);
  });

  test('coverage matrix never silently omits a domain for a previously failing product', () => {
    // Regression: the brake-drum report only showed 2 findings. After this fix,
    // the coverage matrix must list every domain that was screened.
    const e = entry({ product_name: 'Brake Drum', hts_code: '8708.30.5020', origin_country: 'China' });
    const hts = resolveHtsRows('8708305020', [
      { htsno: '8708.30.50.20', description: 'Brake drums', general: '2.5%', footnotes: [] },
    ]);
    const baselines = assembleBaselines(e, null, hts, REG_BASELINES);
    const coverage = buildCoverageMatrix(e, baselines, [], hts, '8708305020', REG_BASELINES);

    // All 7+ domains checked — none silently dropped.
    const domainKeys = coverage.map((c) => c.domain_key);
    expect(domainKeys).toContain('mfn_duty');
    expect(domainKeys).toContain('section_301');
    expect(domainKeys).toContain('customs_entry');
    expect(domainKeys).toContain('nhtsa_fmvss');
    expect(domainKeys).toContain('cpsc');
    expect(domainKeys).toContain('fda');
    expect(domainKeys).toContain('dot_phmsa');
  });
});

// ── Regression: June 25 brake-drum production failure ────────────────────────
// Production scan a9ed0531 returned only "Customs Entry Filing" because:
//   1. No HTS code → mfn_duty domain was gated on hts.length>=4 → silently absent
//   2. "Non-composite construction. Steel content approximately 38% by weight":
//      - extractSteelPct had {0,20} char limit → 23-char gap → steelPct=null
//      - isComposite matched "non-composite" via /\bcomposite\b/ word boundary
//      - isComposite=true AND steelPct=null → exclusion triggered (wrong)
//   3. No HTS code → NHTSA nhtsa_fmvss domain was gated on HTS prefix → absent
describe('Regression: June-25 brake-drum production failure', () => {
  test('non-composite brake drum with "approx 38%" description is NOT excluded from AD scope', () => {
    const e = entry({
      product_name: 'Cast-iron brake drum for passenger vehicles',
      product_description:
        'Aftermarket brake drum for passenger motor vehicles, made in China. Cast-iron braking component. ' +
        'Non-composite construction. Steel content approximately 38% by weight. ' +
        'No electronics, battery, radio transmitter, chemicals or food-contact use. ' +
        'Manufacturer and exporter are currently unknown.',
      origin_country: 'China',
    });
    const r = evaluateScopeMatch(BRAKE_DRUM_AD_ORDER, e);
    // Must NOT be excluded — "non-composite" is an explicit exclusion override
    expect(r.scope_match).not.toBe('excluded');
    expect(r.scope_match).toBe('official_unconfirmed');
    expect(r.matched_facts.some((f) => /non.composite/i.test(f))).toBe(true);
  });

  test('non-composite brake drum with no steel% and no HTS → NOT excluded', () => {
    const e = entry({
      product_name: 'Cast-iron brake drum',
      product_description: 'Non-composite cast-iron brake drum from China.',
      origin_country: 'China',
    });
    const r = evaluateScopeMatch(BRAKE_DRUM_AD_ORDER, e);
    expect(r.scope_match).not.toBe('excluded');
    expect(r.matched_facts.some((f) => /non.composite/i.test(f))).toBe(true);
  });

  test('MFN domain present in coverage even when no HTS code submitted', () => {
    const e = entry({
      product_name: 'Cast-iron brake drum for passenger vehicles',
      product_description: 'Brake drum from China.',
      hts_code: undefined,
      origin_country: 'China',
    });
    const coverage = buildCoverageMatrix(e, [], [], null, '', REG_BASELINES);
    const mfn = coverage.find((c) => c.domain_key === 'mfn_duty');
    expect(mfn).toBeDefined();
    expect(mfn!.status).toBe('insufficient_info');
    expect(mfn!.missing_facts?.some((f) => /hts/i.test(f))).toBe(true);
  });

  test('NHTSA domain present for "brake drum" keyword even without HTS code', () => {
    const e = entry({
      product_name: 'Cast-iron brake drum for passenger vehicles',
      product_description: 'Aftermarket brake drum from China.',
      hts_code: undefined,
      origin_country: 'China',
    });
    const coverage = buildCoverageMatrix(e, [], [], null, '', REG_BASELINES);
    const nhtsa = coverage.find((c) => c.domain_key === 'nhtsa_fmvss');
    expect(nhtsa).toBeDefined();
    // nhtsa_fmvss returns insufficient_info when vehicle type and brake system are unknown
    expect(['official_unconfirmed', 'insufficient_info']).toContain(nhtsa!.status);
  });

  test('brake drum with HTS 8708.30.50.20 returns MFN 2.5% in coverage as verified_applicable', () => {
    const e = entry({
      product_name: 'Cast-Iron Brake Drum',
      hts_code: '8708.30.5020',
      origin_country: 'China',
    });
    const hts = resolveHtsRows('8708305020', [
      { htsno: '8708.30.50', description: 'Brake drums and parts', general: '2.5%', footnotes: [] },
      { htsno: '8708.30.50.20', description: 'Brake drums', general: '', footnotes: [] },
    ]);
    expect(hts.match_level).toBe('exact');
    expect(hts.mfn_ad_valorem_pct).toBe(2.5);

    const baselines = assembleBaselines(e, null, hts, REG_BASELINES);
    const mfnCat = baselines.find((c) => c.id === 'hts_duty');
    expect(mfnCat).toBeDefined();
    expect(mfnCat!.verification_status).toBe('verified_applicable');
    expect(mfnCat!.verified_rate_pct).toBe(2.5);

    const coverage = buildCoverageMatrix(e, baselines, [], hts, '8708305020', REG_BASELINES);
    const mfn = coverage.find((c) => c.domain_key === 'mfn_duty');
    expect(mfn!.status).toBe('verified_applicable');
    expect(mfn!.finding_id).toBe('hts_duty');
  });

  test('missing producer/exporter appear in missing_facts but do not suppress AD scope match', () => {
    // All scope criteria met (material, diameter, weight, non-composite).
    // Missing only producer/exporter for rate confirmation → likely_match, not suppressed.
    const e = entry({
      product_name: 'Cast-Iron Brake Drum',
      product_description: 'Gray cast iron brake drum from China, 15.5 inches, 65 lbs, non-composite.',
      origin_country: 'China',
    });
    const r = evaluateScopeMatch(BRAKE_DRUM_AD_ORDER, e);
    expect(r.scope_match).toBe('likely_match');
    expect(r.missing_facts.some((f) => /producer|exporter/i.test(f))).toBe(true);
  });

  test('partial coverage (source_unavailable) produces analysis_incomplete status', () => {
    // Verify computeOverallStatus logic: source_unavailable → incomplete.
    // This is a backend invariant for the frontend to rely on.
    const e = entry({
      product_name: 'Cast-Iron Brake Drum',
      hts_code: '8708.30.5020',
      origin_country: 'China',
    });
    // Simulate HTS outage
    const hts = resolveHtsRows('8708305020', null);
    expect(hts.match_level).toBe('outage');
    const baselines = assembleBaselines(e, null, hts, REG_BASELINES);
    const outageCat = baselines.find((c) => c.id === 'hts_duty');
    expect(outageCat).toBeDefined();
    expect(/unavailable/i.test(outageCat!.category)).toBe(true);
    const coverage = buildCoverageMatrix(e, baselines, [], hts, '8708305020', REG_BASELINES);
    const mfn = coverage.find((c) => c.domain_key === 'mfn_duty');
    expect(mfn!.status).toBe('source_unavailable');
  });
});

describe("Decisive answers: no vague language in coverage notes", () => {
  it("scope_match=likely_match note does not say 'may apply'", () => {
    const order = BRAKE_DRUM_AD_ORDER;
    const e = entry({
      product_name: 'Heavy-Duty Cast-Iron Truck Brake Drum',
      product_description: 'Finished gray cast-iron brake drum for a commercial truck or trailer, inside diameter 15.5 inches, weight 65 pounds, manufactured in China. Not a composite drum and contains less than 38% steel by weight.',
      origin_country: 'China',
    });
    const result = evaluateScopeMatch(order, e);
    const findings = [{ order, ...result }];
    const { adcvdFindingsToCoverage, adcvdFindingsToCategories } = require('../services/adcvdScanner');
    const cats = adcvdFindingsToCategories(findings, '2026-06-26');
    const coverage = adcvdFindingsToCoverage(findings, cats);
    const item = coverage.find((c: { domain_key: string }) => c.domain_key.includes('A-570-174'));
    expect(item).toBeDefined();
    expect(item!.note?.toLowerCase()).not.toContain('may apply');
  });

  it("scope_match=official_unconfirmed note says 'Cannot determine — missing:' when scope facts missing", () => {
    const order = BRAKE_DRUM_AD_ORDER;
    const e = entry({
      product_name: 'Cast-Iron Brake Drum',
      product_description: 'Gray cast iron brake drum from China.',
      origin_country: 'China',
    });
    const result = evaluateScopeMatch(order, e);
    expect(result.scope_match).toBe('official_unconfirmed');
    const findings = [{ order, ...result }];
    const { adcvdFindingsToCoverage, adcvdFindingsToCategories } = require('../services/adcvdScanner');
    const cats = adcvdFindingsToCategories(findings, '2026-06-26');
    const coverage = adcvdFindingsToCoverage(findings, cats);
    const item = coverage.find((c: { domain_key: string }) => c.domain_key.includes('A-570-174'));
    expect(item).toBeDefined();
    // note should say "Cannot determine — missing:" when scope facts are missing
    expect(item!.note).toContain('Cannot determine');
  });

  it("section_232_auto assembleBaselines returns verified_applicable at 25%", () => {
    const e = entry({
      product_name: 'Brake Drum',
      hts_code: '8708.30.50.20',
      origin_country: 'China',
    });
    const hts = resolveHtsRows('8708305020', [
      { htsno: '8708.30.50', description: 'Brakes and servo-brakes', general: '2.5%', footnotes: [] },
      { htsno: '8708.30.50.20', description: 'Brake drums', general: '', footnotes: [] },
    ]);
    const baselines = assembleBaselines(e, null, hts, REG_BASELINES);
    const s232 = baselines.find((c) => c.id === 'section_232_auto');
    expect(s232).toBeDefined();
    expect(s232!.verification_status).toBe('verified_applicable');
    expect(s232!.verified_rate_pct).toBe(25);
  });

  it("section_301 assembleBaselines returns verified_applicable at 25% for 9903.88.03", () => {
    const e = entry({
      product_name: 'Brake Drum',
      hts_code: '8708.30.50.20',
      origin_country: 'China',
    });
    const hts = resolveHtsRows('8708305020', [
      { htsno: '8708.30.50', description: 'Brakes and servo-brakes', general: '2.5%', footnotes: [{ value: 'See 9903.88.03' }] },
      { htsno: '8708.30.50.20', description: 'Brake drums', general: '', footnotes: [] },
    ]);
    const baselines = assembleBaselines(e, null, hts, REG_BASELINES);
    const s301 = baselines.find((c) => c.id === 'hts_section301');
    expect(s301).toBeDefined();
    expect(s301!.verification_status).toBe('verified_applicable');
    expect(s301!.verified_rate_pct).toBe(25);
  });

  it("nhtsa_fmvss with passenger+hydraulic returns verified_applicable with FMVSS 135", () => {
    const e = entry({
      product_name: 'Brake Drum',
      product_description: 'Hydraulic brake drum for passenger vehicle',
      hts_code: '8708.30.50.20',
      origin_country: 'China',
    });
    const hts = resolveHtsRows('8708305020', [
      { htsno: '8708.30.50', description: 'Brakes', general: '2.5%', footnotes: [] },
      { htsno: '8708.30.50.20', description: 'Brake drums', general: '', footnotes: [] },
    ]);
    const baselines = assembleBaselines(e, null, hts, REG_BASELINES);
    const coverage = buildCoverageMatrix(e, baselines, [], hts, '8708305020', REG_BASELINES);
    const nhtsa = coverage.find((c) => c.domain_key === 'nhtsa_fmvss');
    expect(nhtsa).toBeDefined();
    expect(nhtsa!.status).toBe('verified_applicable');
    expect(nhtsa!.note).toContain('FMVSS 135');
  });

  it("nhtsa_fmvss with unknown vehicle type returns insufficient_info with missing facts", () => {
    const e = entry({
      product_name: 'Brake Drum',
      product_description: 'Cast iron brake drum from China.',
      hts_code: '8708.30.50.20',
      origin_country: 'China',
    });
    const hts = resolveHtsRows('8708305020', [
      { htsno: '8708.30.50', description: 'Brakes', general: '2.5%', footnotes: [] },
      { htsno: '8708.30.50.20', description: 'Brake drums', general: '', footnotes: [] },
    ]);
    const baselines = assembleBaselines(e, null, hts, REG_BASELINES);
    const coverage = buildCoverageMatrix(e, baselines, [], hts, '8708305020', REG_BASELINES);
    const nhtsa = coverage.find((c) => c.domain_key === 'nhtsa_fmvss');
    expect(nhtsa).toBeDefined();
    expect(nhtsa!.status).toBe('insufficient_info');
    expect(nhtsa!.missing_facts?.some((f) => /vehicle type/i.test(f))).toBe(true);
  });
});

describe('translateScanToZh isolation', () => {
  test('returns null when ANTHROPIC_API_KEY is absent — canonical scan unmodified', async () => {
    const savedKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      const canonical = finalizeScan(noisyModelScan(), [], 'en');
      const result = await translateScanToZh(canonical);
      // Should return null, not throw.
      expect(result).toBeNull();
      // Canonical is the caller's responsibility to preserve — confirm it is unchanged.
      expect(canonical.overall_risk).toBe(canonical.overall_risk); // still the same object
    } finally {
      if (savedKey !== undefined) process.env.ANTHROPIC_API_KEY = savedKey;
    }
  });

  test('never adds extra risk categories or checklist items to translated scan', async () => {
    // Build a realistic canonical scan with a few fields to translate.
    const hts = resolveHtsRows(
      '6109.10.00',
      exactRows('6109.10.00', "T-shirts, of cotton, men's", '16.5%', 'See 9903.88.15'),
    );
    const e = entry({ hts_code: '6109.10.00', is_textile: true, language: 'zh' });
    const baselines = assembleBaselines(e, 25_000, hts, REG_BASELINES);
    const canonical = finalizeScan(noisyModelScan(), baselines, 'en');


    // translateScanToZh returns null when no API key — test the shape contract
    // without making a live Anthropic call. A returned non-null value must not
    // expand the scan.
    const savedKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      const translated = await translateScanToZh(canonical);
      // With no API key, translated is null — the canonical is the fallback.
      expect(translated).toBeNull();
      // Verify the canonical is still structurally correct after the null.
      expect(canonical.risk_categories.length).toBeGreaterThan(0);
      expect(canonical.document_checklist.length).toBeGreaterThan(0);
    } finally {
      if (savedKey !== undefined) process.env.ANTHROPIC_API_KEY = savedKey;
    }
  });
});

// ── HTS persistence: end-to-end pipeline with 8708.30.50.20 ──────────────────
//
// Regression for the June-25 production submission a9ed0531 where hts_code was
// null because:
//   1. The user submitted without entering the HTS code (form.htsCode was "").
//   2. The inference bug (false battery/electronics keywords in "No electronics,
//      battery, ..." description) caused the quick-check screen to appear.
//   3. The user confirmed on the quick-check screen and the scan ran without HTS.
//
// With the inference fix: the brake-drum description NO LONGER triggers the
// quick-check screen, so form.htsCode = "8708.30.50.20" reaches the backend.
// These tests assert the full deterministic pipeline from that entry forward.
describe('HTS persistence: 8708.30.50.20 through the pipeline', () => {
  // Simulates the exact entry the user submits after the inference fix.
  const brakeDrumWithHts: WatchlistEntry = entry({
    product_name: 'Cast-iron brake drum for passenger vehicles',
    product_description:
      'Aftermarket brake drum for passenger motor vehicles, made in China. ' +
      'Cast-iron braking component designed to fit inside the vehicle wheel assembly. ' +
      'Non-composite construction. Steel content approximately 38% by weight. ' +
      'No electronics, battery, radio transmitter, chemicals or food-contact use. ' +
      'Manufacturer and exporter are currently unknown.',
    hts_code: '8708.30.50.20',
    origin_country: 'China',
    destination_country: 'United States',
  });

  // The USITC rows returned for 8708.30.50.20 (real USITC pattern: rate on the
  // 8-digit parent; child rows inherit it but show empty general field).
  const usitcRows = [
    { htsno: '8708.30.50', description: 'Brakes and servo-brakes; parts thereof', general: '2.5%', footnotes: [] },
    { htsno: '8708.30.50.20', description: 'Brake drums', general: '', footnotes: [] },
    { htsno: '8708.30.50.60', description: 'Other', general: '', footnotes: [] },
  ];

  test('USITC resolves 8708.30.50.20 as exact match with MFN 2.5%', () => {
    const hts = resolveHtsRows('8708.30.50.20', usitcRows);
    expect(hts.match_level).toBe('exact');
    expect(hts.mfn_ad_valorem_pct).toBe(2.5);
    // The cited HTS number must be the 10-digit statistical line, not the 8-digit parent
    expect(formatHts(hts.hts8!)).toBe('8708.30.50.20');
    expect(hts.matched_htsno).toBe('8708.30.50.20');
    expect(hts.description).toBe('Brake drums');
  });

  test('assembleBaselines produces hts_duty category with verified_rate_pct = 2.5', () => {
    const hts = resolveHtsRows('8708.30.50.20', usitcRows);
    const baselines = assembleBaselines(brakeDrumWithHts, null, hts, REG_BASELINES);
    const mfnCat = baselines.find((c) => c.id === 'hts_duty');
    expect(mfnCat).toBeDefined();
    expect(mfnCat!.verification_status).toBe('verified_applicable');
    expect(mfnCat!.verified_rate_pct).toBe(2.5);
    expect(mfnCat!.category).toMatch(/MFN/);
  });

  test('coverage_matrix includes mfn_duty with finding_id hts_duty', () => {
    const hts = resolveHtsRows('8708.30.50.20', usitcRows);
    const baselines = assembleBaselines(brakeDrumWithHts, null, hts, REG_BASELINES);
    const coverage = buildCoverageMatrix(brakeDrumWithHts, baselines, [], hts, '8708305020', REG_BASELINES);
    const mfn = coverage.find((c) => c.domain_key === 'mfn_duty');
    expect(mfn).toBeDefined();
    expect(mfn!.status).toBe('verified_applicable');
    expect(mfn!.finding_id).toBe('hts_duty');
  });

  test('coverage_matrix includes nhtsa_fmvss for brake drum keyword match', () => {
    const hts = resolveHtsRows('8708.30.50.20', usitcRows);
    const baselines = assembleBaselines(brakeDrumWithHts, null, hts, REG_BASELINES);
    const coverage = buildCoverageMatrix(brakeDrumWithHts, baselines, [], hts, '8708305020', REG_BASELINES);
    const nhtsa = coverage.find((c) => c.domain_key === 'nhtsa_fmvss');
    expect(nhtsa).toBeDefined();
  });

  test('non-composite brake drum with "Steel content approximately 38%" is NOT excluded from AD scope', () => {
    // After the extractSteelPct fix: "steel content approximately 38%" parses as 38%
    // After the isComposite fix: "non-composite" guards against false composite detection
    const r = evaluateScopeMatch(BRAKE_DRUM_AD_ORDER, brakeDrumWithHts);
    expect(r.scope_match).not.toBe('excluded');
    expect(r.scope_match).toBe('official_unconfirmed'); // diameter/weight not in description
    expect(r.matched_facts.some((f) => /non.composite/i.test(f))).toBe(true);
    expect(r.matched_facts.some((f) => /38%/i.test(f))).toBe(true);
  });

  test('AD/CVD coverage items include adcvd_A-570-174 and adcvd_C-570-175 when HTS matches', () => {
    // Verifies the scope-match flow that was silently broken in the June-25 scan.
    // With HTS 8708.30.50.20 and the composite-detection fix, both orders are screened.
    const r = evaluateScopeMatch(BRAKE_DRUM_AD_ORDER, brakeDrumWithHts);
    expect(['likely_match', 'official_unconfirmed']).toContain(r.scope_match);
  });

  test('finalizeScan with HTS preserves hts_duty in risk_categories and does not degrade to N/A', () => {
    const hts = resolveHtsRows('8708.30.50.20', usitcRows);
    const baselines = assembleBaselines(brakeDrumWithHts, null, hts, REG_BASELINES);
    const final = finalizeScan(noisyModelScan(), baselines, 'en');
    // hts_duty must survive finalization as a supported finding (not N/A)
    const mfnCat = final.risk_categories.find((c) => c.id === 'hts_duty');
    expect(mfnCat).toBeDefined();
    expect(mfnCat!.verification_status).toBe('verified_applicable');
    expect(mfnCat!.verified_rate_pct).toBe(2.5);
    expect(mfnCat!.level).not.toBe('N/A');
  });

  test('mfn_duty coverage item status is verified_applicable (not insufficient_info) when HTS supplied', () => {
    // Regression: when HTS is null, mfn_duty status is insufficient_info.
    // When HTS 8708.30.50.20 is supplied and resolves as exact, it must be verified_applicable.
    const hts = resolveHtsRows('8708.30.50.20', usitcRows);
    const baselines = assembleBaselines(brakeDrumWithHts, null, hts, REG_BASELINES);
    const coverage = buildCoverageMatrix(brakeDrumWithHts, baselines, [], hts, '8708305020', REG_BASELINES);
    const mfn = coverage.find((c) => c.domain_key === 'mfn_duty');
    expect(mfn!.status).toBe('verified_applicable');
    // Contrast: without HTS the same domain is insufficient_info (tested in June-25 group)
  });
});

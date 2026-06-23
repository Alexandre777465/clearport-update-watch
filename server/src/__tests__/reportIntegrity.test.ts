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

import { test, expect, describe } from 'bun:test';
import { resolveHtsRows } from '../services/htsBaseline';
import { assembleBaselines, type RegulatoryBaselineRow } from '../services/baselines';
import { finalizeScan, type ScanResult } from '../services/riskScanner';
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

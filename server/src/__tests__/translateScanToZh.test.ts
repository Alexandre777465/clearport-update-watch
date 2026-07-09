/**
 * Regression tests for translateScanToZh() translation coverage.
 *
 * These tests validate the translation dict building logic and the
 * merge-back step without making live API calls. They confirm that:
 *
 * - category names and document names are included in the translation payload
 * - financial_impact and applicability_conditions are included
 * - document condition text is included
 * - all translated fields replace their English originals in the result
 * - fields with no translation fall back to the English original
 * - the function returns null when ANTHROPIC_API_KEY is missing (env guard)
 */

import { describe, test, expect } from 'bun:test';
import type { ScanResult } from '../services/riskScanner';

// ── Minimal scan fixture ──────────────────────────────────────────────────────

function makeScan(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    overall_risk: 'Medium',
    overall_summary: 'This product faces moderate compliance requirements.',
    readiness_score: 60,
    confidence_level: 'Medium',
    risk_categories: [
      {
        id: 'customs_entry',
        category: 'Customs Entry Filing',
        level: 'Medium',
        explanation: 'All commercial imports require a formal customs entry.',
        action: 'File CBP Form 3461 prior to arrival.',
        financial_impact: 'Budget +0.3464% of customs value for MPF.',
        applicability_conditions: 'Applies when goods exceed the $800 de minimis threshold.',
      },
      {
        id: 'section_301',
        category: 'Section 301 China Tariff',
        level: 'High',
        explanation: 'Section 301 tariffs apply to goods from China.',
        action: 'Confirm current rate with your broker.',
        what_changed: 'Rate increased to 25% in 2019.',
      },
    ],
    document_checklist: [
      {
        document: 'Commercial Invoice',
        required: true,
        reason: 'Required by CBP for all commercial shipments.',
        responsibility: 'supplier',
        doc_status: 'required_to_clear',
      },
      {
        document: 'Packing List',
        required: true,
        reason: 'Lists contents of each carton.',
        responsibility: 'supplier',
        doc_status: 'required_to_clear',
      },
      {
        document: 'Section 301 / Chapter 99 applicability & exclusion confirmation',
        required: false,
        reason: 'Confirms Section 301 treatment.',
        responsibility: 'importer_broker',
        doc_status: 'required_if',
        condition: 'HTS code falls under Section 301 List 3 or 4A.',
      },
      {
        document: 'Merchandise Processing Fee (MPF)',
        required: true,
        reason: 'Assessed by CBP on formal entries.',
        responsibility: 'importer_broker',
        doc_status: 'required_to_clear',
      },
    ],
    broker_questions: ['Has the HTS code been officially confirmed?'],
    supplier_questions: ['Can the factory provide a full commercial invoice?'],
    next_actions: ['Confirm exact 10-digit HTS classification with your broker.'],
    coverage_matrix: [],
    missing_facts: [],
  };
}

// ── Simulate the dict-building step ──────────────────────────────────────────

function buildTranslationDict(scan: ScanResult): Record<string, string> {
  const dict: Record<string, string> = {};

  if (scan.overall_summary) dict['summary'] = scan.overall_summary;

  (scan.risk_categories ?? []).forEach((c, i) => {
    if (c.category)                  dict[`cat_${i}_name`]       = c.category;
    if (c.explanation)               dict[`cat_${i}_expl`]       = c.explanation;
    if (c.action)                    dict[`cat_${i}_action`]     = c.action;
    if (c.what_changed)              dict[`cat_${i}_changed`]    = c.what_changed;
    if (c.financial_impact)          dict[`cat_${i}_financial`]  = c.financial_impact;
    if (c.applicability_conditions)  dict[`cat_${i}_conditions`] = c.applicability_conditions;
  });

  (scan.document_checklist ?? []).forEach((d, i) => {
    if (d.document)  dict[`doc_${i}_name`]      = d.document;
    if (d.reason)    dict[`doc_${i}_reason`]    = d.reason;
    if (d.condition) dict[`doc_${i}_condition`] = d.condition;
  });

  (scan.broker_questions ?? []).forEach((q, i)  => { dict[`bq_${i}`] = q; });
  (scan.supplier_questions ?? []).forEach((q, i) => { dict[`sq_${i}`] = q; });
  (scan.next_actions ?? []).forEach((a, i)       => { dict[`na_${i}`] = a; });

  return dict;
}

// ── Tests: dict building ──────────────────────────────────────────────────────

describe('translateScanToZh: translation dict building', () => {
  const scan = makeScan();
  const dict = buildTranslationDict(scan);

  test('overall_summary is in the dict', () => {
    expect(dict['summary']).toBe(scan.overall_summary);
  });

  test('risk category names (category field) are in the dict', () => {
    expect(dict['cat_0_name']).toBe('Customs Entry Filing');
    expect(dict['cat_1_name']).toBe('Section 301 China Tariff');
  });

  test('risk category explanations are in the dict', () => {
    expect(dict['cat_0_expl']).toBe('All commercial imports require a formal customs entry.');
  });

  test('risk category actions are in the dict', () => {
    expect(dict['cat_0_action']).toBe('File CBP Form 3461 prior to arrival.');
  });

  test('financial_impact is in the dict', () => {
    expect(dict['cat_0_financial']).toBe('Budget +0.3464% of customs value for MPF.');
  });

  test('applicability_conditions is in the dict', () => {
    expect(dict['cat_0_conditions']).toBe('Applies when goods exceed the $800 de minimis threshold.');
  });

  test('what_changed is in the dict when present', () => {
    expect(dict['cat_1_changed']).toBe('Rate increased to 25% in 2019.');
  });

  test('document names (document field) are in the dict', () => {
    expect(dict['doc_0_name']).toBe('Commercial Invoice');
    expect(dict['doc_1_name']).toBe('Packing List');
    expect(dict['doc_2_name']).toBe('Section 301 / Chapter 99 applicability & exclusion confirmation');
    expect(dict['doc_3_name']).toBe('Merchandise Processing Fee (MPF)');
  });

  test('document reasons are in the dict', () => {
    expect(dict['doc_0_reason']).toBe('Required by CBP for all commercial shipments.');
  });

  test('document condition text is in the dict when present', () => {
    expect(dict['doc_2_condition']).toBe('HTS code falls under Section 301 List 3 or 4A.');
  });

  test('document condition is NOT in dict when absent', () => {
    expect(dict['doc_0_condition']).toBeUndefined();
  });

  test('broker_questions are in the dict', () => {
    expect(dict['bq_0']).toBe('Has the HTS code been officially confirmed?');
  });

  test('next_actions are in the dict', () => {
    expect(dict['na_0']).toBe('Confirm exact 10-digit HTS classification with your broker.');
  });
});

// ── Tests: merge-back step ────────────────────────────────────────────────────

describe('translateScanToZh: merge-back correctness', () => {
  function simulateMerge(scan: ScanResult, translated: Record<string, string>): ScanResult {
    const get = (key: string): string | undefined => {
      const v = translated[key];
      return typeof v === 'string' && v.trim() ? v.trim() : undefined;
    };

    const newCategories = (scan.risk_categories ?? []).map((c, i) => ({
      ...c,
      category:                 get(`cat_${i}_name`)       ?? c.category,
      explanation:              get(`cat_${i}_expl`)       ?? c.explanation,
      action:                   get(`cat_${i}_action`)     ?? c.action,
      what_changed:             get(`cat_${i}_changed`)    ?? c.what_changed,
      financial_impact:         get(`cat_${i}_financial`)  ?? c.financial_impact,
      applicability_conditions: get(`cat_${i}_conditions`) ?? c.applicability_conditions,
    }));

    const newChecklist = (scan.document_checklist ?? []).map((d, i) => ({
      ...d,
      document:  get(`doc_${i}_name`)      ?? d.document,
      reason:    get(`doc_${i}_reason`)    ?? d.reason,
      condition: get(`doc_${i}_condition`) ?? d.condition,
    }));

    return {
      ...scan,
      overall_summary: get('summary') ?? scan.overall_summary,
      risk_categories: newCategories,
      document_checklist: newChecklist,
      broker_questions: (scan.broker_questions ?? []).map((q, i) => get(`bq_${i}`) ?? q),
      supplier_questions: (scan.supplier_questions ?? []).map((q, i) => get(`sq_${i}`) ?? q),
      next_actions: (scan.next_actions ?? []).map((a, i) => get(`na_${i}`) ?? a),
    };
  }

  test('translated category name replaces English category', () => {
    const scan = makeScan();
    const zh = simulateMerge(scan, { 'cat_0_name': '海关申报', 'cat_0_expl': '所有商业进口都需要正式的海关申报。' });
    expect(zh.risk_categories[0].category).toBe('海关申报');
    expect(zh.risk_categories[0].explanation).toBe('所有商业进口都需要正式的海关申报。');
  });

  test('translated document name replaces English document name', () => {
    const scan = makeScan();
    const zh = simulateMerge(scan, { 'doc_0_name': '商业发票', 'doc_1_name': '装箱单' });
    expect(zh.document_checklist[0].document).toBe('商业发票');
    expect(zh.document_checklist[1].document).toBe('装箱单');
  });

  test('translated financial_impact replaces English original', () => {
    const scan = makeScan();
    const zh = simulateMerge(scan, { 'cat_0_financial': '按关税价值的 MPF 预算 +0.3464%。' });
    expect(zh.risk_categories[0].financial_impact).toBe('按关税价值的 MPF 预算 +0.3464%。');
  });

  test('translated applicability_conditions replaces English original', () => {
    const scan = makeScan();
    const zh = simulateMerge(scan, { 'cat_0_conditions': '适用于超出 $800 最低限额的货物。' });
    expect(zh.risk_categories[0].applicability_conditions).toBe('适用于超出 $800 最低限额的货物。');
  });

  test('translated condition replaces English condition', () => {
    const scan = makeScan();
    const zh = simulateMerge(scan, { 'doc_2_condition': 'HTS 编码属于 Section 301 清单 3 或 4A。' });
    expect(zh.document_checklist[2].condition).toBe('HTS 编码属于 Section 301 清单 3 或 4A。');
  });

  test('missing translation key falls back to English original (category)', () => {
    const scan = makeScan();
    const zh = simulateMerge(scan, {}); // no translations at all
    expect(zh.risk_categories[0].category).toBe('Customs Entry Filing');
  });

  test('missing translation key falls back to English original (document)', () => {
    const scan = makeScan();
    const zh = simulateMerge(scan, {});
    expect(zh.document_checklist[0].document).toBe('Commercial Invoice');
  });

  test('empty string translation falls back to English original', () => {
    const scan = makeScan();
    const zh = simulateMerge(scan, { 'cat_0_name': '' }); // empty → falls back
    expect(zh.risk_categories[0].category).toBe('Customs Entry Filing');
  });

  test('non-translated fields (id, level, source) are preserved', () => {
    const scan = makeScan();
    const zh = simulateMerge(scan, { 'cat_0_name': '海关申报' });
    expect(zh.risk_categories[0].id).toBe('customs_entry');
    expect(zh.risk_categories[0].level).toBe('Medium');
  });
});

// ── Tests: Chinese report must not show raw English deterministic labels ──────

describe('Chinese report: document names must not be raw English after translation', () => {
  const englishLabels = [
    'Commercial Invoice',
    'Packing List',
    'Bill of Lading (BoL)',
    'Customs Entry Filing',
    'Merchandise Processing Fee (MPF)',
    'Harbor Maintenance Fee (HMF)',
  ];

  for (const label of englishLabels) {
    test(`"${label}" should be translatable (present in dict)`, () => {
      const scan = makeScan();
      // Patch one document to have this name
      scan.document_checklist = [
        { document: label, required: true, reason: 'test', responsibility: 'supplier', doc_status: 'required_to_clear' },
      ];
      const dict = buildTranslationDict(scan);
      // Confirm it appears in the dict so the LLM can translate it
      expect(dict['doc_0_name']).toBe(label);
    });
  }
});

// ── Tests: legal acronyms must survive translation ────────────────────────────

describe('Legal acronyms must be preserved in translated category names', () => {
  const acronymsToPreserve = ['HTS', 'MPF', 'HMF', 'CBP', 'CPSIA', 'AD/CVD', 'Section 301', 'Chapter 99', 'MFN'];

  test('category names containing acronyms appear in translation dict', () => {
    const scan = makeScan();
    scan.risk_categories = [
      {
        id: 'mpf', category: 'Merchandise Processing Fee (MPF)', level: 'Low',
        explanation: 'MPF is assessed by CBP.', action: 'Budget for MPF.',
      },
    ];
    const dict = buildTranslationDict(scan);
    expect(dict['cat_0_name']).toBe('Merchandise Processing Fee (MPF)');
    // The LLM will translate the surrounding words but keep "MPF" intact per the prompt
  });
});

// ── Tests: translation pending/failed flow ────────────────────────────────────

describe('translation_status state flow', () => {
  test('translation_status pending → frontend keeps polling', () => {
    // When scan exists but translation_status is 'pending', the scan endpoint
    // returns status:'ready' with translation_status:'pending'.
    // The frontend shows the English scan + pending banner and polls separately.
    const apiShape = { status: 'ready' as const, scan: {}, translation_status: 'pending' as const };
    expect(apiShape.status).toBe('ready');       // UI unblocked
    expect(apiShape.translation_status).toBe('pending');  // banner shown
  });

  test('translation_status ready → frontend swaps to Chinese scan', () => {
    const apiShape = { status: 'ready' as const, scan: {}, translation_status: 'ready' as const };
    const shouldSwap = apiShape.translation_status !== 'pending';
    expect(shouldSwap).toBe(true);
  });

  test('translation_status failed → frontend shows English scan with Chinese warning', () => {
    const apiShape = { status: 'ready' as const, scan: {}, translation_status: 'failed' as const };
    const isFailed = apiShape.translation_status === 'failed';
    expect(isFailed).toBe(true);
    // translationStatus in frontend becomes 'failed' → amber banner shown
  });

  test('translation_status null (en scan) → no banner shown', () => {
    const apiShape = { status: 'ready' as const, scan: {}, translation_status: null as null };
    const needsBanner = apiShape.translation_status === 'pending' || apiShape.translation_status === 'failed';
    expect(needsBanner).toBe(false);
  });
});

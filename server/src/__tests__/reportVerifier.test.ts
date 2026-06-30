/**
 * Regression tests for the autonomous report verification gate (reportVerifier.ts).
 *
 * Proves that the verifier:
 *   1. Blocks / downgrades incorrect tariff totals
 *   2. Blocks / downgrades missing tariffs absent from payment table
 *   3. Blocks / downgrades irrelevant-module findings that create required docs
 *   4. Blocks / downgrades unsupported citations (no source)
 *   5. Blocks / downgrades voluntary standards marked mandatory
 *   6. Removes transport-mode-mismatched documents
 *   7. Downgrades documents without verified legal backing
 *   8. Removes duplicate obligation records
 *   9. Downgrades contradictory coverage-finding pairs
 *  10. Removes already-resolved facts from missing_facts
 *  11. A clean report passes without any modification
 */

import { describe, test, expect } from 'bun:test';
import { verifyScan } from '../services/reportVerifier';
import type { VerifierIssue, ProductFacts } from '../services/reportVerifier';
import { OFFICIAL_RULE_REGISTRY, buildFindingIndex } from '../data/officialRuleRegistry';
import type { OfficialRuleRecord } from '../data/officialRuleRegistry';
import type { ScanResult } from '../services/riskScanner';
import type { RiskCategory, CoverageItem, DocumentChecklistItem, ObligationRecord } from '../types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CBP_SOURCE = {
  agency: 'CBP',
  name: 'U.S. Customs and Border Protection',
  title: 'CBP Entry Requirements',
  cfr_citation: '19 CFR 141',
  url: 'https://www.cbp.gov',
  why_relevant: 'All formal commercial entries.',
};

const USITC_SOURCE = {
  agency: 'USITC',
  name: 'U.S. International Trade Commission',
  title: 'Harmonized Tariff Schedule',
  cfr_citation: '19 U.S.C. 1202',
  url: 'https://hts.usitc.gov',
  why_relevant: 'MFN duty rate for this HTS heading.',
};

function emptyScan(overrides?: Partial<ScanResult>): ScanResult {
  return {
    overall_risk: 'Low',
    overall_summary: '',
    risk_categories: [],
    document_checklist: [],
    broker_questions: [],
    supplier_questions: [],
    next_actions: [],
    readiness_score: 60,
    confidence_level: 'Low',
    coverage_matrix: [],
    missing_facts: [],
    obligations: [],
    ...overrides,
  };
}

function cat(overrides: Partial<RiskCategory> & { id: string; category: string }): RiskCategory {
  return {
    level: 'Low',
    explanation: 'Test finding',
    action: '',
    verification_status: 'verified_applicable',
    ...overrides,
  };
}

function doc(overrides: Partial<DocumentChecklistItem> & { document: string }): DocumentChecklistItem {
  return {
    required: true,
    reason: 'Test',
    responsibility: 'importer_broker',
    ...overrides,
  };
}

function cov(domain_key: string, status: CoverageItem['status'], finding_id?: string): CoverageItem {
  return {
    domain: domain_key,
    domain_key,
    category: 'tariff',
    status,
    finding_id,
  };
}

function obligation(id: string, status: ObligationRecord['status'], timing: ObligationRecord['timing'] = 'customs_clearance'): ObligationRecord {
  return {
    obligation_id: id,
    module: 'test',
    legal_citation: id,
    status,
    timing,
  };
}

function hasCode(issues: VerifierIssue[], code: string): boolean {
  return issues.some((i) => i.code === code);
}

// ── Test 1: Incorrect tariff total (financial_impact but no rate) ──────────

describe('Test 1: Incorrect tariff total — FINANCIAL_IMPACT_NO_RATE', () => {
  const scan = emptyScan({
    risk_categories: [
      cat({
        id: 'hts_duty',
        category: 'MFN Base Duty',
        verification_status: 'verified_applicable',
        source: USITC_SOURCE,
        financial_impact: '$250 on a $5,000 shipment',
        verified_rate_pct: null, // missing rate — impact has no verified basis
      }),
    ],
    coverage_matrix: [cov('mfn_duty', 'verified_applicable', 'hts_duty')],
  });

  test('flags FINANCIAL_IMPACT_NO_RATE', () => {
    const { passed, issues } = verifyScan(scan);
    expect(passed).toBe(false);
    expect(hasCode(issues, 'FINANCIAL_IMPACT_NO_RATE')).toBe(true);
  });

  test('strips financial_impact text but keeps the finding in risk_categories', () => {
    const { report } = verifyScan(scan);
    const finding = report.risk_categories.find((c) => c.id === 'hts_duty');
    expect(finding).toBeDefined();
    // Dollar amount must be removed — no verified rate means no verified dollar figure
    expect(finding?.financial_impact).toBeUndefined();
  });
});

// ── Test 2: Tariff missing from payment table ──────────────────────────────

describe('Test 2: Missing tariff — TARIFF_NOT_IN_PAYMENT_TABLE', () => {
  const scan = emptyScan({
    risk_categories: [
      cat({
        id: 'hts_section301',
        category: 'Section 301 Tariff',
        verification_status: 'verified_applicable',
        source: { agency: 'USTR', name: 'USTR', title: 'Section 301', cfr_citation: '19 U.S.C. 2411', url: 'https://ustr.gov', why_relevant: 'S301' },
        verified_rate_pct: 25,
      }),
    ],
    // No coverage_matrix entry for section_301 — tariff is verified but absent
    coverage_matrix: [cov('mfn_duty', 'verified_applicable', 'hts_duty')],
  });

  test('flags TARIFF_NOT_IN_PAYMENT_TABLE', () => {
    const { passed, issues } = verifyScan(scan);
    expect(passed).toBe(false);
    expect(hasCode(issues, 'TARIFF_NOT_IN_PAYMENT_TABLE')).toBe(true);
  });

  test('issue names the missing tariff finding', () => {
    const { issues } = verifyScan(scan);
    const issue = issues.find((i) => i.code === 'TARIFF_NOT_IN_PAYMENT_TABLE');
    expect(issue?.affected_id).toBe('hts_section301');
  });

  test('adds a corrective coverage_matrix entry so the tariff appears in payment table', () => {
    const { report } = verifyScan(scan);
    const added = report.coverage_matrix?.find((c) => c.domain_key === 'section_301');
    expect(added).toBeDefined();
    expect(added?.finding_id).toBe('hts_section301');
    expect(added?.status).toBe('verified_applicable');
  });
});

// ── Test 3: Irrelevant-module finding creates required document ────────────

describe('Test 3: Irrelevant module — NOT_APPLICABLE_REQUIRED_DOC', () => {
  const scan = emptyScan({
    risk_categories: [
      cat({
        id: 'fcc_sdoc',
        category: 'FCC Equipment Authorization',
        verification_status: 'not_applicable',
        level: 'N/A',
        source: { agency: 'FCC', name: 'FCC', title: 'Part 15', cfr_citation: '47 CFR Part 15', url: 'https://www.fcc.gov', why_relevant: 'RF devices' },
      }),
    ],
    document_checklist: [
      doc({
        document: 'FCC SDoC / Grant of Equipment Authorization',
        required: true,
        finding_id: 'fcc_sdoc', // traces to not_applicable finding
      }),
    ],
  });

  test('downgrades required document from not_applicable finding', () => {
    const { passed, report, issues } = verifyScan(scan);
    expect(passed).toBe(false);
    expect(hasCode(issues, 'NOT_APPLICABLE_REQUIRED_DOC')).toBe(true);
    const correctedDoc = report.document_checklist.find(
      (d) => d.document === 'FCC SDoC / Grant of Equipment Authorization',
    );
    expect(correctedDoc?.required).toBe(false);
  });
});

// ── Test 4: Unsupported citation — no source ──────────────────────────────

describe('Test 4: Unsupported citation — UNSOURCED_MANDATORY', () => {
  const scan = emptyScan({
    risk_categories: [
      cat({
        id: 'mystery_rule',
        category: 'Some Regulatory Requirement',
        verification_status: 'verified_applicable',
        level: 'High',
        // No source field
      }),
    ],
  });

  test('downgrades unsourced verified_applicable to official_unconfirmed', () => {
    const { passed, report, issues } = verifyScan(scan);
    expect(passed).toBe(false);
    expect(hasCode(issues, 'UNSOURCED_MANDATORY')).toBe(true);
    const corrected = report.risk_categories.find((c) => c.id === 'mystery_rule');
    expect(corrected?.verification_status).toBe('official_unconfirmed');
  });
});

// ── Test 5: Voluntary standard labelled mandatory ─────────────────────────

describe('Test 5: Voluntary standard — VOLUNTARY_NOT_MANDATORY', () => {
  const scan = emptyScan({
    risk_categories: [
      cat({
        id: 'astm_f2040',
        category: 'ASTM F2040 Ski Helmet Standard',
        verification_status: 'verified_applicable',
        level: 'Medium',
        source: {
          agency: 'ASTM International',
          name: 'ASTM',
          title: 'ASTM F2040',
          cfr_citation: 'ASTM F2040',
          url: 'https://www.astm.org',
          why_relevant: 'Voluntary ski helmet standard',
        },
      }),
    ],
  });

  test('downgrades ASTM-only finding from verified_applicable to official_unconfirmed', () => {
    const { passed, report, issues } = verifyScan(scan);
    expect(passed).toBe(false);
    expect(hasCode(issues, 'VOLUNTARY_NOT_MANDATORY')).toBe(true);
    const corrected = report.risk_categories.find((c) => c.id === 'astm_f2040');
    expect(corrected?.verification_status).toBe('official_unconfirmed');
  });

  test('does not downgrade a federal-agency-sourced finding', () => {
    const fedScan = emptyScan({
      risk_categories: [
        cat({
          id: 'cpsia',
          category: "Children's Product Safety (CPSIA)",
          verification_status: 'verified_applicable',
          source: { agency: 'CPSC', name: 'CPSC', title: 'CPSIA', cfr_citation: '15 U.S.C. 2063', url: 'https://cpsc.gov', why_relevant: 'CPSIA' },
        }),
      ],
    });
    const { issues } = verifyScan(fedScan);
    expect(hasCode(issues, 'VOLUNTARY_NOT_MANDATORY')).toBe(false);
  });
});

// ── Test 6: Transport-mode mismatch ──────────────────────────────────────

describe('Test 6: Transport-mode mismatch — TRANSPORT_MODE_MISMATCH', () => {
  const scan = emptyScan({
    document_checklist: [
      doc({
        document: 'Bill of Lading (BoL)',
        required: true,
        transport_modes: ['ocean'],
        finding_id: 'cbp_entry',
      }),
      doc({
        document: 'Air Waybill (AWB)',
        required: true,
        transport_modes: ['air'],
        finding_id: 'cbp_entry',
      }),
      doc({
        document: 'Commercial Invoice',
        required: true,
        finding_id: 'cbp_entry',
        // no transport_modes — applies to all modes
      }),
    ],
    risk_categories: [
      cat({ id: 'cbp_entry', category: 'CBP Entry', source: CBP_SOURCE }),
    ],
  });

  test('removes ocean-only doc when mode is air', () => {
    const { passed, report, issues } = verifyScan(scan, { transportMode: 'air' });
    expect(passed).toBe(false);
    expect(hasCode(issues, 'TRANSPORT_MODE_MISMATCH')).toBe(true);
    const docNames = report.document_checklist.map((d) => d.document);
    expect(docNames).not.toContain('Bill of Lading (BoL)');
    expect(docNames).toContain('Air Waybill (AWB)');
    expect(docNames).toContain('Commercial Invoice');
  });

  test('removes air-only doc when mode is ocean', () => {
    const { report } = verifyScan(scan, { transportMode: 'ocean' });
    const docNames = report.document_checklist.map((d) => d.document);
    expect(docNames).toContain('Bill of Lading (BoL)');
    expect(docNames).not.toContain('Air Waybill (AWB)');
  });

  test('no removals when mode is not set', () => {
    const { issues } = verifyScan(scan);
    expect(hasCode(issues, 'TRANSPORT_MODE_MISMATCH')).toBe(false);
  });
});

// ── Test 7: Document without legal backing ────────────────────────────────

describe('Test 7: Document without legal backing — REQUIRED_DOC_NO_BACKING', () => {
  const scan = emptyScan({
    risk_categories: [
      cat({
        id: 'some_rule',
        category: 'Some Rule',
        verification_status: 'insufficient_info', // NOT verified
        source: CBP_SOURCE,
      }),
    ],
    document_checklist: [
      doc({
        document: 'Unverified Required Document',
        required: true,
        finding_id: 'some_rule',
      }),
    ],
  });

  test('downgrades required document with unverified parent finding', () => {
    const { passed, report, issues } = verifyScan(scan);
    expect(passed).toBe(false);
    expect(hasCode(issues, 'REQUIRED_DOC_NO_BACKING')).toBe(true);
    const correctedDoc = report.document_checklist.find(
      (d) => d.document === 'Unverified Required Document',
    );
    expect(correctedDoc?.required).toBe(false);
    expect(correctedDoc?.status).toBe('needs_confirmation');
  });

  test('does not downgrade required document with verified parent', () => {
    const cleanScan = emptyScan({
      risk_categories: [
        cat({
          id: 'verified_rule',
          category: 'Verified Rule',
          verification_status: 'verified_applicable',
          source: CBP_SOURCE,
        }),
      ],
      document_checklist: [
        doc({
          document: 'Backed Required Document',
          required: true,
          finding_id: 'verified_rule',
        }),
      ],
    });
    const { issues } = verifyScan(cleanScan);
    expect(hasCode(issues, 'REQUIRED_DOC_NO_BACKING')).toBe(false);
  });
});

// ── Test 8: Duplicate obligations ────────────────────────────────────────

describe('Test 8: Duplicate obligations — DUPLICATE_OBLIGATIONS', () => {
  const dup = obligation('19-cfr-141::mandatory::customs_clearance');
  const scan = emptyScan({
    obligations: [dup, dup, obligation('different-key::mandatory::customs_clearance')],
  });

  test('removes duplicate obligation records', () => {
    const { passed, report, issues } = verifyScan(scan);
    expect(passed).toBe(false);
    expect(hasCode(issues, 'DUPLICATE_OBLIGATIONS')).toBe(true);
    const ids = report.obligations?.map((o) => o.obligation_id) ?? [];
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  test('keeps all unique obligations', () => {
    const { report } = verifyScan(scan);
    expect(report.obligations).toHaveLength(2);
  });

  test('deduplication also removes duplicate documents in checklist', () => {
    const scanWithDupDocs = emptyScan({
      document_checklist: [
        doc({ document: 'Commercial Invoice', required: true, finding_id: 'cbp_entry' }),
        doc({ document: 'Commercial Invoice', required: true, finding_id: 'cbp_entry' }),
      ],
      risk_categories: [cat({ id: 'cbp_entry', category: 'CBP Entry', source: CBP_SOURCE })],
    });
    const { report, issues } = verifyScan(scanWithDupDocs);
    expect(hasCode(issues, 'DUPLICATE_DOCUMENT')).toBe(true);
    expect(report.document_checklist).toHaveLength(1);
  });
});

// ── Test 9: Contradictory conclusions ────────────────────────────────────

describe('Test 9: Contradictory conclusions — COVERAGE_FINDING_CONTRADICTION', () => {
  // Coverage matrix says Section 301 is not_applicable, but the finding says verified
  const scan = emptyScan({
    risk_categories: [
      cat({
        id: 'hts_section301',
        category: 'Section 301 Tariff',
        verification_status: 'verified_applicable',
        source: { agency: 'USTR', name: 'USTR', title: 'S301', cfr_citation: '19 U.S.C. 2411', url: 'https://ustr.gov', why_relevant: 'S301' },
        verified_rate_pct: 25,
      }),
    ],
    coverage_matrix: [
      cov('section_301', 'not_applicable', 'hts_section301'),
    ],
  });

  test('downgrades finding contradicted by coverage matrix', () => {
    const { passed, report, issues } = verifyScan(scan);
    expect(passed).toBe(false);
    expect(hasCode(issues, 'COVERAGE_FINDING_CONTRADICTION')).toBe(true);
    const corrected = report.risk_categories.find((c) => c.id === 'hts_section301');
    expect(corrected?.verification_status).toBe('official_unconfirmed');
  });
});

// ── Test 10: Already-resolved missing fact ────────────────────────────────

describe('Test 10: Resolved missing fact — RESOLVED_MISSING_FACT', () => {
  const resolvedFact = 'Battery watt-hour rating required';
  const scan = emptyScan({
    risk_categories: [
      cat({
        id: 'battery_transport',
        category: 'PHMSA Lithium Battery',
        verification_status: 'verified_applicable', // now resolved
        source: { agency: 'PHMSA', name: 'PHMSA', title: '49 CFR 173.185', cfr_citation: '49 CFR 173.185', url: 'https://phmsa.dot.gov', why_relevant: 'battery' },
        missing_info: resolvedFact,
      }),
    ],
    missing_facts: [resolvedFact, 'Genuinely unresolved fact about something else'],
  });

  test('removes resolved fact from missing_facts', () => {
    const { passed, report, issues } = verifyScan(scan);
    expect(passed).toBe(false);
    expect(hasCode(issues, 'RESOLVED_MISSING_FACT')).toBe(true);
    expect(report.missing_facts).not.toContain(resolvedFact);
    expect(report.missing_facts).toContain('Genuinely unresolved fact about something else');
  });
});

// ── Test 11: Clean report passes without modification ─────────────────────

describe('Test 11: Clean report — passes unchanged', () => {
  const cleanScan = emptyScan({
    risk_categories: [
      cat({
        id: 'hts_duty',
        category: 'MFN Base Duty — 4.9%',
        verification_status: 'verified_applicable',
        source: USITC_SOURCE,
        verified_rate_pct: 4.9,
        financial_impact: '$245 on a $5,000 shipment',
      }),
      cat({
        id: 'hts_section301',
        category: 'Section 301 Tariff — China',
        verification_status: 'verified_applicable',
        source: {
          agency: 'USTR',
          name: 'USTR',
          title: 'Section 301 List 3',
          cfr_citation: '9903.88.03',
          url: 'https://ustr.gov',
          why_relevant: 'S301 List 3',
        },
        verified_rate_pct: 25,
        financial_impact: '$1,250 on a $5,000 shipment',
      }),
      cat({
        id: 'cbp_entry',
        category: 'CBP Entry Requirements',
        verification_status: 'verified_applicable',
        source: CBP_SOURCE,
      }),
    ],
    document_checklist: [
      doc({
        document: 'Commercial Invoice',
        required: true,
        finding_id: 'cbp_entry',
      }),
      doc({
        document: 'Bill of Lading (BoL)',
        required: true,
        finding_id: 'cbp_entry',
        transport_modes: ['ocean'],
      }),
    ],
    coverage_matrix: [
      cov('mfn_duty', 'verified_applicable', 'hts_duty'),
      cov('section_301', 'verified_applicable', 'hts_section301'),
    ],
    missing_facts: [],
    obligations: [
      obligation('19-u.s.c.-1202::mandatory::customs_clearance'),
      obligation('9903.88.03::mandatory::customs_clearance'),
    ],
  });

  test('passes with zero issues for ocean mode', () => {
    const { passed, issues } = verifyScan(cleanScan, { transportMode: 'ocean' });
    expect(passed).toBe(true);
    expect(issues).toHaveLength(0);
  });

  test('report is returned unchanged when passing', () => {
    const { report } = verifyScan(cleanScan, { transportMode: 'ocean' });
    expect(report.risk_categories).toHaveLength(cleanScan.risk_categories.length);
    expect(report.document_checklist).toHaveLength(cleanScan.document_checklist.length);
    expect(report.obligations).toHaveLength(cleanScan.obligations!.length);
    expect(report.risk_categories.every((c) => c.verification_status === 'verified_applicable')).toBe(true);
  });

  test('removes BoL and passes when mode is air', () => {
    const { passed, report, issues } = verifyScan(cleanScan, { transportMode: 'air' });
    // TRANSPORT_MODE_MISMATCH for BoL — that is the only issue
    expect(issues.every((i) => i.code === 'TRANSPORT_MODE_MISMATCH')).toBe(true);
    expect(report.document_checklist.map((d) => d.document)).not.toContain('Bill of Lading (BoL)');
    // All other checks pass
    expect(issues.some((i) => i.code !== 'TRANSPORT_MODE_MISMATCH')).toBe(false);
  });
});

// ── Test 12: Combined errors — only affected sections corrected ───────────

describe('Test 12: Partial errors — unaffected sections unchanged', () => {
  const mixedScan = emptyScan({
    risk_categories: [
      // Good: verified with federal source
      cat({
        id: 'cbp_entry',
        category: 'CBP Entry',
        verification_status: 'verified_applicable',
        source: CBP_SOURCE,
      }),
      // Bad: voluntary-body-only source marked mandatory
      cat({
        id: 'astm_vol',
        category: 'ASTM Voluntary Standard',
        verification_status: 'verified_applicable',
        source: { agency: 'ASTM', name: 'ASTM', title: 'ASTM Test', cfr_citation: 'ASTM F999', url: 'https://astm.org', why_relevant: 'vol' },
      }),
    ],
    document_checklist: [
      // Good: backed by verified CBP finding
      doc({ document: 'Commercial Invoice', required: true, finding_id: 'cbp_entry' }),
    ],
  });

  test('downgrades only the voluntary finding — CBP finding unchanged', () => {
    const { report, issues } = verifyScan(mixedScan);
    expect(hasCode(issues, 'VOLUNTARY_NOT_MANDATORY')).toBe(true);
    // CBP finding not touched
    const cbp = report.risk_categories.find((c) => c.id === 'cbp_entry');
    expect(cbp?.verification_status).toBe('verified_applicable');
    // ASTM finding downgraded
    const astm = report.risk_categories.find((c) => c.id === 'astm_vol');
    expect(astm?.verification_status).toBe('official_unconfirmed');
    // Document is still required (backed by CBP finding which remains verified)
    const inv = report.document_checklist.find((d) => d.document === 'Commercial Invoice');
    expect(inv?.required).toBe(true);
  });
});

// ── Test 13: UL as voluntary body ─────────────────────────────────────────

describe('Test 13: UL source — voluntary body', () => {
  const scan = emptyScan({
    risk_categories: [
      cat({
        id: 'ul_listing',
        category: 'UL 60950 Product Safety Listing',
        verification_status: 'verified_applicable',
        source: { agency: 'UL', name: 'Underwriters Laboratories', title: 'UL 60950', cfr_citation: 'UL 60950', url: 'https://ul.com', why_relevant: 'UL listing' },
      }),
    ],
  });

  test('downgrades UL-only finding', () => {
    const { issues, report } = verifyScan(scan);
    expect(hasCode(issues, 'VOLUNTARY_NOT_MANDATORY')).toBe(true);
    expect(report.risk_categories[0].verification_status).toBe('official_unconfirmed');
  });
});

// ── Test 14: Unresolved exemption condition stays in missing_facts ─────────

describe('Test 14: Unresolved exemption condition remains visible', () => {
  const genuinelyUnresolved = 'Whether product qualifies for USTR exclusion order XYZ-2024';
  const scan = emptyScan({
    risk_categories: [
      cat({
        id: 'hts_section301',
        category: 'Section 301 Tariff',
        verification_status: 'insufficient_info', // NOT resolved
        source: { agency: 'USTR', name: 'USTR', title: 'S301', cfr_citation: '19 U.S.C. 2411', url: 'https://ustr.gov', why_relevant: 'S301' },
        missing_info: genuinelyUnresolved,
      }),
    ],
    missing_facts: [genuinelyUnresolved],
  });

  test('does not remove unresolved exemption condition from missing_facts', () => {
    const { report, issues } = verifyScan(scan);
    expect(hasCode(issues, 'RESOLVED_MISSING_FACT')).toBe(false);
    expect(report.missing_facts).toContain(genuinelyUnresolved);
  });
});

// ── Acceptance tests: registry scope validation ───────────────────────────────
// These tests prove that the verifier independently validates the legal claims
// in verified_applicable findings against the official-rule registry.

// ── Test 15: Citation scope mismatch — HTS chapter wrong ─────────────────────
// FTC textile fiber labeling (16 CFR 303) applies only to HTS chapters 50–63.
// When applied to an automotive part (HTS chapter 87), the citation is out of scope.

describe('Test 15: Citation scope mismatch — wrong product category (CITATION_SCOPE_MISMATCH)', () => {
  const autoPartFacts: ProductFacts = {
    htsDigits: '8708295060',         // chapter 87 — automotive parts
    productText: 'automotive brake drum',
    originCountry: 'Mexico',
    attrs: { is_children: false, is_textile: false },
  };

  const scan = emptyScan({
    risk_categories: [
      cat({
        id: 'ftc_textile_labeling',
        category: 'FTC Textile Fiber Labeling (16 CFR 303)',
        verification_status: 'verified_applicable',
        source: {
          agency: 'FTC',
          name: 'Federal Trade Commission',
          title: 'Textile Fiber Products Identification Act',
          cfr_citation: '15 U.S.C. 70; 16 CFR 303',
          url: 'https://www.ftc.gov',
          why_relevant: 'Textile labeling',
        },
      }),
    ],
  });

  test('downgrades FTC textile citation applied to automotive parts (wrong HTS chapter)', () => {
    const { passed, report, issues } = verifyScan(scan, { productFacts: autoPartFacts });
    expect(passed).toBe(false);
    expect(hasCode(issues, 'CITATION_SCOPE_MISMATCH')).toBe(true);
    const corrected = report.risk_categories.find((c) => c.id === 'ftc_textile_labeling');
    expect(corrected?.verification_status).toBe('official_unconfirmed');
  });

  test('does not fire when product IS in a textile chapter (HTS 62)', () => {
    const textileFacts: ProductFacts = {
      htsDigits: '6210405020',       // chapter 62 — wearing apparel
      productText: 'cotton jacket',
      originCountry: 'Bangladesh',
      attrs: { is_children: false, is_textile: true },
    };
    const { issues } = verifyScan(scan, { productFacts: textileFacts });
    expect(hasCode(issues, 'CITATION_SCOPE_MISMATCH')).toBe(false);
  });
});

// ── Test 16: Scope condition unmet — age restriction ──────────────────────────
// CPSIA (16 CFR 1107 / 15 U.S.C. 2063) applies only to children's products
// (products designed for children 12 and younger).  An adult product that
// carries a CPSIA "verified_applicable" finding must be downgraded.

describe("Test 16: Scope condition unmet — CPSIA on adult product (SCOPE_CONDITION_UNMET)", () => {
  const adultProductFacts: ProductFacts = {
    htsDigits: '4203218060',
    productText: 'leather boxing gloves for adults',
    originCountry: 'China',
    attrs: { is_children: false },  // adult product — CPSIA does not apply
  };

  const scan = emptyScan({
    risk_categories: [
      cat({
        id: 'cpsia_third_party_testing',
        category: "Children's Product Safety (CPSIA) — Third-Party Testing",
        verification_status: 'verified_applicable',
        source: {
          agency: 'CPSC',
          name: 'Consumer Product Safety Commission',
          title: 'CPSIA',
          cfr_citation: '15 U.S.C. 2063; 16 CFR 1107',
          url: 'https://www.cpsc.gov',
          why_relevant: 'CPSIA',
        },
      }),
    ],
  });

  test('downgrades CPSIA finding when product is not for children', () => {
    const { passed, report, issues } = verifyScan(scan, { productFacts: adultProductFacts });
    expect(passed).toBe(false);
    expect(hasCode(issues, 'SCOPE_CONDITION_UNMET')).toBe(true);
    const corrected = report.risk_categories.find((c) => c.id === 'cpsia_third_party_testing');
    expect(corrected?.verification_status).toBe('official_unconfirmed');
  });

  test('approves CPSIA when product IS for children', () => {
    const kidsFacts: ProductFacts = {
      htsDigits: '9503000090',
      productText: "children's building blocks toy",
      originCountry: 'China',
      attrs: { is_children: true },
    };
    const { issues } = verifyScan(scan, { productFacts: kidsFacts });
    expect(hasCode(issues, 'SCOPE_CONDITION_UNMET')).toBe(false);
    expect(hasCode(issues, 'CITATION_SCOPE_MISMATCH')).toBe(false);
  });

  test('fires CLARIFICATION_REQUIRED and downgrades when is_children is unknown', () => {
    // Previously "skipped" — now fails closed: generates a clarification question
    const unknownFacts: ProductFacts = {
      htsDigits: '4203218060',
      productText: 'gloves',
      // attrs not provided — children status unknown → must clarify, not skip
    };
    const { passed, report, issues } = verifyScan(scan, { productFacts: unknownFacts });
    expect(passed).toBe(false);
    expect(hasCode(issues, 'CLARIFICATION_REQUIRED')).toBe(true);
    const corrected = report.risk_categories.find((c) => c.id === 'cpsia_third_party_testing');
    expect(corrected?.verification_status).toBe('official_unconfirmed');
    // Clarification question must be generated with the right fact_key
    expect(report.clarification_questions).toBeDefined();
    const q = report.clarification_questions!.find((q) => q.fact_key === 'is_children');
    expect(q).toBeDefined();
    expect(q?.affects_finding_id).toBe('cpsia_third_party_testing');
    expect(q?.options).toBeDefined();
  });
});

// ── Test 17: Expired rule ─────────────────────────────────────────────────────
// A rule record with an expiry_date before today must cause the finding to be
// downgraded regardless of the finding's other properties.

describe('Test 17: Expired rule — RULE_EXPIRED', () => {
  const expiredRule: OfficialRuleRecord = {
    rule_id: 'test_expired_surcharge',
    finding_id: 'test_expired_finding',
    agency: 'CBP',
    legal_citation: '9903.99.99',
    official_url: 'https://cbp.gov',
    supported_proposition: 'Temporary surcharge that has since been repealed.',
    product_scope: 'All merchandise',
    scope_conditions: {},
    effective_date: '2020-01-01',
    expiry_date: '2023-12-31',     // expired before today (2026-06-30)
    legal_status: 'mandatory',
    timing: 'customs_clearance',
  };

  const scan = emptyScan({
    risk_categories: [
      cat({
        id: 'test_expired_finding',
        category: 'Expired Temporary Surcharge',
        verification_status: 'verified_applicable',
        source: {
          agency: 'CBP',
          name: 'CBP',
          title: 'Expired surcharge',
          cfr_citation: '9903.99.99',
          url: 'https://cbp.gov',
          why_relevant: 'Expired surcharge',
        },
        verified_rate_pct: 5,
      }),
    ],
  });

  test('downgrades verified finding when the rule has expired', () => {
    const { passed, report, issues } = verifyScan(scan, {
      ruleRegistry: [expiredRule],
      productFacts: { importDate: '2026-06-30' },
    });
    expect(passed).toBe(false);
    expect(hasCode(issues, 'RULE_EXPIRED')).toBe(true);
    const corrected = report.risk_categories.find((c) => c.id === 'test_expired_finding');
    expect(corrected?.verification_status).toBe('official_unconfirmed');
  });

  test('does not fire RULE_EXPIRED when import date is before expiry', () => {
    const { issues } = verifyScan(scan, {
      ruleRegistry: [expiredRule],
      productFacts: { importDate: '2023-06-01' }, // before 2023-12-31 expiry
    });
    expect(hasCode(issues, 'RULE_EXPIRED')).toBe(false);
  });

  test('correctly-sourced report with no expired rules passes unchanged', () => {
    const activeRule: OfficialRuleRecord = {
      rule_id: 'active_rule',
      finding_id: 'test_expired_finding',
      agency: 'CBP',
      legal_citation: '9903.99.99',
      official_url: 'https://cbp.gov',
      supported_proposition: 'Active rule.',
      product_scope: 'All merchandise',
      scope_conditions: {},
      effective_date: '2020-01-01',
      // No expiry_date
      legal_status: 'mandatory',
      timing: 'customs_clearance',
    };
    const { passed } = verifyScan(scan, {
      ruleRegistry: [activeRule],
      productFacts: { importDate: '2026-06-30' },
    });
    expect(passed).toBe(true);
  });
});

// ── Test 18: FINANCIAL_IMPACT_NO_RATE now strips the dollar amount ─────────────
// (Updated behavior from original check J — now blocking / corrective rather than log-only)

describe('Test 18: FINANCIAL_IMPACT_NO_RATE is blocking — dollar amount stripped', () => {
  const scan = emptyScan({
    risk_categories: [
      cat({
        id: 'hts_duty',
        category: 'MFN Duty',
        verification_status: 'verified_applicable',
        source: USITC_SOURCE,
        financial_impact: '$500 on a $10,000 shipment',
        verified_rate_pct: null,   // rate unknown — dollar amount has no verified basis
      }),
    ],
    coverage_matrix: [cov('mfn_duty', 'verified_applicable', 'hts_duty')],
  });

  test('issues FINANCIAL_IMPACT_NO_RATE and strips financial_impact text', () => {
    const { passed, report, issues } = verifyScan(scan);
    expect(passed).toBe(false);
    expect(hasCode(issues, 'FINANCIAL_IMPACT_NO_RATE')).toBe(true);
    const finding = report.risk_categories.find((c) => c.id === 'hts_duty');
    expect(finding).toBeDefined();
    expect(finding?.financial_impact).toBeUndefined();
  });

  test('finding without financial_impact is unchanged by check J', () => {
    const safeCase = emptyScan({
      risk_categories: [
        cat({
          id: 'hts_duty',
          category: 'MFN Duty',
          verification_status: 'verified_applicable',
          source: USITC_SOURCE,
          financial_impact: undefined,
          verified_rate_pct: null,
        }),
      ],
      coverage_matrix: [cov('mfn_duty', 'verified_applicable', 'hts_duty')],
    });
    const { issues } = verifyScan(safeCase);
    expect(hasCode(issues, 'FINANCIAL_IMPACT_NO_RATE')).toBe(false);
  });
});

// ── Test 19: TARIFF_NOT_IN_PAYMENT_TABLE is blocking — corrective entry added ──
// (Updated behavior from original check K — now corrective rather than log-only)

describe('Test 19: TARIFF_NOT_IN_PAYMENT_TABLE is blocking — coverage entry inserted', () => {
  const scan = emptyScan({
    risk_categories: [
      cat({
        id: 'section_122_surcharge',
        category: 'Section 122 Temporary Surcharge — 10%',
        verification_status: 'verified_applicable',
        source: {
          agency: 'CBP',
          name: 'CBP',
          title: 'Section 122 Surcharge',
          cfr_citation: '9903.01.25; 19 U.S.C. 2132',
          url: 'https://cbp.gov',
          why_relevant: 'Temporary surcharge',
        },
        verified_rate_pct: 10,
        financial_impact: '$500 on a $5,000 shipment',
      }),
    ],
    // No coverage_matrix entry for section_122_surcharge
    coverage_matrix: [cov('mfn_duty', 'verified_applicable', 'hts_duty')],
  });

  test('flags TARIFF_NOT_IN_PAYMENT_TABLE', () => {
    const { issues } = verifyScan(scan);
    expect(hasCode(issues, 'TARIFF_NOT_IN_PAYMENT_TABLE')).toBe(true);
  });

  test('inserts corrective entry into coverage_matrix', () => {
    const { report } = verifyScan(scan);
    const added = report.coverage_matrix?.find((c) => c.domain_key === 'section_122_surcharge');
    expect(added).toBeDefined();
    expect(added?.finding_id).toBe('section_122_surcharge');
    expect(added?.status).toBe('verified_applicable');
  });

  test('original MFN entry is preserved alongside the corrective entry', () => {
    const { report } = verifyScan(scan);
    expect(report.coverage_matrix?.some((c) => c.domain_key === 'mfn_duty')).toBe(true);
  });
});

// ── Test 20: Total amount mismatch — per-finding math inconsistency ────────────
// When financial_impact states a dollar figure that does not equal
// rate_pct × customs_value / 100, the amount is stripped (TOTAL_AMOUNT_MISMATCH).

describe('Test 20: Per-finding amount mismatch — TOTAL_AMOUNT_MISMATCH', () => {
  const scan = emptyScan({
    risk_categories: [
      cat({
        id: 'hts_section301',
        category: 'Section 301 Tariff — 25%',
        verification_status: 'verified_applicable',
        source: {
          agency: 'USTR',
          name: 'USTR',
          title: 'Section 301 List 3',
          cfr_citation: '9903.88.03',
          url: 'https://ustr.gov',
          why_relevant: 'S301',
        },
        verified_rate_pct: 25,
        // 25% × $5,000 = $1,250 — but this claims $2,000 (wrong)
        financial_impact: '$2,000 on a $5,000 shipment (25% Section 301, List 3)',
      }),
    ],
    coverage_matrix: [cov('section_301', 'verified_applicable', 'hts_section301')],
  });

  test('flags TOTAL_AMOUNT_MISMATCH when stated amount does not match rate × value', () => {
    const { passed, issues } = verifyScan(scan);
    expect(passed).toBe(false);
    expect(hasCode(issues, 'TOTAL_AMOUNT_MISMATCH')).toBe(true);
  });

  test('strips the incorrect financial_impact text', () => {
    const { report } = verifyScan(scan);
    const finding = report.risk_categories.find((c) => c.id === 'hts_section301');
    expect(finding?.financial_impact).toBeUndefined();
  });

  test('does not flag when amount matches rate × value within $1 tolerance', () => {
    const correctScan = emptyScan({
      risk_categories: [
        cat({
          id: 'hts_section301',
          category: 'Section 301 Tariff — 25%',
          verification_status: 'verified_applicable',
          source: {
            agency: 'USTR',
            name: 'USTR',
            title: 'Section 301 List 3',
            cfr_citation: '9903.88.03',
            url: 'https://ustr.gov',
            why_relevant: 'S301',
          },
          verified_rate_pct: 25,
          financial_impact: '$1,250 on a $5,000 shipment (25% Section 301, List 3)',
        }),
      ],
      coverage_matrix: [cov('section_301', 'verified_applicable', 'hts_section301')],
    });
    const { issues } = verifyScan(correctScan);
    expect(hasCode(issues, 'TOTAL_AMOUNT_MISMATCH')).toBe(false);
  });
});

// ── Test 21: PHMSA citation applied to non-battery product ────────────────────
// 49 CFR 173.185 (UN 38.3 lithium battery transport) requires has_battery = true.
// Applied to a product without a battery, the scope condition is unmet.

describe('Test 21: PHMSA citation on non-battery product — SCOPE_CONDITION_UNMET', () => {
  const noBatteryFacts: ProductFacts = {
    htsDigits: '9403200010',         // wooden furniture, no battery
    productText: 'wooden dining chair',
    originCountry: 'Vietnam',
    attrs: { is_children: false, has_battery: false, is_electronic: false },
  };

  const scan = emptyScan({
    risk_categories: [
      cat({
        id: 'phmsa_un383',
        category: 'PHMSA Lithium Battery Transport — UN 38.3',
        verification_status: 'verified_applicable',
        source: {
          agency: 'PHMSA',
          name: 'Pipeline and Hazardous Materials Safety Administration',
          title: '49 CFR 173.185',
          cfr_citation: '49 CFR 173.185',
          url: 'https://www.phmsa.dot.gov',
          why_relevant: 'Lithium battery transport',
        },
      }),
    ],
  });

  test('downgrades PHMSA battery-transport citation when product has no battery', () => {
    const { passed, report, issues } = verifyScan(scan, { productFacts: noBatteryFacts });
    expect(passed).toBe(false);
    expect(hasCode(issues, 'SCOPE_CONDITION_UNMET')).toBe(true);
    const corrected = report.risk_categories.find((c) => c.id === 'phmsa_un383');
    expect(corrected?.verification_status).toBe('official_unconfirmed');
  });

  test('approves PHMSA citation when product contains a lithium-ion battery and type is confirmed', () => {
    const batteryFacts: ProductFacts = {
      htsDigits: '8507600020',
      productText: 'lithium ion power bank',
      originCountry: 'China',
      attrs: { has_battery: true, is_electronic: true, is_children: false },
      knownFacts: { battery_type: 'lithium_ion' },
    };
    const { issues } = verifyScan(scan, { productFacts: batteryFacts });
    expect(hasCode(issues, 'SCOPE_CONDITION_UNMET')).toBe(false);
    expect(hasCode(issues, 'CLARIFICATION_REQUIRED')).toBe(false);
  });

  test('fires CLARIFICATION_REQUIRED when battery is present but battery_type is unknown', () => {
    const unknownTypeFacts: ProductFacts = {
      htsDigits: '8507600020',
      productText: 'power bank',
      originCountry: 'China',
      attrs: { has_battery: true, is_electronic: true, is_children: false },
      // knownFacts.battery_type absent → clarification required
    };
    const { passed, report, issues } = verifyScan(scan, { productFacts: unknownTypeFacts });
    expect(passed).toBe(false);
    expect(hasCode(issues, 'CLARIFICATION_REQUIRED')).toBe(true);
    const q = report.clarification_questions?.find((q) => q.fact_key === 'battery_type');
    expect(q).toBeDefined();
    expect(q?.affects_finding_id).toBe('phmsa_un383');
  });
});

// ── Test 22: Correctly-sourced report passes unchanged (with productFacts) ─────
// When all claims are correct and product scope is satisfied, the verifier must
// return the report unchanged with zero issues.

describe('Test 22: Clean report passes unchanged with productFacts provided', () => {
  const cleanFacts: ProductFacts = {
    htsDigits: '4203218060',      // chapter 42 — leather boxing gloves
    productText: 'leather boxing gloves for adults',
    originCountry: 'China',
    importDate: '2026-06-30',
    attrs: { is_children: false, has_battery: false, is_electronic: false, is_textile: false },
  };

  const cleanScan = emptyScan({
    risk_categories: [
      cat({
        id: 'hts_duty',
        category: 'Customs Duty (MFN) — 4.9%',
        verification_status: 'verified_applicable',
        source: USITC_SOURCE,
        verified_rate_pct: 4.9,
        financial_impact: '$245 on a $5,000 shipment (4.9% MFN, per USITC HTS)',
      }),
      cat({
        id: 'hts_section301',
        category: 'Section 301 China Tariff — 25%',
        verification_status: 'verified_applicable',
        source: {
          agency: 'USTR',
          name: 'USTR',
          title: 'Section 301 List 3',
          cfr_citation: '9903.88.03',
          url: 'https://ustr.gov',
          why_relevant: 'S301',
        },
        verified_rate_pct: 25,
        financial_impact: '$1,250 on a $5,000 shipment (25% Section 301, List 3)',
      }),
      cat({
        id: 'cbp_entry',
        category: 'CBP Entry Requirements',
        verification_status: 'verified_applicable',
        source: CBP_SOURCE,
      }),
    ],
    document_checklist: [
      doc({ document: 'Commercial Invoice', required: true, finding_id: 'cbp_entry' }),
      doc({ document: 'Bill of Lading (BoL)', required: true, finding_id: 'cbp_entry', transport_modes: ['ocean'] }),
    ],
    coverage_matrix: [
      cov('mfn_duty', 'verified_applicable', 'hts_duty'),
      cov('section_301', 'verified_applicable', 'hts_section301'),
    ],
    missing_facts: [],
  });

  test('zero issues for ocean mode with correct productFacts', () => {
    const { passed, issues } = verifyScan(cleanScan, {
      transportMode: 'ocean',
      productFacts: cleanFacts,
    });
    expect(passed).toBe(true);
    expect(issues).toHaveLength(0);
  });

  test('report is returned unchanged', () => {
    const { report } = verifyScan(cleanScan, {
      transportMode: 'ocean',
      productFacts: cleanFacts,
    });
    expect(report.risk_categories).toHaveLength(cleanScan.risk_categories.length);
    expect(report.coverage_matrix).toHaveLength(cleanScan.coverage_matrix!.length);
    expect(report.risk_categories.every((c) => c.verification_status === 'verified_applicable')).toBe(true);
  });
});

// ── Test 23: RULE_NOT_IN_REGISTRY ─────────────────────────────────────────────
// Any verified_applicable finding with no matching entry in the official-rule
// registry cannot be independently validated and must be downgraded.

describe('Test 23: RULE_NOT_IN_REGISTRY — finding absent from registry is downgraded', () => {
  const facts: ProductFacts = {
    htsDigits: '4203218060',
    productText: 'gloves',
    originCountry: 'China',
    importDate: '2026-06-30',
    attrs: { is_children: false },
  };

  const scan = emptyScan({
    risk_categories: [
      cat({
        id: 'some_invented_finding',
        category: 'Invented Rule (no registry entry)',
        verification_status: 'verified_applicable',
        source: CBP_SOURCE,
      }),
    ],
  });

  test('fires RULE_NOT_IN_REGISTRY when finding has no registry entry', () => {
    // Use an empty registry to guarantee the finding is absent.
    const { passed, report, issues } = verifyScan(scan, {
      ruleRegistry: [],
      productFacts: facts,
    });
    expect(passed).toBe(false);
    expect(hasCode(issues, 'RULE_NOT_IN_REGISTRY')).toBe(true);
    const corrected = report.risk_categories.find((c) => c.id === 'some_invented_finding');
    expect(corrected?.verification_status).toBe('official_unconfirmed');
  });

  test('does NOT fire when the finding IS in the registry', () => {
    const activeRule: OfficialRuleRecord = {
      rule_id: 'test_rule',
      finding_id: 'some_invented_finding',
      agency: 'CBP',
      legal_citation: '19 CFR 141',
      official_url: 'https://cbp.gov',
      supported_proposition: 'Active rule.',
      product_scope: 'All merchandise',
      scope_conditions: {},
      effective_date: '2020-01-01',
      legal_status: 'mandatory',
      timing: 'customs_clearance',
    };
    const { issues } = verifyScan(scan, {
      ruleRegistry: [activeRule],
      productFacts: facts,
    });
    expect(hasCode(issues, 'RULE_NOT_IN_REGISTRY')).toBe(false);
  });

  test('does NOT fire when productFacts is absent (check L gating)', () => {
    // Without productFacts, check L is skipped entirely.
    const { issues } = verifyScan(scan);
    expect(hasCode(issues, 'RULE_NOT_IN_REGISTRY')).toBe(false);
  });
});

// ── Test 24: Registry coverage ────────────────────────────────────────────────
// Every mandatory finding_id that can be emitted as verified_applicable by any
// baseline or regulatory module must have exactly one active entry in
// OFFICIAL_RULE_REGISTRY.

describe('Test 24: Registry coverage — every mandatory finding_id has a registry entry', () => {
  // Canonical list of finding_ids that the baselines and regulatory modules can
  // emit as verified_applicable. Must stay in sync with actual module outputs.
  const MANDATORY_FINDING_IDS: string[] = [
    // Baselines
    'cbp_entry', 'hts_duty', 'mpf', 'hmf',
    'hts_section301', 'section_122_surcharge', 'section_232_auto',
    // Children's products
    'cpsia_third_party_testing', 'cpsia_cpc', 'cpsia_lead', 'cpsc_toy_f963',
    // Batteries
    'phmsa_un383', 'phmsa_dot_class', 'phmsa_soc_air',
    // Electronics
    'fcc_equipment_authorization', 'fcc_part15_sdoc',
    // Chemicals
    'epa_fifra', 'epa_tsca', 'dot_hazmat_chemical',
    // Cosmetics / OTC drugs
    'fda_cosmetic_mocra', 'fda_cosmetic_labeling', 'fda_otc_drug',
    // Food
    'fda_prior_notice', 'fda_fsis_inspection', 'fda_food_labeling',
    // Medical devices
    'fda_device_registration', 'fda_device_premarket', 'fda_device_qsr',
    // Automotive
    'nhtsa_fmvss', 'nhtsa_fmvss_135', 'nhtsa_fmvss_121', 'nhtsa_fmvss_126', 'epa_mvpc',
    // Furniture / composite wood
    'epa_tsca_title_vi', 'cpsc_general_safety',
    // Sports (mandatory CPSC / Coast Guard / OSHA)
    'sports_bicycle_cpsc_1512', 'sports_bicycle_helmet_cpsc_1203',
    'sports_pfd_uscg_46cfr160', 'sports_inflatable_pfd_type5',
    'sports_fall_arrest_osha_1910_140',
    // Textiles / FTC labeling
    'ftc_textile_labeling', 'ftc_care_labeling', 'ftc_wool_labeling',
  ];

  test('every mandatory finding_id is present in OFFICIAL_RULE_REGISTRY', () => {
    const index = buildFindingIndex(OFFICIAL_RULE_REGISTRY);
    const missing = MANDATORY_FINDING_IDS.filter((id) => !index.has(id));
    if (missing.length > 0) {
      console.error('[Test 24] Missing registry entries for finding_ids:', missing);
    }
    expect(missing).toHaveLength(0);
  });

  test('no duplicate finding_ids in OFFICIAL_RULE_REGISTRY', () => {
    const seen = new Map<string, number>();
    for (const record of OFFICIAL_RULE_REGISTRY) {
      if (record.finding_id) {
        seen.set(record.finding_id, (seen.get(record.finding_id) ?? 0) + 1);
      }
    }
    const duplicates = [...seen.entries()].filter(([, count]) => count > 1).map(([id]) => id);
    if (duplicates.length > 0) {
      console.error('[Test 24] Duplicate finding_ids in registry:', duplicates);
    }
    expect(duplicates).toHaveLength(0);
  });
});

// ── Test 25: Unknown transport mode triggers CLARIFICATION_REQUIRED ────────────
// HMF (harbor maintenance fee) applies only to ocean freight.
// When transport mode is unknown, the verifier must clarify — not approve.

describe('Test 25: Unknown transport mode → CLARIFICATION_REQUIRED for HMF', () => {
  const factsNoMode: ProductFacts = {
    htsDigits: '4203218060',
    productText: 'leather boxing gloves',
    originCountry: 'China',
    importDate: '2026-06-30',
    attrs: { is_children: false },
    // no knownFacts.transport_mode — must be detected from ctx.transportMode
  };

  const scan = emptyScan({
    risk_categories: [
      cat({
        id: 'hmf',
        category: 'Harbor Maintenance Fee (0.125%)',
        verification_status: 'verified_applicable',
        source: {
          agency: 'CBP',
          name: 'U.S. Customs and Border Protection',
          title: 'Harbor Maintenance Fee',
          cfr_citation: '26 U.S.C. 4461; 19 CFR 24.24',
          url: 'https://www.cbp.gov',
          why_relevant: 'HMF on ocean cargo',
        },
        verified_rate_pct: 0.125,
      }),
    ],
    coverage_matrix: [cov('hmf', 'verified_applicable', 'hmf')],
  });

  test('fires CLARIFICATION_REQUIRED and downgrades HMF when transport mode is unknown', () => {
    const { passed, report, issues } = verifyScan(scan, {
      transportMode: null,   // unknown
      productFacts: factsNoMode,
    });
    expect(passed).toBe(false);
    expect(hasCode(issues, 'CLARIFICATION_REQUIRED')).toBe(true);
    const hmf = report.risk_categories.find((c) => c.id === 'hmf');
    expect(hmf?.verification_status).toBe('official_unconfirmed');
    // Clarification question must name the missing fact
    expect(report.clarification_questions).toBeDefined();
    const q = report.clarification_questions!.find((q) => q.fact_key === 'transport_mode');
    expect(q).toBeDefined();
    expect(q?.affects_finding_id).toBe('hmf');
    expect(q?.options).toBeDefined();
    expect(q!.options!.length).toBeGreaterThan(1);
  });

  test('approves HMF when transport mode is confirmed as ocean', () => {
    const { passed, issues } = verifyScan(scan, {
      transportMode: 'ocean',
      productFacts: factsNoMode,
    });
    expect(passed).toBe(true);
    expect(hasCode(issues, 'CLARIFICATION_REQUIRED')).toBe(false);
  });

  test('downgrades HMF via SCOPE_CONDITION_UNMET when transport mode is confirmed as air', () => {
    const { issues } = verifyScan(scan, {
      transportMode: 'air',
      productFacts: factsNoMode,
    });
    expect(hasCode(issues, 'SCOPE_CONDITION_UNMET')).toBe(true);
    expect(hasCode(issues, 'CLARIFICATION_REQUIRED')).toBe(false);
  });
});

// ── Test 26: Structured answers (knownFacts) override inference ───────────────
// When knownFacts provides a structured answer for a registry condition, the
// verifier uses it directly rather than inferring from product text or attrs.

describe('Test 26: knownFacts structured answers override description inference', () => {
  const baseFacts: ProductFacts = {
    htsDigits: '8507600020',
    productText: 'power bank',   // no "lithium" keyword in text
    originCountry: 'China',
    importDate: '2026-06-30',
    attrs: { has_battery: true, is_electronic: true, is_children: false },
  };

  const scan = emptyScan({
    risk_categories: [
      cat({
        id: 'phmsa_un383',
        category: 'PHMSA Lithium Battery Transport — UN 38.3',
        verification_status: 'verified_applicable',
        source: {
          agency: 'PHMSA',
          name: 'Pipeline and Hazardous Materials Safety Administration',
          title: '49 CFR 173.185',
          cfr_citation: '49 CFR 173.185',
          url: 'https://www.phmsa.dot.gov',
          why_relevant: 'Lithium battery transport rules',
        },
      }),
    ],
  });

  test('passes when knownFacts.battery_type confirms lithium-ion', () => {
    const { passed, issues } = verifyScan(scan, {
      productFacts: { ...baseFacts, knownFacts: { battery_type: 'lithium_ion' } },
    });
    expect(passed).toBe(true);
    expect(hasCode(issues, 'CLARIFICATION_REQUIRED')).toBe(false);
    expect(hasCode(issues, 'SCOPE_CONDITION_UNMET')).toBe(false);
  });

  test('fires SCOPE_CONDITION_UNMET when knownFacts.battery_type is alkaline (not lithium)', () => {
    const { issues } = verifyScan(scan, {
      productFacts: { ...baseFacts, knownFacts: { battery_type: 'alkaline' } },
    });
    expect(hasCode(issues, 'SCOPE_CONDITION_UNMET')).toBe(true);
  });

  test('fires CLARIFICATION_REQUIRED when battery_type is absent from knownFacts', () => {
    const { issues } = verifyScan(scan, {
      productFacts: baseFacts, // no knownFacts → battery_type unknown
    });
    expect(hasCode(issues, 'CLARIFICATION_REQUIRED')).toBe(true);
  });
});

// ── Test 27: Supplied import date used for effective-date checks ───────────────
// Expiry and min/max_import_date checks must use the user-supplied date, not today.

describe('Test 27: Supplied import date controls rule expiry and surcharge window', () => {
  // A rule active only during 2025-01-01 to 2025-12-31
  const temporaryRule: OfficialRuleRecord = {
    rule_id: 'test_temporary_surcharge',
    finding_id: 'test_temp_levy',
    agency: 'CBP',
    legal_citation: '9903.99.01',
    official_url: 'https://cbp.gov',
    supported_proposition: 'A temporary levy in effect only during calendar year 2025.',
    product_scope: 'All merchandise',
    scope_conditions: {
      min_import_date: '2025-01-01',
      max_import_date: '2025-12-31',
    },
    effective_date: '2025-01-01',
    legal_status: 'mandatory',
    timing: 'customs_clearance',
  };

  const scan = emptyScan({
    risk_categories: [
      cat({
        id: 'test_temp_levy',
        category: 'Temporary Import Levy 2025',
        verification_status: 'verified_applicable',
        source: {
          agency: 'CBP', name: 'CBP', title: 'Temporary Levy',
          cfr_citation: '9903.99.01', url: 'https://cbp.gov',
          why_relevant: 'Temporary levy',
        },
      }),
    ],
  });

  test('passes when user-supplied import date is within the active window', () => {
    const { passed, issues } = verifyScan(scan, {
      ruleRegistry: [temporaryRule],
      productFacts: { importDate: '2025-06-15' }, // within 2025
    });
    expect(passed).toBe(true);
    expect(hasCode(issues, 'SCOPE_CONDITION_UNMET')).toBe(false);
  });

  test('downgrades when user-supplied import date is before the effective date', () => {
    const { issues } = verifyScan(scan, {
      ruleRegistry: [temporaryRule],
      productFacts: { importDate: '2024-12-31' }, // before 2025-01-01
    });
    expect(hasCode(issues, 'SCOPE_CONDITION_UNMET')).toBe(true);
  });

  test('downgrades when user-supplied import date is after the expiry window', () => {
    const { issues } = verifyScan(scan, {
      ruleRegistry: [temporaryRule],
      productFacts: { importDate: '2026-06-30' }, // after 2025-12-31
    });
    expect(hasCode(issues, 'SCOPE_CONDITION_UNMET')).toBe(true);
  });
});

/**
 * Regression tests for post-verification synchronization.
 *
 * These tests guard six invariants from the boxing-gloves fix:
 *   1. Downgraded findings never leave "required" documents behind
 *   2. Verifier corrections propagate to checklist, obligations, counts, next steps
 *   3. Deduplication runs after verification (not only before)
 *   4. Part 303 (fiber content) and Part 423 (care label) are always separate documents
 *   5. Informational findings (not_applicable) stay visible in risk_categories
 *   6. postVerifySync preserves clarification_questions added by the verifier
 */

import { test, it, expect, describe } from 'bun:test';
import {
  finalizeScan,
  postVerifySync,
  documentsForFinding,
  type ScanResult,
} from '../services/riskScanner';
import type { RiskCategory } from '../types';

// ── Minimal scan scaffolding ──────────────────────────────────────────────────

function emptyScan(categories: RiskCategory[] = []): ScanResult {
  return {
    overall_risk: 'Low',
    overall_summary: '',
    risk_categories: categories,
    document_checklist: [],
    broker_questions: [],
    supplier_questions: [],
    next_actions: [],
    readiness_score: 60,
    obligations: [],
  };
}

function makeCategory(
  id: string,
  category: string,
  verification_status: RiskCategory['verification_status'],
  level: RiskCategory['level'] = 'Medium',
): RiskCategory {
  return {
    id,
    category,
    level,
    explanation: `test ${category}`,
    action: `test action for ${category}`,
    verification_status,
    source: {
      name: 'Test source',
      url: 'https://example.gov/test',
      agency: 'TEST',
      cfr_citation: '16 CFR 999',
    },
  };
}

// ── 1. Downgraded finding → no required document ──────────────────────────────

describe('postVerifySync — downgraded finding invariant', () => {
  it('removes "required" status from a document when its finding is downgraded from verified_applicable to official_unconfirmed', () => {
    // Build a scan where textile labeling is verified_applicable.
    const textileVerified = makeCategory(
      'ftc_textile_labeling',
      'FTC Textile Fiber Products Identification Act',
      'verified_applicable',
    );
    const finalized = finalizeScan(emptyScan(), [textileVerified], 'en');

    // Confirm checklist has a required document before downgrade.
    const beforeSync = finalized.document_checklist.find((d) =>
      d.document.toLowerCase().includes('303'),
    );
    expect(beforeSync?.required).toBe(true);

    // Simulate verifier downgrading the finding.
    const downgraded: ScanResult = {
      ...finalized,
      risk_categories: finalized.risk_categories.map((c) =>
        c.id === 'ftc_textile_labeling'
          ? { ...c, verification_status: 'official_unconfirmed' as const }
          : c,
      ),
    };

    const synced = postVerifySync(downgraded, undefined, null);

    const afterSync = synced.document_checklist.find((d) =>
      d.document.toLowerCase().includes('303'),
    );
    // Document must not be required after downgrade.
    expect(afterSync?.required).toBe(false);
    // Document must still appear in the checklist (for awareness), but as needs_confirmation.
    expect(afterSync?.status).toBe('needs_confirmation');
  });

  it('removes "required" status when finding is downgraded to insufficient_info', () => {
    const verified = makeCategory(
      'ftc_care_labeling',
      'FTC Care Labeling',
      'verified_applicable',
    );
    const finalized = finalizeScan(emptyScan(), [verified], 'en');

    const downgraded: ScanResult = {
      ...finalized,
      risk_categories: finalized.risk_categories.map((c) =>
        c.id === 'ftc_care_labeling'
          ? { ...c, verification_status: 'insufficient_info' as const }
          : c,
      ),
    };

    const synced = postVerifySync(downgraded, undefined, null);

    // insufficient_info finding → no supported category → document removed from checklist
    const careDoc = synced.document_checklist.find((d) =>
      d.document.toLowerCase().includes('423'),
    );
    expect(careDoc?.required).toBeFalsy();
  });
});

// ── 2. Corrections propagate to all derived fields ────────────────────────────

describe('postVerifySync — propagation to derived fields', () => {
  it('supplier_questions exclude a downgraded finding', () => {
    const verified = makeCategory(
      'ftc_textile_labeling',
      'FTC Textile Fiber Products Identification Act',
      'verified_applicable',
    );
    const finalized = finalizeScan(emptyScan(), [verified], 'en');

    // Before sync, supplier_questions mention the textile finding.
    const hasBefore = finalized.supplier_questions.some((q) =>
      q.toLowerCase().includes('textile'),
    );
    expect(hasBefore).toBe(true);

    const downgraded: ScanResult = {
      ...finalized,
      risk_categories: finalized.risk_categories.map((c) =>
        c.id === 'ftc_textile_labeling'
          ? { ...c, verification_status: 'official_unconfirmed' as const }
          : c,
      ),
    };
    const synced = postVerifySync(downgraded, undefined, null);

    // After sync, verified list is empty → no supplier questions for this finding.
    const hasAfter = synced.supplier_questions.some((q) =>
      q.toLowerCase().includes('textile'),
    );
    expect(hasAfter).toBe(false);
  });

  it('broker_questions include unconfirmed findings after downgrade', () => {
    const verified = makeCategory(
      'ftc_textile_labeling',
      'FTC Textile Fiber Products Identification Act',
      'verified_applicable',
    );
    const finalized = finalizeScan(emptyScan(), [verified], 'en');

    const downgraded: ScanResult = {
      ...finalized,
      risk_categories: finalized.risk_categories.map((c) =>
        c.id === 'ftc_textile_labeling'
          ? { ...c, verification_status: 'official_unconfirmed' as const }
          : c,
      ),
    };
    const synced = postVerifySync(downgraded, undefined, null);

    // Downgraded finding should surface as a broker question ("Does X apply?").
    const hasBrokerQ = synced.broker_questions.some((q) =>
      q.toLowerCase().includes('textile'),
    );
    expect(hasBrokerQ).toBe(true);
  });

  it('readiness_score decreases when verified findings are downgraded to unconfirmed', () => {
    const v1 = makeCategory('ftc_textile_labeling', 'FTC Textile Fiber Products Identification Act', 'verified_applicable');
    const v2 = makeCategory('ftc_care_labeling', 'FTC Care Labeling', 'verified_applicable');
    const finalized = finalizeScan(emptyScan(), [v1, v2], 'en');

    const allDowngraded: ScanResult = {
      ...finalized,
      risk_categories: finalized.risk_categories.map((c) => ({
        ...c,
        verification_status: 'official_unconfirmed' as const,
      })),
    };
    const synced = postVerifySync(allDowngraded, undefined, null);

    // unconfirmed items cost -4 each; verified items cost -7 each.
    // Before: 2 verified → readiness = 60 - 7*2 = 46.
    // After:  0 verified, 2 unconfirmed → readiness = 60 - 4*2 = 52.
    // So synced score should be HIGHER (less risk) than the original finalized score.
    expect(synced.readiness_score).toBeGreaterThan(finalized.readiness_score);
  });
});

// ── 3. Deduplication runs after verification ──────────────────────────────────

describe('postVerifySync — deduplication', () => {
  it('deduplicates obligations that become duplicates after verification corrections', () => {
    // Two categories with the same effective citation but different statuses
    // before verification.  After sync both have mandatory status → one obligation.
    const cat1 = makeCategory('ftc_textile_labeling', 'FTC Textile Fiber Products Identification Act', 'verified_applicable');
    const cat2: RiskCategory = {
      ...makeCategory('ftc_textile_labeling_duplicate', 'FTC Textile Fiber Products Identification Act', 'verified_applicable'),
      source: cat1.source,
    };
    const finalized = finalizeScan(emptyScan(), [cat1], 'en');

    // Inject a duplicate obligation manually (simulating two module paths).
    const withDup: ScanResult = {
      ...finalized,
      obligations: [
        ...(finalized.obligations ?? []),
        ...(finalized.obligations ?? []),
      ],
    };

    const synced = postVerifySync(withDup, undefined, null);

    // Obligations are rebuilt fresh by postVerifySync, so duplicates from the
    // injected obligations array do not survive — only the canonical set does.
    const ids = (synced.obligations ?? []).map((o) => o.obligation_id);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });
});

// ── 4. Part 303 and Part 423 never combined ───────────────────────────────────

describe('documentsForFinding — Part 303 / Part 423 separation', () => {
  it('ftc_textile_labeling produces only a Part 303 document, never care label', () => {
    const cat = makeCategory('ftc_textile_labeling', 'FTC Textile Fiber Products Identification Act', 'verified_applicable');
    const docs = documentsForFinding(cat);

    expect(docs.length).toBe(1);
    expect(docs[0].document).toContain('303');
    expect(docs[0].document).not.toContain('423');
    expect(docs[0].document).not.toContain('care');
  });

  it('ftc_care_labeling produces only a Part 423 document, never fiber content', () => {
    const cat = makeCategory('ftc_care_labeling', 'FTC Care Labeling', 'verified_applicable');
    const docs = documentsForFinding(cat);

    expect(docs.length).toBe(1);
    expect(docs[0].document).toContain('423');
    expect(docs[0].document).not.toContain('303');
    expect(docs[0].document).not.toContain('fiber');
  });

  it('a scan with both textile findings produces two distinct checklist items', () => {
    const cat303 = makeCategory('ftc_textile_labeling', 'FTC Textile Fiber Products Identification Act', 'verified_applicable');
    const cat423 = makeCategory('ftc_care_labeling', 'FTC Care Labeling', 'verified_applicable');

    const finalized = finalizeScan(emptyScan(), [cat303, cat423], 'en');

    const textileItems = finalized.document_checklist.filter(
      (d) => d.document.toLowerCase().includes('303') || d.document.toLowerCase().includes('423'),
    );
    expect(textileItems.length).toBe(2);

    const names = textileItems.map((d) => d.document);
    expect(names.some((n) => n.includes('303'))).toBe(true);
    expect(names.some((n) => n.includes('423'))).toBe(true);

    // No item should contain both citations.
    for (const item of textileItems) {
      expect(item.document.includes('303') && item.document.includes('423')).toBe(false);
    }
  });

  it('the legacy combined document name never appears', () => {
    const cat303 = makeCategory('ftc_textile_labeling', 'FTC Textile Fiber Products Identification Act', 'verified_applicable');
    const cat423 = makeCategory('ftc_care_labeling', 'FTC Care Labeling', 'verified_applicable');
    const finalized = finalizeScan(emptyScan(), [cat303, cat423], 'en');

    for (const d of finalized.document_checklist) {
      expect(d.document).not.toBe('Fiber content & care-labeling information (FTC 16 CFR 303)');
    }
  });

  it('downgraded textile findings produce required_if documents, not before_sale', () => {
    const cat = makeCategory('ftc_textile_labeling', 'FTC Textile Fiber Products Identification Act', 'official_unconfirmed');
    const docs = documentsForFinding(cat);

    expect(docs[0].doc_status).toBe('required_if');
    expect(docs[0].condition).toBeTruthy();
  });
});

// ── 5. Informational findings stay visible in risk_categories ─────────────────

describe('postVerifySync — informational findings preserved', () => {
  it('not_applicable findings remain in risk_categories after sync', () => {
    const mandatory = makeCategory(
      'ftc_textile_labeling',
      'FTC Textile Fiber Products Identification Act',
      'verified_applicable',
    );
    const informational: RiskCategory = {
      id: 'sports_combat_protective_no_federal',
      category: 'Sports equipment — adult combat/protective gear',
      level: 'N/A',
      explanation: 'No mandatory federal standard for adult boxing gloves.',
      action: '',
      verification_status: 'not_applicable',
    };

    const finalized = finalizeScan(emptyScan(), [mandatory, informational], 'en');

    // Simulate verifier correcting mandatory finding.
    const downgraded: ScanResult = {
      ...finalized,
      risk_categories: finalized.risk_categories.map((c) =>
        c.id === 'ftc_textile_labeling'
          ? { ...c, verification_status: 'official_unconfirmed' as const }
          : c,
      ),
    };

    const synced = postVerifySync(downgraded, undefined, null);

    const infoFinding = synced.risk_categories.find(
      (c) => c.id === 'sports_combat_protective_no_federal',
    );
    expect(infoFinding).toBeDefined();
    expect(infoFinding?.verification_status).toBe('not_applicable');
  });

  it('informational findings do NOT appear in document_checklist or obligations', () => {
    const informational: RiskCategory = {
      id: 'sports_combat_protective_no_federal',
      category: 'Sports equipment — adult combat/protective gear',
      level: 'N/A',
      explanation: 'No mandatory federal standard for adult boxing gloves.',
      action: '',
      verification_status: 'not_applicable',
    };

    const finalized = finalizeScan(emptyScan(), [informational], 'en');
    const synced = postVerifySync(finalized, undefined, null);

    // The checklist must be empty — informational findings carry no documents.
    expect(synced.document_checklist).toHaveLength(0);

    // Obligations for the informational finding must not be mandatory.
    const mandatoryObligation = (synced.obligations ?? []).find(
      (o) => o.status === 'mandatory',
    );
    expect(mandatoryObligation).toBeUndefined();
  });
});

// ── 6. clarification_questions preserved through sync ────────────────────────

describe('postVerifySync — clarification_questions preserved', () => {
  it('clarification_questions added by the verifier survive postVerifySync', () => {
    const cat = makeCategory(
      'ftc_textile_labeling',
      'FTC Textile Fiber Products Identification Act',
      'official_unconfirmed',
    );
    const finalized = finalizeScan(emptyScan(), [cat], 'en');

    const withQuestions: ScanResult = {
      ...finalized,
      clarification_questions: [
        {
          fact_key: 'is_textile',
          missing_info: 'Whether the product contains textile fibers',
          why_it_matters: 'Determines if FTC TFPIA fiber content labeling applies',
          affects_finding_id: 'ftc_textile_labeling',
          affects_category: 'FTC Textile Fiber Products Identification Act',
          options: [
            { value: 'yes', label: 'Yes, the product (or a component) contains textile fibers' },
            { value: 'no', label: 'No, the product is entirely non-textile' },
          ],
        },
      ],
    };

    const synced = postVerifySync(withQuestions, undefined, null);

    expect(synced.clarification_questions).toBeDefined();
    expect(synced.clarification_questions).toHaveLength(1);
    expect(synced.clarification_questions![0].fact_key).toBe('is_textile');
    expect(synced.clarification_questions![0].affects_finding_id).toBe('ftc_textile_labeling');
  });
});

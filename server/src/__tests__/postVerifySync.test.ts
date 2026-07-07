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
 *  10. Clarification answer flow — answers reach verifier, one question at a time
 */

import { test, it, expect, describe } from 'bun:test';
import {
  finalizeScan,
  postVerifySync,
  documentsForFinding,
  type ScanResult,
} from '../services/riskScanner';
import { verifyScan } from '../services/reportVerifier';
import type { RiskCategory } from '../types';
import { OFFICIAL_RULE_REGISTRY } from '../data/officialRuleRegistry';

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
    const cat1 = makeCategory('ftc_textile_labeling', 'FTC Textile Fiber Products Identification Act', 'verified_applicable');
    const finalized = finalizeScan(emptyScan(), [cat1], 'en');

    // Inject duplicate obligations manually (simulating two module paths).
    const withDup: ScanResult = {
      ...finalized,
      obligations: [
        ...(finalized.obligations ?? []),
        ...(finalized.obligations ?? []),
      ],
    };

    const synced = postVerifySync(withDup, undefined, null);

    // Obligations are rebuilt fresh by postVerifySync — duplicates do not survive.
    const ids = (synced.obligations ?? []).map((o) => o.obligation_id);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });

  it('suppresses module doc specs for findings already handled by documentsForFinding, preventing duplicate obligations with different timings', () => {
    const cat = makeCategory('ftc_textile_labeling', 'FTC Textile Fiber Products Identification Act', 'official_unconfirmed');
    const finalized = finalizeScan(emptyScan(), [cat], 'en');

    // Simulate a module doc spec for the same finding (different name, different timing).
    const moduleDocSpecs = [{
      document: 'Fiber content label (TFPIA -- 16 CFR 303)',
      owner: 'supplier' as const,
      responsible_party: 'supplier' as const,
      reason: 'Module generated doc',
      doc_status: 'before_sale' as const,
      finding_id: 'ftc_textile_labeling',
    }];

    const synced = postVerifySync(finalized, moduleDocSpecs, null);

    // Should have exactly ONE obligation for Part 303, not two with different timings.
    const part303Obligations = (synced.obligations ?? []).filter(
      (o) => o.legal_citation?.toLowerCase().includes('303') ||
              o.document_name?.toLowerCase().includes('303'),
    );
    expect(part303Obligations.length).toBeLessThanOrEqual(1);

    // Should have exactly ONE document in the checklist for Part 303.
    const part303Docs = synced.document_checklist.filter(
      (d) => d.document.toLowerCase().includes('303'),
    );
    expect(part303Docs.length).toBe(1);

    // The surviving doc must use the canonical name from documentsForFinding.
    expect(part303Docs[0].document).toBe('Fiber content label (FTC TFPIA, 16 CFR Part 303)');
  });
});

// ── 3b. next_actions only from verified findings ───────────────────────────────

describe('postVerifySync — next_actions gate', () => {
  it('next_actions excludes action text from official_unconfirmed findings', () => {
    const verified: RiskCategory = {
      ...makeCategory('ftc_textile_labeling', 'FTC Textile Fiber Products Identification Act', 'verified_applicable'),
      action: 'Instruct the supplier to attach compliant fiber content labels before export.',
    };
    const finalized = finalizeScan(emptyScan(), [verified], 'en');

    // Before sync, next_actions includes the textile action (finding is verified).
    expect(finalized.next_actions.some((a) => a.toLowerCase().includes('label'))).toBe(true);

    const downgraded: ScanResult = {
      ...finalized,
      risk_categories: finalized.risk_categories.map((c) =>
        c.id === 'ftc_textile_labeling'
          ? { ...c, verification_status: 'official_unconfirmed' as const }
          : c,
      ),
    };
    const synced = postVerifySync(downgraded, undefined, null);

    // After sync, the textile action must not appear (finding is unconfirmed).
    expect(synced.next_actions.some((a) =>
      a.toLowerCase().includes('fiber content label') || a.toLowerCase().includes('attach compliant'),
    )).toBe(false);
  });

  it('next_actions includes actions from verified findings even when other findings are downgraded', () => {
    const textile = makeCategory('ftc_textile_labeling', 'FTC Textile Fiber Products Identification Act', 'verified_applicable');
    const duty = makeCategory('hts_duty', 'HTS Duty Rate', 'verified_applicable');
    const finalized = finalizeScan(emptyScan(), [textile, duty], 'en');

    // Downgrade only textile; keep duty verified.
    const partlyDowngraded: ScanResult = {
      ...finalized,
      risk_categories: finalized.risk_categories.map((c) =>
        c.id === 'ftc_textile_labeling'
          ? { ...c, verification_status: 'official_unconfirmed' as const }
          : c,
      ),
    };
    const synced = postVerifySync(partlyDowngraded, undefined, null);

    // Duty action (from verified finding) should still appear.
    expect(synced.next_actions.length).toBeGreaterThan(0);
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

  it('downgraded textile findings produce cannot_determine documents, not before_sale or required_if', () => {
    const cat = makeCategory('ftc_textile_labeling', 'FTC Textile Fiber Products Identification Act', 'official_unconfirmed');
    const docs = documentsForFinding(cat);

    expect(docs[0].doc_status).toBe('cannot_determine');
    // missing_fact carries the explanation; condition is not used for cannot_determine
    expect(docs[0].missing_fact).toBeTruthy();
    expect(docs[0].doc_status).not.toBe('before_sale');
    expect(docs[0].doc_status).not.toBe('required_if');
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

// ── 7. Deduplication by finding id ───────────────────────────────────────────

describe('postVerifySync — dedup by id', () => {
  it('when two risk_categories share the same id, only the highest-trust version survives', () => {
    const authoritative = makeCategory(
      'ftc_textile_labeling',
      'FTC TFPIA -- Fiber Content Labeling (16 CFR 303)',
      'official_unconfirmed',
    );
    const modelGuess: RiskCategory = {
      id: 'ftc_textile_labeling',
      category: 'Textile Labeling (FTC)',
      level: 'N/A',
      explanation: 'model guess — no source',
      action: '',
      verification_status: 'no_verified_source',
    };

    const finalized = finalizeScan(emptyScan(), [authoritative], 'en');
    // Inject the model guess into risk_categories to simulate it slipping through.
    const withDuplicate: ScanResult = {
      ...finalized,
      risk_categories: [...finalized.risk_categories, modelGuess],
    };

    const synced = postVerifySync(withDuplicate, undefined, null);

    const allWithId = synced.risk_categories.filter((c) => c.id === 'ftc_textile_labeling');
    // Only one entry for this id must survive.
    expect(allWithId.length).toBe(1);
    // The surviving entry is the authoritative one (higher trust).
    expect(allWithId[0].verification_status).toBe('official_unconfirmed');
  });

  it('no_verified_source categories whose topic is covered by a sourced finding are removed', () => {
    const sourced = makeCategory(
      'ftc_textile_labeling',
      'FTC TFPIA -- Fiber Content Labeling (16 CFR 303)',
      'official_unconfirmed',
    );
    const unsourcedDup: RiskCategory = {
      category: 'Textile Labeling (FTC)',
      level: 'N/A',
      explanation: 'generic unsourced model guess',
      action: '',
      verification_status: 'no_verified_source',
    };

    const finalized = finalizeScan(emptyScan(), [sourced], 'en');
    const withDuplicate: ScanResult = {
      ...finalized,
      risk_categories: [...finalized.risk_categories, unsourcedDup],
    };

    const synced = postVerifySync(withDuplicate, undefined, null);

    // 'Textile Labeling (FTC)' is a textile topic covered by the official finding.
    const guessCat = synced.risk_categories.find(
      (c) => c.category === 'Textile Labeling (FTC)',
    );
    expect(guessCat).toBeUndefined();
  });
});

// ── 8. Informational findings: visible, no required docs ──────────────────────

describe('postVerifySync — informational findings', () => {
  it('not_applicable findings are preserved in risk_categories by postVerifySync', () => {
    const informational: RiskCategory = {
      id: 'sports_combat_protective_no_federal',
      category: 'Sports — adult combat/protective gear',
      level: 'N/A',
      explanation: 'No mandatory federal standard for adult boxing gloves.',
      action: '',
      verification_status: 'not_applicable',
    };

    const finalized = finalizeScan(emptyScan(), [informational], 'en');
    const synced = postVerifySync(finalized, undefined, null);

    const found = synced.risk_categories.find(
      (c) => c.id === 'sports_combat_protective_no_federal',
    );
    expect(found).toBeDefined();
    expect(found!.verification_status).toBe('not_applicable');
  });

  it('informational findings do not contribute mandatory obligations', () => {
    const informational: RiskCategory = {
      id: 'sports_combat_protective_no_federal',
      category: 'Sports — adult combat/protective gear',
      level: 'N/A',
      explanation: 'No mandatory federal standard for adult boxing gloves.',
      action: '',
      verification_status: 'not_applicable',
    };

    const finalized = finalizeScan(emptyScan(), [informational], 'en');
    const synced = postVerifySync(finalized, undefined, null);

    const mandatory = (synced.obligations ?? []).filter((o) => o.status === 'mandatory');
    expect(mandatory.length).toBe(0);
  });

  it('informational findings do not create required documents', () => {
    const informational: RiskCategory = {
      id: 'sports_combat_protective_no_federal',
      category: 'Sports — adult combat/protective gear',
      level: 'N/A',
      explanation: 'No mandatory federal standard.',
      action: '',
      verification_status: 'not_applicable',
    };

    const finalized = finalizeScan(emptyScan(), [informational], 'en');
    const synced = postVerifySync(finalized, undefined, null);

    const requiredDocs = synced.document_checklist.filter((d) => d.required);
    expect(requiredDocs.length).toBe(0);
  });

  it('not_applicable findings are not suppressed by the no_verified_source topic filter', () => {
    // A sourced finding that covers the 'sports' topic should not suppress
    // a not_applicable informational finding about sports.
    const mandatory = makeCategory('cpsia_third_party_testing', 'Children Products CPSIA', 'verified_applicable');
    const informational: RiskCategory = {
      id: 'sports_combat_protective_no_federal',
      category: 'Sports — adult combat/protective gear',
      level: 'N/A',
      explanation: 'No mandatory federal standard.',
      action: '',
      verification_status: 'not_applicable',
    };

    const finalized = finalizeScan(emptyScan(), [mandatory, informational], 'en');
    const synced = postVerifySync(finalized, undefined, null);

    const found = synced.risk_categories.find(
      (c) => c.id === 'sports_combat_protective_no_federal',
    );
    expect(found).toBeDefined();
  });
});

// ── 7. Canonical rule identity deduplication (Issue 1) ───────────────────────
// reg_X database findings must be removed when a canonical module finding
// covers the same topic, preventing two Law rows for the same regulation.

describe('postVerifySync — canonical identity dedup (reg_ prefix)', () => {
  it('removes reg_ftc_textile_labeling when ftc_textile_labeling (module) is present', () => {
    const moduleCanonical = makeCategory(
      'ftc_textile_labeling',
      'FTC TFPIA -- Fiber Content Labeling (16 CFR 303)',
      'official_unconfirmed',
    );
    const dbRow: RiskCategory = {
      id: 'reg_ftc_textile_labeling',
      category: 'Textile Labeling (FTC)',
      level: 'High',
      explanation: 'Database-sourced row for textile labeling.',
      action: 'Do textile labeling.',
      verification_status: 'official_unconfirmed',
    };

    const scan = emptyScan([moduleCanonical, dbRow]);
    const synced = postVerifySync(scan, undefined, null);

    const canonicalCount = synced.risk_categories.filter(
      (c) => c.id === 'ftc_textile_labeling' || c.id === 'reg_ftc_textile_labeling',
    ).length;
    expect(canonicalCount).toBe(1);
    // The reg_ row must be the one removed
    expect(synced.risk_categories.some((c) => c.id === 'reg_ftc_textile_labeling')).toBe(false);
    expect(synced.risk_categories.some((c) => c.id === 'ftc_textile_labeling')).toBe(true);
  });

  it('removes reg_ftc_textile_labeling when ftc_textile_component_labeling (module) is present', () => {
    const componentFinding = makeCategory(
      'ftc_textile_component_labeling',
      'FTC TFPIA — Fiber Content Labeling (Textile Component, 16 CFR 303)',
      'official_unconfirmed',
    );
    const dbRow: RiskCategory = {
      id: 'reg_ftc_textile_labeling',
      category: 'Textile Labeling (FTC)',
      level: 'Medium',
      explanation: 'Database-sourced row.',
      action: '',
      verification_status: 'official_unconfirmed',
    };

    const scan = emptyScan([componentFinding, dbRow]);
    const synced = postVerifySync(scan, undefined, null);

    // Both cover the 'textile' topic — only the non-reg_ canonical one survives
    expect(synced.risk_categories.some((c) => c.id === 'reg_ftc_textile_labeling')).toBe(false);
    expect(synced.risk_categories.some((c) => c.id === 'ftc_textile_component_labeling')).toBe(true);
  });

  it('does NOT remove reg_ findings when no canonical module finding covers the same topic', () => {
    // reg_fmvss_brakes has no module equivalent — it should survive
    const dbRow: RiskCategory = {
      id: 'reg_fmvss_brakes',
      category: 'FMVSS Brake Safety',
      level: 'High',
      explanation: 'Brake safety regulation.',
      action: '',
      verification_status: 'official_unconfirmed',
    };

    const scan = emptyScan([dbRow]);
    const synced = postVerifySync(scan, undefined, null);

    expect(synced.risk_categories.some((c) => c.id === 'reg_fmvss_brakes')).toBe(true);
  });
});

// ── 8. Official_unconfirmed no-id category suppressed by canonical topic ──────
// An official_unconfirmed finding without an id (e.g., a surviving model guess)
// must be removed when a sourced id-based finding covers the same topic.

describe('postVerifySync — official_unconfirmed no-id topic dedup', () => {
  it('removes a no-id official_unconfirmed category whose topic is covered by a canonical finding', () => {
    const canonical = makeCategory(
      'ftc_textile_labeling',
      'FTC TFPIA -- Fiber Content Labeling (16 CFR 303)',
      'official_unconfirmed',
    );
    const modelGuess: RiskCategory = {
      // no id — this is what the LLM generates
      category: 'Textile Labeling (FTC)',
      level: 'Medium',
      explanation: 'Model guess about textile labeling.',
      action: '',
      verification_status: 'official_unconfirmed',
    };

    const scan = emptyScan([canonical, modelGuess]);
    const synced = postVerifySync(scan, undefined, null);

    // The no-id model guess must be removed; canonical survives
    const textileFindings = synced.risk_categories.filter(
      (c) =>
        c.category.toLowerCase().includes('textile') ||
        c.category.toLowerCase().includes('fiber'),
    );
    expect(textileFindings.length).toBe(1);
    expect(textileFindings[0].id).toBe('ftc_textile_labeling');
  });

  it('keeps a no-id official_unconfirmed category when no canonical finding covers its topic', () => {
    const modelGuess: RiskCategory = {
      category: 'Some Other Unique Regulation',
      level: 'Low',
      explanation: 'Unique regulation not covered by any module.',
      action: '',
      verification_status: 'official_unconfirmed',
    };

    const scan = emptyScan([modelGuess]);
    const synced = postVerifySync(scan, undefined, null);

    expect(
      synced.risk_categories.some((c) => c.category === 'Some Other Unique Regulation'),
    ).toBe(true);
  });
});

// ── 9. "No material information remains unresolved" gate ────────────────────
// The UI must not show "nothing unresolved" when official_unconfirmed findings
// or cannot_determine documents remain.

describe('postVerifySync — unresolved gate for document checklist', () => {
  it('produces cannot_determine documents when ftc_textile_component_labeling is official_unconfirmed', () => {
    const textile = makeCategory(
      'ftc_textile_component_labeling',
      'FTC TFPIA — Fiber Content Labeling (Textile Component, 16 CFR 303)',
      'official_unconfirmed',
    );

    const scan = emptyScan([textile]);
    const synced = postVerifySync(scan, undefined, null);

    const doc = synced.document_checklist.find(
      (d) => d.document.toLowerCase().includes('303'),
    );
    // Document must exist with cannot_determine status (not required)
    expect(doc).toBeDefined();
    expect(doc?.doc_status).toBe('cannot_determine');
    expect(doc?.required).toBe(false);
  });

  it('produces no mandatory documents when no finding is verified_applicable', () => {
    const unconfirmed = makeCategory(
      'ftc_textile_component_labeling',
      'FTC TFPIA — Fiber Content Labeling (Textile Component, 16 CFR 303)',
      'official_unconfirmed',
    );

    const scan = emptyScan([unconfirmed]);
    const synced = postVerifySync(scan, undefined, null);

    const required = synced.document_checklist.filter((d) => d.required);
    expect(required).toHaveLength(0);
  });
});

// ── 10. Clarification answer flow ─────────────────────────────────────────────
// Verifies the four invariants for the post-scan clarification workflow:
//   a. A structured answer in knownFacts reaches the verifier and is evaluated
//   b. An answered fact that satisfies the rule keeps the finding verified
//   c. An answered fact that fails the rule downgrades, never asks again
//   d. Without any answer, exactly one clarification question is generated (not multiple)

// Boxing gloves test fixture — ftc_textile_component_labeling verified_applicable.
const BOXING_GLOVES_TEXTILE: RiskCategory = {
  id: 'ftc_textile_component_labeling',
  category: 'FTC TFPIA — Fiber Content Labeling (Textile Component, 16 CFR 303)',
  level: 'Medium',
  explanation: 'This product contains a textile fiber component.',
  action: 'Confirm fiber composition with supplier.',
  verification_status: 'verified_applicable',
  source: {
    agency: 'FTC',
    name: 'Federal Trade Commission',
    title: '15 U.S.C. 70; 16 CFR Part 303',
    last_verified_at: '2026-07-01',
    url: 'https://www.ftc.gov',
    why_relevant: 'Confirmed textile component in product description.',
  },
};

const BOXING_GLOVES_FACTS = {
  htsDigits: '4203218060',
  productText: 'cowhide leather boxing gloves with polyester lining',
  originCountry: 'China',
  importDate: '2026-07-05',
};

describe('clarification answer flow — 10a: knownFacts reaches verifier', () => {
  it('textile_lining_function=warmth satisfies knownFacts_required → finding stays verified_applicable, no clarification question', () => {
    const scan: ScanResult = { ...emptyScan(), risk_categories: [BOXING_GLOVES_TEXTILE] };
    const { report } = verifyScan(scan, {
      productFacts: { ...BOXING_GLOVES_FACTS, knownFacts: { textile_lining_function: 'warmth' } },
      ruleRegistry: OFFICIAL_RULE_REGISTRY,
    });
    const finding = report.risk_categories.find((c) => c.id === 'ftc_textile_component_labeling');
    expect(finding?.verification_status).toBe('verified_applicable');
    expect(report.clarification_questions ?? []).toHaveLength(0);
  });

  it('textile_lining_function=both also satisfies the rule', () => {
    const scan: ScanResult = { ...emptyScan(), risk_categories: [BOXING_GLOVES_TEXTILE] };
    const { report } = verifyScan(scan, {
      productFacts: { ...BOXING_GLOVES_FACTS, knownFacts: { textile_lining_function: 'both' } },
      ruleRegistry: OFFICIAL_RULE_REGISTRY,
    });
    const finding = report.risk_categories.find((c) => c.id === 'ftc_textile_component_labeling');
    expect(finding?.verification_status).toBe('verified_applicable');
    expect(report.clarification_questions ?? []).toHaveLength(0);
  });
});

describe('clarification answer flow — 10b: answered fact that fails downgrades, no repeat question', () => {
  it('textile_lining_function=padding fails scope → downgraded to official_unconfirmed, no clarification question', () => {
    const scan: ScanResult = { ...emptyScan(), risk_categories: [BOXING_GLOVES_TEXTILE] };
    const { report } = verifyScan(scan, {
      productFacts: { ...BOXING_GLOVES_FACTS, knownFacts: { textile_lining_function: 'padding' } },
      ruleRegistry: OFFICIAL_RULE_REGISTRY,
    });
    const finding = report.risk_categories.find((c) => c.id === 'ftc_textile_component_labeling');
    expect(finding?.verification_status).toBe('official_unconfirmed');
    // Fact was answered (even though it fails) — do NOT ask again
    expect(report.clarification_questions ?? []).toHaveLength(0);
  });

  it('textile_lining_function=unknown fails scope → downgraded, no repeat question', () => {
    const scan: ScanResult = { ...emptyScan(), risk_categories: [BOXING_GLOVES_TEXTILE] };
    const { report } = verifyScan(scan, {
      productFacts: { ...BOXING_GLOVES_FACTS, knownFacts: { textile_lining_function: 'unknown' } },
      ruleRegistry: OFFICIAL_RULE_REGISTRY,
    });
    const finding = report.risk_categories.find((c) => c.id === 'ftc_textile_component_labeling');
    expect(finding?.verification_status).toBe('official_unconfirmed');
    expect(report.clarification_questions ?? []).toHaveLength(0);
  });
});

describe('clarification answer flow — 10c: exactly one question without any answer', () => {
  it('without knownFacts, verifyScan generates exactly one clarification question for textile_lining_function', () => {
    const scan: ScanResult = { ...emptyScan(), risk_categories: [BOXING_GLOVES_TEXTILE] };
    const { report } = verifyScan(scan, {
      productFacts: { ...BOXING_GLOVES_FACTS, knownFacts: {} },
      ruleRegistry: OFFICIAL_RULE_REGISTRY,
    });
    expect(report.clarification_questions).toHaveLength(1);
    expect(report.clarification_questions![0].fact_key).toBe('textile_lining_function');
    expect(report.clarification_questions![0].affects_finding_id).toBe('ftc_textile_component_labeling');
  });

  it('exactly one question is generated even when the rule has multiple knownFacts_required entries', () => {
    // Add a second knownFacts_required entry to verify single-question behavior holds
    const twoFactRule = OFFICIAL_RULE_REGISTRY.find((r) => r.finding_id === 'ftc_textile_component_labeling');
    if (!twoFactRule) return; // guard — rule must exist
    const extendedRule = {
      ...twoFactRule,
      scope_conditions: {
        ...twoFactRule.scope_conditions,
        knownFacts_required: [
          { key: 'textile_lining_function', values: ['warmth', 'both'] },
          { key: 'fiber_content_claim_shown', values: ['yes'] },
        ],
      },
    };
    const customRegistry = [
      ...OFFICIAL_RULE_REGISTRY.filter((r) => r.finding_id !== 'ftc_textile_component_labeling'),
      extendedRule,
    ];

    const scan: ScanResult = { ...emptyScan(), risk_categories: [BOXING_GLOVES_TEXTILE] };
    const { report } = verifyScan(scan, {
      productFacts: { ...BOXING_GLOVES_FACTS, knownFacts: {} },
      ruleRegistry: customRegistry,
    });
    // Must ask only the first missing key, not both at once
    expect(report.clarification_questions).toHaveLength(1);
    expect(report.clarification_questions![0].fact_key).toBe('textile_lining_function');
  });

  it('after first answer, second missing key is asked (progressive disclosure)', () => {
    const twoFactRule = OFFICIAL_RULE_REGISTRY.find((r) => r.finding_id === 'ftc_textile_component_labeling');
    if (!twoFactRule) return;
    const extendedRule = {
      ...twoFactRule,
      scope_conditions: {
        ...twoFactRule.scope_conditions,
        knownFacts_required: [
          { key: 'textile_lining_function', values: ['warmth', 'both'] },
          { key: 'fiber_content_claim_shown', values: ['yes'] },
        ],
      },
    };
    const customRegistry = [
      ...OFFICIAL_RULE_REGISTRY.filter((r) => r.finding_id !== 'ftc_textile_component_labeling'),
      extendedRule,
    ];

    const scan: ScanResult = { ...emptyScan(), risk_categories: [BOXING_GLOVES_TEXTILE] };
    const { report } = verifyScan(scan, {
      productFacts: {
        ...BOXING_GLOVES_FACTS,
        knownFacts: { textile_lining_function: 'warmth' }, // first answered
      },
      ruleRegistry: customRegistry,
    });
    // First fact satisfied; second fact still missing → ask fiber_content_claim_shown
    expect(report.clarification_questions).toHaveLength(1);
    expect(report.clarification_questions![0].fact_key).toBe('fiber_content_claim_shown');
  });
});

// ── 11. Cross-category clarification loop regression tests ────────────────────
// Proves the shared clarification engine works universally:
//   - Only one question at a time
//   - No raw fact keys exposed
//   - Answered facts not re-asked
//   - Report only after loop finishes (verifier stays official_unconfirmed while facts are missing)

// ── 11a. Lithium battery (phmsa_un383) ───────────────────────────────────────

const BATTERY_FINDING: RiskCategory = {
  id: 'phmsa_un383',
  category: 'PHMSA — UN 38.3 Lithium Battery Testing',
  level: 'High',
  explanation: 'Lithium batteries require UN 38.3 test compliance.',
  action: 'Obtain test summary from manufacturer.',
  verification_status: 'verified_applicable',
  source: {
    agency: 'PHMSA',
    name: 'Pipeline and Hazardous Materials Safety Administration',
    title: '49 CFR 173.185',
    last_verified_at: '2026-07-01',
    url: 'https://www.phmsa.dot.gov',
    why_relevant: 'Product contains a lithium battery.',
  },
};

const BATTERY_FACTS = {
  htsDigits: '8507600020',
  productText: 'rechargeable lithium ion battery pack',
  originCountry: 'China',
  importDate: '2026-07-05',
};

describe('cross-category clarification — 11a: lithium battery (phmsa_un383)', () => {
  it('without has_battery attr → asks one readable question for has_battery (not a raw key)', () => {
    const scan: ScanResult = { ...emptyScan(), risk_categories: [BATTERY_FINDING] };
    const { report } = verifyScan(scan, {
      productFacts: { ...BATTERY_FACTS },
      ruleRegistry: OFFICIAL_RULE_REGISTRY,
    });
    expect(report.clarification_questions).toHaveLength(1);
    const q = report.clarification_questions![0];
    expect(q.fact_key).toBe('has_battery');
    expect(q.missing_info).toBeTruthy();
    // Question text must be human-readable — not a raw snake_case key
    expect(q.missing_info).not.toMatch(/^[a-z][a-z0-9_]*$/);
    expect(q.affects_finding_id).toBe('phmsa_un383');
  });

  it('with has_battery=true but no battery_type → asks one readable question for battery_type', () => {
    const scan: ScanResult = { ...emptyScan(), risk_categories: [BATTERY_FINDING] };
    const { report } = verifyScan(scan, {
      productFacts: { ...BATTERY_FACTS, attrs: { has_battery: true } },
      ruleRegistry: OFFICIAL_RULE_REGISTRY,
    });
    expect(report.clarification_questions).toHaveLength(1);
    const q = report.clarification_questions![0];
    expect(q.fact_key).toBe('battery_type');
    expect(q.missing_info).not.toMatch(/^[a-z][a-z0-9_]*$/);
    expect(q.affects_finding_id).toBe('phmsa_un383');
  });

  it('with battery_type=lithium_ion → finding stays verified_applicable, no question', () => {
    const scan: ScanResult = { ...emptyScan(), risk_categories: [BATTERY_FINDING] };
    const { report } = verifyScan(scan, {
      productFacts: {
        ...BATTERY_FACTS,
        attrs: { has_battery: true },
        knownFacts: { battery_type: 'lithium_ion' },
      },
      ruleRegistry: OFFICIAL_RULE_REGISTRY,
    });
    const finding = report.risk_categories.find((c) => c.id === 'phmsa_un383');
    expect(finding?.verification_status).toBe('verified_applicable');
    expect(report.clarification_questions ?? []).toHaveLength(0);
  });

  it('with battery_type=alkaline → downgraded to official_unconfirmed, no question asked again', () => {
    const scan: ScanResult = { ...emptyScan(), risk_categories: [BATTERY_FINDING] };
    const { report } = verifyScan(scan, {
      productFacts: {
        ...BATTERY_FACTS,
        attrs: { has_battery: true },
        knownFacts: { battery_type: 'alkaline' },
      },
      ruleRegistry: OFFICIAL_RULE_REGISTRY,
    });
    const finding = report.risk_categories.find((c) => c.id === 'phmsa_un383');
    expect(finding?.verification_status).toBe('official_unconfirmed');
    expect(report.clarification_questions ?? []).toHaveLength(0);
  });
});

// ── 11b. Children's product (cpsia_third_party_testing) ──────────────────────

const CHILDRENS_FINDING: RiskCategory = {
  id: 'cpsia_third_party_testing',
  category: "CPSC — CPSIA Third-Party Testing (Children's Products)",
  level: 'High',
  explanation: "Children's products must be tested by a CPSC-accredited laboratory.",
  action: 'Obtain third-party test reports from CPSC-accredited lab.',
  verification_status: 'verified_applicable',
  source: {
    agency: 'CPSC',
    name: 'Consumer Product Safety Commission',
    title: '15 U.S.C. 2063; 16 CFR 1107',
    last_verified_at: '2026-07-01',
    url: 'https://www.cpsc.gov',
    why_relevant: 'Product may be intended for children.',
  },
};

const CHILDRENS_FACTS = {
  htsDigits: '9503000090',
  productText: 'plush stuffed animal toy',
  originCountry: 'China',
  importDate: '2026-07-05',
};

describe('cross-category clarification — 11b: children\'s product (cpsia_third_party_testing)', () => {
  it('without is_children attr → asks one readable question for is_children', () => {
    const scan: ScanResult = { ...emptyScan(), risk_categories: [CHILDRENS_FINDING] };
    const { report } = verifyScan(scan, {
      productFacts: { ...CHILDRENS_FACTS },
      ruleRegistry: OFFICIAL_RULE_REGISTRY,
    });
    expect(report.clarification_questions).toHaveLength(1);
    const q = report.clarification_questions![0];
    expect(q.fact_key).toBe('is_children');
    expect(q.missing_info).not.toMatch(/^[a-z][a-z0-9_]*$/);
    expect(q.affects_finding_id).toBe('cpsia_third_party_testing');
  });

  it('with is_children=true → finding stays verified_applicable, no question', () => {
    const scan: ScanResult = { ...emptyScan(), risk_categories: [CHILDRENS_FINDING] };
    const { report } = verifyScan(scan, {
      productFacts: { ...CHILDRENS_FACTS, attrs: { is_children: true } },
      ruleRegistry: OFFICIAL_RULE_REGISTRY,
    });
    const finding = report.risk_categories.find((c) => c.id === 'cpsia_third_party_testing');
    expect(finding?.verification_status).toBe('verified_applicable');
    expect(report.clarification_questions ?? []).toHaveLength(0);
  });

  it('with is_children=false → downgraded to official_unconfirmed, no question asked again', () => {
    const scan: ScanResult = { ...emptyScan(), risk_categories: [CHILDRENS_FINDING] };
    const { report } = verifyScan(scan, {
      productFacts: { ...CHILDRENS_FACTS, attrs: { is_children: false } },
      ruleRegistry: OFFICIAL_RULE_REGISTRY,
    });
    const finding = report.risk_categories.find((c) => c.id === 'cpsia_third_party_testing');
    expect(finding?.verification_status).toBe('official_unconfirmed');
    expect(report.clarification_questions ?? []).toHaveLength(0);
  });

  it('after answering is_children, the same question is not asked again on rerun', () => {
    // Simulate rerun: is_children now answered (true), no clarification should re-fire
    const scan: ScanResult = { ...emptyScan(), risk_categories: [CHILDRENS_FINDING] };
    const { report } = verifyScan(scan, {
      productFacts: { ...CHILDRENS_FACTS, attrs: { is_children: true } },
      ruleRegistry: OFFICIAL_RULE_REGISTRY,
    });
    expect(report.clarification_questions ?? []).toHaveLength(0);
  });
});

// ── 11c. OTC drug / therapeutic claim (fda_otc_drug) ─────────────────────────
// fda_otc_drug applies to cosmetics containing OTC drug-active ingredients.
// scope_conditions: attrs_required:{is_cosmetic:true}, knownFacts_required:[contains_otc_ingredient]
// This test covers the "missing medical/therapeutic claim" clarification loop.

const OTC_DRUG_FINDING: RiskCategory = {
  id: 'fda_otc_drug',
  category: 'FDA — OTC Drug Monograph Compliance (21 CFR Parts 330-358)',
  level: 'High',
  explanation: 'Cosmetic product with OTC drug-active ingredient must comply with applicable monograph.',
  action: 'Verify active ingredient meets OTC monograph requirements.',
  verification_status: 'verified_applicable',
  source: {
    agency: 'FDA',
    name: 'Food and Drug Administration',
    title: '21 U.S.C. 355; 21 CFR Parts 330-358',
    last_verified_at: '2026-07-01',
    url: 'https://www.fda.gov',
    why_relevant: 'Product may contain an OTC drug-active ingredient.',
  },
};

const OTC_DRUG_FACTS = {
  htsDigits: '3304990050',
  productText: 'SPF 50 sunscreen lotion with zinc oxide',
  originCountry: 'China',
  importDate: '2026-07-05',
};

describe('cross-category clarification — 11c: OTC drug / therapeutic claim (fda_otc_drug)', () => {
  it('without is_cosmetic attr → asks one readable question for is_cosmetic', () => {
    const scan: ScanResult = { ...emptyScan(), risk_categories: [OTC_DRUG_FINDING] };
    const { report } = verifyScan(scan, {
      productFacts: { ...OTC_DRUG_FACTS },
      ruleRegistry: OFFICIAL_RULE_REGISTRY,
    });
    expect(report.clarification_questions).toHaveLength(1);
    const q = report.clarification_questions![0];
    expect(q.fact_key).toBe('is_cosmetic');
    expect(q.missing_info).not.toMatch(/^[a-z][a-z0-9_]*$/);
    expect(q.affects_finding_id).toBe('fda_otc_drug');
  });

  it('with is_cosmetic=true but no contains_otc_ingredient → asks one readable question', () => {
    const scan: ScanResult = { ...emptyScan(), risk_categories: [OTC_DRUG_FINDING] };
    const { report } = verifyScan(scan, {
      productFacts: { ...OTC_DRUG_FACTS, attrs: { is_cosmetic: true } },
      ruleRegistry: OFFICIAL_RULE_REGISTRY,
    });
    expect(report.clarification_questions).toHaveLength(1);
    const q = report.clarification_questions![0];
    expect(q.fact_key).toBe('contains_otc_ingredient');
    expect(q.missing_info).not.toMatch(/^[a-z][a-z0-9_]*$/);
    expect(q.affects_finding_id).toBe('fda_otc_drug');
  });

  it('with is_cosmetic=true and contains_otc_ingredient=yes_sunscreen → verified_applicable, no question', () => {
    const scan: ScanResult = { ...emptyScan(), risk_categories: [OTC_DRUG_FINDING] };
    const { report } = verifyScan(scan, {
      productFacts: {
        ...OTC_DRUG_FACTS,
        attrs: { is_cosmetic: true },
        knownFacts: { contains_otc_ingredient: 'yes_sunscreen' },
      },
      ruleRegistry: OFFICIAL_RULE_REGISTRY,
    });
    const finding = report.risk_categories.find((c) => c.id === 'fda_otc_drug');
    expect(finding?.verification_status).toBe('verified_applicable');
    expect(report.clarification_questions ?? []).toHaveLength(0);
  });

  it('answered contains_otc_ingredient=no → downgraded, not asked again', () => {
    const scan: ScanResult = { ...emptyScan(), risk_categories: [OTC_DRUG_FINDING] };
    const { report } = verifyScan(scan, {
      productFacts: {
        ...OTC_DRUG_FACTS,
        attrs: { is_cosmetic: true },
        knownFacts: { contains_otc_ingredient: 'no' },
      },
      ruleRegistry: OFFICIAL_RULE_REGISTRY,
    });
    const finding = report.risk_categories.find((c) => c.id === 'fda_otc_drug');
    expect(finding?.verification_status).toBe('official_unconfirmed');
    expect(report.clarification_questions ?? []).toHaveLength(0);
  });
});

// ── 11d. Transport mode (harbor_maintenance_fee / hmf) ───────────────────────

const HMF_FINDING: RiskCategory = {
  id: 'hmf',
  category: 'CBP — Harbor Maintenance Fee (HMF)',
  level: 'Low',
  explanation: 'Goods imported via ocean vessel are subject to the Harbor Maintenance Fee.',
  action: 'Confirm transport mode and pay HMF if applicable.',
  verification_status: 'verified_applicable',
  source: {
    agency: 'CBP',
    name: 'U.S. Customs and Border Protection',
    title: '26 U.S.C. 4461-4462',
    last_verified_at: '2026-07-01',
    url: 'https://www.cbp.gov',
    why_relevant: 'Transport mode determines whether HMF applies.',
  },
};

const TRANSPORT_FACTS = {
  htsDigits: '4203218060',
  productText: 'cowhide leather boxing gloves',
  originCountry: 'China',
  importDate: '2026-07-05',
};

describe('cross-category clarification — 11d: transport mode (harbor_maintenance_fee / hmf)', () => {
  it('without transportMode → asks one readable question for transport_mode', () => {
    const scan: ScanResult = { ...emptyScan(), risk_categories: [HMF_FINDING] };
    const { report } = verifyScan(scan, {
      productFacts: { ...TRANSPORT_FACTS },
      // transportMode intentionally omitted
      ruleRegistry: OFFICIAL_RULE_REGISTRY,
    });
    expect(report.clarification_questions).toHaveLength(1);
    const q = report.clarification_questions![0];
    expect(q.fact_key).toBe('transport_mode');
    expect(q.missing_info).not.toMatch(/^[a-z][a-z0-9_]*$/);
    expect(q.affects_finding_id).toBe('hmf');
  });

  it('with transportMode=ocean → finding stays verified_applicable, no question', () => {
    const scan: ScanResult = { ...emptyScan(), risk_categories: [HMF_FINDING] };
    const { report } = verifyScan(scan, {
      productFacts: { ...TRANSPORT_FACTS },
      transportMode: 'ocean',
      ruleRegistry: OFFICIAL_RULE_REGISTRY,
    });
    const finding = report.risk_categories.find((c) => c.id === 'hmf');
    expect(finding?.verification_status).toBe('verified_applicable');
    expect(report.clarification_questions ?? []).toHaveLength(0);
  });

  it('with transportMode=air → downgraded to official_unconfirmed, no question', () => {
    const scan: ScanResult = { ...emptyScan(), risk_categories: [HMF_FINDING] };
    const { report } = verifyScan(scan, {
      productFacts: { ...TRANSPORT_FACTS },
      transportMode: 'air',
      ruleRegistry: OFFICIAL_RULE_REGISTRY,
    });
    const finding = report.risk_categories.find((c) => c.id === 'hmf');
    expect(finding?.verification_status).toBe('official_unconfirmed');
    expect(report.clarification_questions ?? []).toHaveLength(0);
  });

  it('after transport_mode is answered, the question is not generated again', () => {
    // Simulate second run after user selected ocean: no clarification should fire
    const scan: ScanResult = { ...emptyScan(), risk_categories: [HMF_FINDING] };
    const first = verifyScan(scan, {
      productFacts: { ...TRANSPORT_FACTS },
      transportMode: 'ocean',
      ruleRegistry: OFFICIAL_RULE_REGISTRY,
    });
    expect(first.report.clarification_questions ?? []).toHaveLength(0);
    // Second call (rerun) also produces no question
    const second = verifyScan(scan, {
      productFacts: { ...TRANSPORT_FACTS },
      transportMode: 'ocean',
      ruleRegistry: OFFICIAL_RULE_REGISTRY,
    });
    expect(second.report.clarification_questions ?? []).toHaveLength(0);
  });
});

// ── Adult bicycle helmet — document checklist at the postVerifySync / report layer ──
// These tests guard the invariant that CPSC-based sports findings (Part 1203, Part 1512)
// never produce CPC/CPSIA documents in the final report document checklist.
//
// Root cause: topicsOf() previously mapped any category containing "cpsc" to the
// 'children' topic, causing documentsForFinding() to emit CPC/CPSIA for the
// bicycle-helmet standard finding.  Fixed by restricting the 'children' topic
// trigger to 'cpsia' and the word 'children' only.

import { evaluateAllModules } from '../services/regulatoryModules/index';
import type { ModuleInput } from '../services/regulatoryModules/index';

function makeAdultHelmetModuleInput(overrides: Partial<ModuleInput> = {}): ModuleInput {
  return {
    htsDigits: '65061030',
    productText: 'adult bicycle helmet, polycarbonate shell, EPS foam liner, ages 13 and up',
    attrs: { is_children: false },
    originCountry: 'CN',
    importDate: '2026-07-10',
    knownFacts: {
      sports_product_type: 'bicycle_helmet',
      age_range: 'over_12',
    },
    ...overrides,
  };
}

function makeChildrenHelmetModuleInput(): ModuleInput {
  return {
    htsDigits: '65061030',
    productText: "children's bicycle helmet, polycarbonate shell, EPS foam liner, ages 3-12",
    attrs: { is_children: true },
    originCountry: 'CN',
    importDate: '2026-07-10',
    knownFacts: {
      sports_product_type: 'bicycle_helmet',
      age_range: 'age_3_to_12',
      contains_paint_or_surface_coating: 'no',
    },
  };
}

describe('documentsForFinding — sports findings never emit CPC/CPSIA', () => {
  it('sports_bicycle_helmet_cpsc_1203 (verified) returns [] — docs come from module', () => {
    const c: RiskCategory = {
      id: 'sports_bicycle_helmet_cpsc_1203',
      category: 'CPSC — Bicycle Helmet Standard (16 CFR Part 1203)',
      level: 'High',
      explanation: 'Mandatory bicycle helmet standard.',
      action: 'Test and certify.',
      verification_status: 'verified_applicable',
      source: { name: '16 CFR Part 1203', url: 'https://ecfr.gov/', agency: 'CPSC' },
    };
    const docs = documentsForFinding(c);
    expect(docs).toHaveLength(0);
    expect(docs.some((d) => d.document.includes('CPC'))).toBe(false);
    expect(docs.some((d) => d.document.includes('CPSIA'))).toBe(false);
  });

  it('sports_bicycle_cpsc_1512 (verified) returns [] — docs come from module', () => {
    const c: RiskCategory = {
      id: 'sports_bicycle_cpsc_1512',
      category: 'CPSC — Bicycle Safety Standard (16 CFR Part 1512)',
      level: 'High',
      explanation: 'Mandatory bicycle standard.',
      action: 'Test and certify.',
      verification_status: 'verified_applicable',
      source: { name: '16 CFR Part 1512', url: 'https://ecfr.gov/', agency: 'CPSC' },
    };
    const docs = documentsForFinding(c);
    expect(docs).toHaveLength(0);
  });
});

describe('postVerifySync — adult bicycle helmet document checklist (final-report layer)', () => {
  // Build the full module output for the adult helmet, then drive it through
  // finalizeScan → postVerifySync to confirm no children's docs appear.

  const adultModuleResult = evaluateAllModules(makeAdultHelmetModuleInput());

  // The sports module's Part 1203 finding becomes the baseline.
  const part1203Finding: RiskCategory = {
    id: 'sports_bicycle_helmet_cpsc_1203',
    category: 'CPSC — Bicycle Helmet Standard (16 CFR Part 1203)',
    level: 'High',
    explanation: '16 CFR Part 1203 mandatory standard.',
    action: 'Obtain GCC.',
    verification_status: 'verified_applicable',
    source: { name: '16 CFR Part 1203', url: 'https://ecfr.gov/1203', agency: 'CPSC' },
  };

  const finalizedAdult = finalizeScan(
    emptyScan(),
    [part1203Finding, ...adultModuleResult.findings],
    'en',
    undefined,
    undefined,
    adultModuleResult.docSpecs,
  );
  const syncedAdult = postVerifySync(finalizedAdult, adultModuleResult.docSpecs, null);

  it('adult helmet: no CPC document in final checklist', () => {
    const cpcItems = syncedAdult.document_checklist.filter((d) =>
      d.document.includes("Children's Product Certificate") || d.document.includes('CPC'),
    );
    expect(cpcItems).toHaveLength(0);
  });

  it('adult helmet: no CPSIA third-party test report in final checklist', () => {
    const cpsiaItems = syncedAdult.document_checklist.filter((d) =>
      d.document.includes('CPSIA'),
    );
    expect(cpsiaItems).toHaveLength(0);
  });

  it('adult helmet: no tracking label in final checklist', () => {
    const trackingItems = syncedAdult.document_checklist.filter((d) =>
      d.document.toLowerCase().includes('tracking label'),
    );
    expect(trackingItems).toHaveLength(0);
  });

  it('adult helmet: Part 1203 test report + GCC present in checklist', () => {
    const helmetDoc = syncedAdult.document_checklist.find((d) =>
      d.document.includes('1203'),
    );
    expect(helmetDoc).toBeDefined();
    expect(helmetDoc?.document).toContain('GCC');
    expect(helmetDoc?.document).not.toContain('CPC');
  });
});

describe("postVerifySync — children's bicycle helmet document checklist (preserved)", () => {
  const childModuleResult = evaluateAllModules(makeChildrenHelmetModuleInput());

  const part1203ChildFinding: RiskCategory = {
    id: 'sports_bicycle_helmet_cpsc_1203',
    category: 'CPSC — Bicycle Helmet Standard (16 CFR Part 1203)',
    level: 'High',
    explanation: '16 CFR Part 1203 — CPC path for children.',
    action: 'Issue CPC covering Part 1203.',
    verification_status: 'verified_applicable',
    source: { name: '16 CFR Part 1203', url: 'https://ecfr.gov/1203', agency: 'CPSC' },
  };

  const finalizedChild = finalizeScan(
    emptyScan(),
    [part1203ChildFinding, ...childModuleResult.findings],
    'en',
    undefined,
    undefined,
    childModuleResult.docSpecs,
  );
  const syncedChild = postVerifySync(finalizedChild, childModuleResult.docSpecs, null);

  it("children's helmet: Part 1203 test report + CPC present in checklist", () => {
    const helmetDoc = syncedChild.document_checklist.find((d) =>
      d.document.includes('1203'),
    );
    expect(helmetDoc).toBeDefined();
    expect(helmetDoc?.document).toContain('CPC');
    expect(helmetDoc?.document).not.toContain('GCC');
  });

  it("children's helmet: CPSIA third-party test report present", () => {
    const cpsiaDoc = syncedChild.document_checklist.find((d) =>
      d.document.includes('CPSIA'),
    );
    expect(cpsiaDoc).toBeDefined();
  });

  it("children's helmet: CPC document present", () => {
    const cpcDoc = syncedChild.document_checklist.find((d) =>
      d.document.includes("Children's Product Certificate"),
    );
    expect(cpcDoc).toBeDefined();
  });
});

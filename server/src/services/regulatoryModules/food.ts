/**
 * Food & Beverage regulatory module.
 *
 * Covers:
 *   - FDA Prior Notice (21 CFR Part 1, Subpart I; 21 U.S.C. 381(m))
 *   - USDA/FSIS Inspection for meat, poultry, and egg products (9 CFR Parts 327, 381)
 *   - FDA Food Labeling (21 CFR Part 101)
 *
 * Detection: HTS chapters 01-24, food-related text, or food/supplement attrs.
 * Last rule-set verified: 2025-08-01.
 */

import type { RiskCategory, CoverageItem } from '../../types';
import type { RegulatoryModule, ModuleInput, ModuleResult, DocSpec, DynamicQuestion } from './index';

// ── Detection helpers ─────────────────────────────────────────────────────────

const FOOD_TEXT_RE =
  /\b(food|beverage|drink|edible|snack|meat|fish|seafood|poultry|dairy|cheese|milk|egg|fruit|vegetable|grain|cereal|bread|bakery|confectionery|candy|chocolate|juice|beer|wine|spirits|supplement|vitamin|protein.?powder)\b/i;

function isFoodHts(htsDigits: string): boolean {
  if (htsDigits.length < 2) return false;
  const chapter = parseInt(htsDigits.slice(0, 2), 10);
  return chapter >= 1 && chapter <= 24;
}

// ── Source citations ──────────────────────────────────────────────────────────

const FDA_PRIOR_NOTICE_SOURCE = {
  agency: 'FDA',
  name: '21 CFR Part 1 Subpart I -- Prior Notice of Imported Food',
  title: '21 CFR Part 1, Subpart I; 21 U.S.C. 381(m)',
  cfr_citation: '21 CFR Part 1, Subpart I',
  last_verified_at: '2025-08-01',
  url: 'https://www.fda.gov/food/importing-food/prior-notice-imported-food-guidance',
  why_relevant: 'All food (except USDA-FSIS regulated meat, poultry, and egg products) imported into the U.S. must have FDA prior notice submitted electronically before or at arrival.',
};

const FSIS_SOURCE = {
  agency: 'USDA/FSIS',
  name: '9 CFR Parts 327 and 381 -- Imported Meat and Poultry',
  title: '9 CFR Parts 327 and 381',
  cfr_citation: '9 CFR Parts 327, 381',
  last_verified_at: '2025-08-01',
  url: 'https://www.fsis.usda.gov/inspection/import-export/imports',
  why_relevant: 'Imported meat, poultry, and processed egg products must come from FSIS-certified foreign establishments and are subject to re-inspection at U.S. ports of entry.',
};

const FDA_LABELING_SOURCE = {
  agency: 'FDA',
  name: '21 CFR Part 101 -- Food Labeling',
  title: '21 CFR Part 101',
  cfr_citation: '21 CFR Part 101',
  last_verified_at: '2025-08-01',
  url: 'https://www.fda.gov/food/food-labeling-nutrition',
  why_relevant: 'Packaged food sold to consumers in the U.S. must bear FDA-compliant nutrition facts panels, ingredient statements, allergen declarations, and net quantity labeling.',
};

// ── Module ────────────────────────────────────────────────────────────────────

export const foodModule: RegulatoryModule = {
  id: 'food',
  name: 'Food, Beverage & Dietary Supplements',

  detects(input) {
    return (
      input.attrs.is_food_contact === true ||
      input.attrs.is_supplement === true ||
      isFoodHts(input.htsDigits) ||
      FOOD_TEXT_RE.test(input.productText)
    );
  },

  evaluate(input: ModuleInput): ModuleResult {
    const { knownFacts } = input;

    const findings: RiskCategory[] = [];
    const coverageDomains: CoverageItem[] = [];
    const docSpecs: DocSpec[] = [];
    const questions: DynamicQuestion[] = [];

    // ── Dynamic questions ─────────────────────────────────────────────────────

    questions.push({
      key: 'is_meat_or_poultry',
      module: 'food',
      question: 'Is this product meat, poultry, or an egg product?',
      options: [
        { value: 'yes_meat',    label: 'Yes -- red meat or game (beef, pork, lamb, venison, etc.)' },
        { value: 'yes_poultry', label: 'Yes -- poultry (chicken, turkey, duck, etc.)' },
        { value: 'yes_egg',     label: 'Yes -- processed egg products' },
        { value: 'no',          label: 'No' },
        { value: 'unknown',     label: 'Unknown' },
      ],
    });

    const isMeatOrPoultry = knownFacts['is_meat_or_poultry'];
    const isFsisProduct =
      isMeatOrPoultry === 'yes_meat' ||
      isMeatOrPoultry === 'yes_poultry' ||
      isMeatOrPoultry === 'yes_egg';

    if (isFsisProduct) {
      questions.push({
        key: 'has_usda_fsis_approval',
        module: 'food',
        question: 'Is the country of origin on the USDA FSIS list of approved countries for this product type?',
        options: [
          { value: 'yes',     label: 'Yes' },
          { value: 'no',      label: 'No' },
          { value: 'unknown', label: 'Unknown' },
        ],
        helpText: 'FSIS maintains separate country eligibility lists for beef, pork, poultry, and egg products. A country may be approved for one product type but not another.',
      });
    }

    // ── Finding: FDA Prior Notice ─────────────────────────────────────────────

    if (isFsisProduct) {
      findings.push({
        id: 'fda_prior_notice',
        category: 'FDA Prior Notice -- Not Applicable (FSIS-Regulated Product)',
        level: 'N/A',
        explanation: 'FDA Prior Notice (21 CFR Part 1, Subpart I) applies to food regulated by FDA. Meat, poultry, and egg products regulated by USDA-FSIS are exempt from FDA prior notice requirements. FSIS inspection requirements apply instead.',
        action: 'No FDA Prior Notice action required for this FSIS-regulated product.',
        verification_status: 'not_applicable',
        source: FDA_PRIOR_NOTICE_SOURCE,
      });

      coverageDomains.push({
        domain: 'FDA Prior Notice (21 CFR Part 1, Subpart I)',
        domain_key: 'fda_food',
        category: 'product_regulation',
        status: 'not_applicable',
        finding_id: 'fda_prior_notice',
        note: 'FSIS-regulated product; FDA Prior Notice does not apply.',
        official_url: FDA_PRIOR_NOTICE_SOURCE.url,
      });

    } else {
      // isMeatOrPoultry = 'no', 'unknown', or not answered
      findings.push({
        id: 'fda_prior_notice',
        category: 'FDA Prior Notice (21 CFR Part 1, Subpart I)',
        level: 'High',
        explanation: 'All food (except meat, poultry, and egg products regulated by USDA-FSIS) must submit FDA Prior Notice before or at the time of import (21 U.S.C. 381(m); 21 CFR Part 1, Subpart I). Prior notice must be submitted electronically via the FDA Prior Notice System Interface (PNSI) or through a U.S. Customs Automated Broker Interface (ABI).',
        action: 'Submit FDA Prior Notice via the FDA PNSI system or through your customs broker before or at the time of import. Prior notice must be confirmed (receipt number obtained) before the food arrives at the U.S. port of entry.',
        verification_status: 'verified_applicable',
        applicability_conditions: 'All FDA-regulated food imports -- does not apply if the product is meat, poultry, or a processed egg product regulated by USDA-FSIS.',
        source: FDA_PRIOR_NOTICE_SOURCE,
      });

      coverageDomains.push({
        domain: 'FDA Prior Notice (21 CFR Part 1, Subpart I)',
        domain_key: 'fda_food',
        category: 'product_regulation',
        status: 'verified_applicable',
        finding_id: 'fda_prior_notice',
        note: 'Prior notice receipt number required before or at port of entry.',
        official_url: FDA_PRIOR_NOTICE_SOURCE.url,
      });

      docSpecs.push({
        document: 'FDA Prior Notice receipt number / confirmation',
        owner: 'importer_broker',
        responsible_party: 'customs_broker',
        reason: 'FDA Prior Notice must be submitted and confirmed (receipt number obtained) before the food shipment arrives at the U.S. port of entry (21 CFR Part 1, Subpart I).',
        doc_status: 'required_to_clear',
        finding_id: 'fda_prior_notice',
      });
    }

    // ── Finding: USDA/FSIS Inspection ─────────────────────────────────────────

    if (isFsisProduct) {
      findings.push({
        id: 'fda_fsis_inspection',
        category: 'USDA/FSIS Import Inspection (9 CFR Parts 327 and 381)',
        level: 'High',
        explanation: 'Imported meat, poultry, and processed egg products must come from FSIS-certified establishments in countries on the USDA-FSIS approved list for that product type. Each shipment is subject to re-inspection at a USDA-approved port of entry (9 CFR Part 327 / Part 381). FSIS inspection is a prerequisite for entry into U.S. commerce.',
        action: 'Verify that the exporting country and establishment are on the FSIS import approval list. Ensure the shipment is consigned to a USDA-approved port where FSIS re-inspection will occur. Retain foreign government inspection certificates.',
        verification_status: 'verified_applicable',
        applicability_conditions: 'Product is meat, poultry, or processed egg product -- confirmed by respondent.',
        source: FSIS_SOURCE,
      });

      coverageDomains.push({
        domain: 'USDA/FSIS Import Inspection (9 CFR Parts 327, 381)',
        domain_key: 'fda_fsis',
        category: 'product_regulation',
        status: 'verified_applicable',
        finding_id: 'fda_fsis_inspection',
        note: 'FSIS re-inspection required at a USDA-approved port of entry.',
        official_url: FSIS_SOURCE.url,
      });

      docSpecs.push({
        document: 'Foreign government health/inspection certificate',
        owner: 'supplier',
        responsible_party: 'supplier',
        reason: 'Foreign government certificate from the exporting country official establishment is required to accompany meat, poultry, and egg product shipments for FSIS re-inspection.',
        doc_status: 'required_to_clear',
        condition: 'Product is meat, poultry, or processed egg product subject to FSIS re-inspection.',
        finding_id: 'fda_fsis_inspection',
      });

      docSpecs.push({
        document: 'USDA/FSIS Import Inspection certificate',
        owner: 'importer_broker',
        responsible_party: 'customs_broker',
        reason: 'FSIS issues an import inspection certificate after re-inspection at the U.S. port of entry; this document is required to release the shipment into U.S. commerce.',
        doc_status: 'required_to_clear',
        condition: 'Product is meat, poultry, or processed egg product subject to FSIS re-inspection.',
        finding_id: 'fda_fsis_inspection',
      });

    } else if (isMeatOrPoultry === 'unknown' || isMeatOrPoultry === undefined) {
      findings.push({
        id: 'fda_fsis_inspection',
        category: 'USDA/FSIS Import Inspection (9 CFR Parts 327 and 381)',
        level: 'High',
        explanation: 'USDA/FSIS import inspection applies to meat, poultry, and processed egg products. Whether this product falls under FSIS jurisdiction has not been confirmed.',
        action: 'Confirm whether this product is meat, poultry, or a processed egg product. If it is, ensure it comes from an FSIS-approved country and establishment, and arrange delivery to a USDA-approved port.',
        verification_status: 'insufficient_info',
        missing_info: 'Whether the product is meat, poultry, or an egg product (these are regulated by USDA-FSIS, not FDA).',
        source: FSIS_SOURCE,
      });

      coverageDomains.push({
        domain: 'USDA/FSIS Import Inspection (9 CFR Parts 327, 381)',
        domain_key: 'fda_fsis',
        category: 'product_regulation',
        status: 'insufficient_info',
        finding_id: 'fda_fsis_inspection',
        missing_facts: ['whether the product is meat, poultry, or a processed egg product'],
        official_url: FSIS_SOURCE.url,
      });

      docSpecs.push({
        document: 'Foreign government health/inspection certificate',
        owner: 'supplier',
        responsible_party: 'supplier',
        reason: 'Required for FSIS-regulated meat/poultry/eggs; usually requested by FDA for other regulated food.',
        doc_status: 'required_if',
        condition: 'Required for FSIS-regulated meat/poultry/eggs; usually requested by FDA for other regulated food.',
        finding_id: 'fda_fsis_inspection',
      });

    } else {
      // isMeatOrPoultry = 'no'
      findings.push({
        id: 'fda_fsis_inspection',
        category: 'USDA/FSIS Import Inspection (9 CFR Parts 327 and 381)',
        level: 'N/A',
        explanation: 'USDA/FSIS inspection requirements apply only to meat, poultry, and processed egg products. This product has been confirmed as not meat, poultry, or egg product; FSIS does not apply.',
        action: 'No FSIS inspection action required for this product.',
        verification_status: 'not_applicable',
        source: FSIS_SOURCE,
      });

      coverageDomains.push({
        domain: 'USDA/FSIS Import Inspection (9 CFR Parts 327, 381)',
        domain_key: 'fda_fsis',
        category: 'product_regulation',
        status: 'not_applicable',
        finding_id: 'fda_fsis_inspection',
        note: 'Confirmed not meat, poultry, or egg product; FSIS does not apply.',
      });

      docSpecs.push({
        document: 'Foreign government health/inspection certificate',
        owner: 'supplier',
        responsible_party: 'supplier',
        reason: 'Usually requested by FDA for regulated food shipments even when FSIS does not apply.',
        doc_status: 'required_if',
        condition: 'Required for FSIS-regulated meat/poultry/eggs; usually requested by FDA for other regulated food.',
        finding_id: 'fda_fsis_inspection',
      });
    }

    // ── Finding: FDA Food Labeling ────────────────────────────────────────────

    findings.push({
      id: 'fda_food_labeling',
      category: 'FDA Food Labeling (21 CFR Part 101)',
      level: 'Medium',
      explanation: 'Packaged food sold to consumers in the U.S. requires FDA-compliant nutrition facts panels, ingredient statements, allergen declarations (FALCPA; FASTER Act), and net quantity labeling (21 CFR Part 101). Confirm whether the product is sold in consumer packaging before import.',
      action: 'Confirm whether the product is sold in consumer-facing packaging. If so, ensure the product label complies with 21 CFR Part 101, including nutrition facts, ingredient list, major food allergen declarations, and net quantity.',
      verification_status: 'official_unconfirmed',
      applicability_conditions: 'Applies to packaged food sold directly to consumers; bulk/food-service shipments have different requirements. Retail vs. bulk use must be confirmed.',
      source: FDA_LABELING_SOURCE,
    });

    coverageDomains.push({
      domain: 'FDA Food Labeling (21 CFR Part 101)',
      domain_key: 'fda_food_labeling',
      category: 'product_regulation',
      status: 'official_unconfirmed',
      finding_id: 'fda_food_labeling',
      note: 'Labeling compliance must be confirmed for consumer-packaged food.',
      missing_facts: ['whether the product is sold in consumer-facing retail packaging'],
      official_url: FDA_LABELING_SOURCE.url,
    });

    return { findings, coverageDomains, docSpecs, questions };
  },
};

/**
 * Children's products regulatory module.
 *
 * Covers:
 *   - CPSIA third-party testing (16 U.S.C. 1278a / 16 CFR 1110)
 *   - Children's Product Certificate (CPC) (16 CFR 1110)
 *   - ASTM F963 Toy Safety Standard (16 CFR 1250)
 *   - Lead content limits (CPSIA Section 101 / 16 CFR 1303)
 *
 * Detection mirrors categoryDetector.ts 'childrens' logic.
 * Last rule-set verified: 2025-08-01.
 */

import type { RiskCategory, CoverageItem } from '../../types';
import type { RegulatoryModule, ModuleInput, ModuleResult, DocSpec, DynamicQuestion } from './index';

// ── Detection helpers ─────────────────────────────────────────────────────────

const CHILDRENS_HTS_PREFIXES = ['9501', '9502', '9503', '9504', '9505'];

const CHILDRENS_TEXT_RE =
  /\b(toy|doll|game|children|child|kids|infant|toddler|juvenile|baby|nursery|playpen|stroller|crib)\b/i;

const TOY_TEXT_RE = /\btoy\b/i;

// ── Module ────────────────────────────────────────────────────────────────────

export const childrensModule: RegulatoryModule = {
  id: 'childrens',
  name: "Children's Products / Toys",

  detects(input) {
    const h = input.htsDigits;
    return (
      input.attrs.is_children === true ||
      CHILDRENS_HTS_PREFIXES.some((p) => h.startsWith(p)) ||
      CHILDRENS_TEXT_RE.test(input.productText)
    );
  },

  evaluate(input: ModuleInput): ModuleResult {
    const { htsDigits: h, productText, attrs, knownFacts } = input;

    const findings: RiskCategory[] = [];
    const coverageDomains: CoverageItem[] = [];
    const docSpecs: DocSpec[] = [];
    const questions: DynamicQuestion[] = [];

    // ── Dynamic questions ─────────────────────────────────────────────────────

    questions.push({
      key: 'age_range',
      module: 'childrens',
      question: 'What is the intended age range for this product?',
      options: [
        { value: 'under_3',      label: 'Under 3 years' },
        { value: 'age_3_to_12',  label: 'Ages 3-12' },
        { value: 'over_12',      label: 'Ages 13 and up' },
        { value: 'unknown',      label: 'Unknown' },
      ],
    });

    questions.push({
      key: 'contains_paint_or_surface_coating',
      module: 'childrens',
      question: 'Does the product have any paint, surface coating, or dye applied?',
      options: [
        { value: 'yes',     label: 'Yes' },
        { value: 'no',      label: 'No' },
        { value: 'unknown', label: 'Unknown' },
      ],
    });

    // ── Derived facts ─────────────────────────────────────────────────────────

    const ageRange    = knownFacts['age_range'];
    const hasCoating  = knownFacts['contains_paint_or_surface_coating'];
    const isChildren  = attrs.is_children === true;
    const isToy       = h.startsWith('9503') || TOY_TEXT_RE.test(productText);

    // "children's product confirmed" when attrs flag, or age range under 12
    const childrenConfirmed =
      isChildren ||
      ageRange === 'under_3' ||
      ageRange === 'age_3_to_12';

    const childrenDefinitelyNot = ageRange === 'over_12';

    // ── Sources ───────────────────────────────────────────────────────────────

    const cpsia_source_base = {
      agency: 'CPSC',
      name: '16 CFR Part 1110 -- Third-Party Testing and Certification',
      cfr_citation: '16 CFR Part 1110',
      last_verified_at: '2025-08-01',
      url: 'https://www.cpsc.gov/Business--Manufacturing/Testing-Certification/Third-Party-Testing',
      why_relevant: 'CPSIA Section 102 mandates third-party testing and certification for all children\'s products before they are imported or sold in the United States.',
    };

    // ── CPSIA Third-Party Testing ─────────────────────────────────────────────

    if (childrenDefinitelyNot) {
      findings.push({
        id: 'cpsia_third_party_testing',
        category: 'CPSIA -- Third-Party Testing (16 CFR 1110)',
        level: 'N/A',
        explanation: 'CPSIA Section 102 third-party testing requirements apply to children\'s products designed or intended primarily for children 12 and under. Products for ages 13 and up are not subject to this requirement.',
        action: 'No CPSIA third-party testing is required for products intended for ages 13 and up.',
        verification_status: 'not_applicable',
        source: { ...cpsia_source_base, title: 'CPSIA Third-Party Testing -- Not Applicable (Age 13+)' },
      });
    } else if (childrenConfirmed) {
      findings.push({
        id: 'cpsia_third_party_testing',
        category: 'CPSIA -- Third-Party Testing (16 CFR 1110)',
        level: 'Critical',
        explanation: 'Children\'s products (designed or intended primarily for children 12 and under) must be tested by a CPSC-accepted third-party laboratory and comply with all applicable children\'s product safety rules before import. This is a mandatory requirement under CPSIA Section 102.',
        action: 'Obtain accredited third-party test reports from the manufacturer covering all applicable CPSC regulations before import. Do not import without passing test results.',
        verification_status: 'verified_applicable',
        applicability_conditions: 'Product is or is intended for children 12 and under (attrs.is_children = true or age_range = under_3 or age_3_to_12).',
        source: { ...cpsia_source_base, title: 'CPSIA Section 102 -- Third-Party Testing for Children\'s Products' },
      });

      docSpecs.push({
        document: 'CPSC-accredited third-party test reports (CPSIA)',
        owner: 'supplier',
        responsible_party: 'supplier',
        reason: 'CPSIA Section 102 requires that children\'s products be tested by a CPSC-accepted third-party laboratory before importation.',
        doc_status: 'required_to_clear',
        finding_id: 'cpsia_third_party_testing',
      });
    } else {
      // age_range unknown and attrs.is_children = false
      findings.push({
        id: 'cpsia_third_party_testing',
        category: 'CPSIA -- Third-Party Testing (16 CFR 1110)',
        level: 'Medium',
        explanation: 'CPSIA Section 102 requires third-party testing for any product designed or intended primarily for children 12 and under. Whether this product qualifies cannot be determined without knowing the intended age range.',
        action: 'Clarify the intended age range for this product. If it is intended for children 12 and under, obtain CPSC-accredited third-party test reports before import.',
        verification_status: 'insufficient_info',
        missing_info: 'Intended age range (if the product is for children under 12, CPSIA third-party testing is required).',
        source: { ...cpsia_source_base, title: 'CPSIA Third-Party Testing -- Age Range Unknown' },
      });
    }

    // ── Children's Product Certificate (CPC) ──────────────────────────────────

    const cpc_source = {
      agency: 'CPSC',
      name: '16 CFR Part 1110 -- Children\'s Product Certificate',
      title: 'Children\'s Product Certificate (CPC)',
      cfr_citation: '16 CFR Part 1110',
      last_verified_at: '2025-08-01',
      url: 'https://www.cpsc.gov/Business--Manufacturing/Testing-Certification/childrens-product-certificate',
      why_relevant: 'The U.S. importer of record must issue a CPC based on passing third-party test results before the product is sold or distributed in the United States.',
    };

    if (childrenDefinitelyNot) {
      findings.push({
        id: 'cpsia_cpc',
        category: 'CPSIA -- Children\'s Product Certificate (16 CFR 1110)',
        level: 'N/A',
        explanation: 'A Children\'s Product Certificate is only required for children\'s products (intended for ages 12 and under). This product is intended for ages 13 and up.',
        action: 'No CPC is required.',
        verification_status: 'not_applicable',
        source: cpc_source,
      });
    } else if (childrenConfirmed) {
      findings.push({
        id: 'cpsia_cpc',
        category: 'CPSIA -- Children\'s Product Certificate (16 CFR 1110)',
        level: 'Critical',
        explanation: 'The U.S. importer of record must issue a Children\'s Product Certificate (CPC) based on the passing third-party test reports. The CPC must be furnished to distributors and retailers and must be available to CBP upon request.',
        action: 'The importer (not the supplier) issues the CPC. Prepare the CPC after receiving passing third-party test reports. The CPC must list the applicable CPSC regulations and the testing laboratory.',
        verification_status: 'verified_applicable',
        applicability_conditions: 'Product is or is intended for children 12 and under.',
        source: cpc_source,
      });

      docSpecs.push({
        document: 'Children\'s Product Certificate (CPC)',
        owner: 'importer_broker',
        responsible_party: 'importer',
        reason: 'The U.S. importer of record must issue the CPC based on passing third-party test reports and must make it available to CBP and distributors.',
        doc_status: 'required_to_clear',
        finding_id: 'cpsia_cpc',
      });
    } else {
      findings.push({
        id: 'cpsia_cpc',
        category: 'CPSIA -- Children\'s Product Certificate (16 CFR 1110)',
        level: 'Medium',
        explanation: 'A Children\'s Product Certificate is required for any product intended for children 12 and under. Whether this product requires a CPC cannot be determined without knowing the intended age range.',
        action: 'Clarify the intended age range. If the product is for children 12 and under, the importer must issue a CPC based on passing third-party test reports.',
        verification_status: 'insufficient_info',
        missing_info: 'Intended age range (if the product is for children under 12, a CPC is required).',
        source: cpc_source,
      });
    }

    // ── ASTM F963 Toy Safety ──────────────────────────────────────────────────

    if (isToy) {
      findings.push({
        id: 'cpsc_toy_f963',
        category: 'ASTM F963 -- Toy Safety Standard (16 CFR 1250)',
        level: 'Critical',
        explanation: 'ASTM F963 (Standard Consumer Safety Specification for Toy Safety) is mandatory for toys in the U.S. under CPSIA Section 106 (16 CFR Part 1250). The toy must meet all applicable requirements including mechanical/physical properties, flammability, electrical safety, heavy elements, and age-grade labeling.',
        action: 'Obtain ASTM F963 test reports from the manufacturer covering all applicable provisions. Confirm the toy bears required age-grading labeling.',
        verification_status: 'verified_applicable',
        applicability_conditions: 'HTS heading 9503 or product text contains the word "toy".',
        source: {
          agency: 'CPSC',
          name: '16 CFR Part 1250 / ASTM F963',
          title: 'ASTM F963 -- Standard Consumer Safety Specification for Toy Safety',
          cfr_citation: '16 CFR Part 1250',
          last_verified_at: '2025-08-01',
          url: 'https://www.cpsc.gov/Regulations-Laws--Standards/CPSC-Regulations-Laws-and-Standards/Rulemaking/Final-and-Proposed-Rules/Toy-Safety',
          why_relevant: 'CPSIA Section 106 makes ASTM F963 mandatory for all toys intended for children under 14.',
        },
      });

      docSpecs.push({
        document: 'ASTM F963 test report',
        owner: 'supplier',
        responsible_party: 'supplier',
        reason: 'CPSIA Section 106 mandates ASTM F963 compliance; the test report from a CPSC-accepted laboratory must be on file before importation.',
        doc_status: 'required_to_clear',
        finding_id: 'cpsc_toy_f963',
      });
    } else if (childrenConfirmed || (!childrenDefinitelyNot && !ageRange)) {
      // Product is a children's item but we cannot confirm toy status from HTS/text
      docSpecs.push({
        document: 'ASTM F963 test report',
        owner: 'supplier',
        responsible_party: 'supplier',
        reason: 'If this product is a toy under CPSIA Section 106, ASTM F963 test reports are required before importation.',
        doc_status: 'required_if',
        condition: 'product is a toy (HTS 9503 or marketed as toy)',
        finding_id: 'cpsc_toy_f963',
      });
    }

    // ── Lead Content (CPSIA Section 101 / 16 CFR 1303) ───────────────────────

    const lead_source = {
      agency: 'CPSC',
      name: '16 CFR Part 1303 -- Ban of Lead-Containing Paint',
      title: 'CPSIA Section 101 -- Lead Content Limits for Children\'s Products',
      cfr_citation: '16 CFR Part 1303',
      last_verified_at: '2025-08-01',
      url: 'https://www.cpsc.gov/Business--Manufacturing/Business-Education/Lead/Lead-in-Children-s-Products',
      why_relevant: 'CPSIA Section 101 limits substrate lead to 100 ppm and paint/surface coatings to 90 ppm in children\'s products.',
    };

    if (childrenDefinitelyNot) {
      findings.push({
        id: 'cpsia_lead',
        category: 'CPSIA -- Lead Content (16 CFR 1303)',
        level: 'N/A',
        explanation: 'CPSIA lead content limits apply to children\'s products (ages 12 and under). This product is for ages 13 and up.',
        action: 'No CPSIA lead content testing is required.',
        verification_status: 'not_applicable',
        source: lead_source,
      });
    } else if (childrenConfirmed && hasCoating === 'yes') {
      findings.push({
        id: 'cpsia_lead',
        category: 'CPSIA -- Lead Content (16 CFR 1303)',
        level: 'High',
        explanation: 'Children\'s products must not contain more than 100 ppm of lead in substrate materials, and surface coatings (paint) must not exceed 90 ppm lead (16 CFR Part 1303). Third-party testing must confirm compliance.',
        action: 'Require the manufacturer to provide third-party test results confirming lead content in all substrate materials does not exceed 100 ppm and paint/surface coatings do not exceed 90 ppm.',
        verification_status: 'verified_applicable',
        applicability_conditions: 'Children\'s product with paint or surface coating; CPSIA lead limits apply to both substrate and surface coatings.',
        source: lead_source,
      });
    } else if (childrenConfirmed && hasCoating === 'no') {
      findings.push({
        id: 'cpsia_lead',
        category: 'CPSIA -- Lead Content -- Surface Coating (16 CFR 1303)',
        level: 'Low',
        explanation: 'No paint or surface coating has been reported on this children\'s product. The 90 ppm surface coating lead limit does not apply, but the 100 ppm substrate lead limit still applies to all children\'s products.',
        action: 'Confirm that substrate materials in the product do not exceed 100 ppm lead through third-party test reports.',
        verification_status: 'verified_applicable',
        applicability_conditions: 'Children\'s product without paint/coating; substrate lead limit of 100 ppm still applies.',
        source: lead_source,
      });
    } else if (childrenConfirmed && (!hasCoating || hasCoating === 'unknown')) {
      findings.push({
        id: 'cpsia_lead',
        category: 'CPSIA -- Lead Content (16 CFR 1303)',
        level: 'Medium',
        explanation: 'CPSIA limits lead in paint and surface coatings on children\'s products to 90 ppm (16 CFR Part 1303). Whether this product has paint or a surface coating is unknown.',
        action: 'Confirm with the supplier whether any paint, surface coating, or dye is applied. If yes, obtain test results confirming lead content does not exceed 90 ppm in coatings and 100 ppm in substrate materials.',
        verification_status: 'insufficient_info',
        missing_info: 'Whether the product has any paint, surface coating, or dye (paint lead limits of 90 ppm apply to children\'s products).',
        source: lead_source,
      });
    } else if (!childrenConfirmed && !childrenDefinitelyNot) {
      findings.push({
        id: 'cpsia_lead',
        category: 'CPSIA -- Lead Content (16 CFR 1303)',
        level: 'Medium',
        explanation: 'CPSIA lead content limits apply to children\'s products (ages 12 and under). Whether this product is a children\'s product and whether it has a surface coating cannot be determined from the information provided.',
        action: 'Clarify the intended age range and whether the product has paint or surface coating. If the product is for children 12 and under, test for lead compliance.',
        verification_status: 'insufficient_info',
        missing_info: 'Intended age range and whether the product has any paint or surface coating.',
        source: lead_source,
      });
    }

    // ── Coverage domains ──────────────────────────────────────────────────────

    let cpsiaCoverageStatus: CoverageItem['status'];
    if (childrenConfirmed) {
      cpsiaCoverageStatus = 'verified_applicable';
    } else if (childrenDefinitelyNot) {
      cpsiaCoverageStatus = 'not_applicable';
    } else {
      cpsiaCoverageStatus = 'official_unconfirmed';
    }

    coverageDomains.push({
      domain: 'CPSIA -- Children\'s Product Safety',
      domain_key: 'cpsia_childrens',
      category: 'product_regulation',
      status: cpsiaCoverageStatus,
      finding_id: childrenConfirmed ? 'cpsia_third_party_testing' : undefined,
      note: childrenConfirmed
        ? 'CPSIA applies; third-party testing, CPC, and lead compliance are required.'
        : childrenDefinitelyNot
        ? 'CPSIA children\'s product requirements do not apply to products for ages 13 and up.'
        : 'Whether this is a children\'s product subject to CPSIA requires confirmation of intended age range.',
      missing_facts: (!childrenConfirmed && !childrenDefinitelyNot) ? ['age_range'] : undefined,
    });

    return { findings, coverageDomains, docSpecs, questions };
  },
};

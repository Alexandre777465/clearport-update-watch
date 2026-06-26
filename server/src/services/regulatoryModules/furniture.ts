/**
 * Furniture & Composite Wood regulatory module.
 *
 * Covers:
 *   - EPA TSCA Title VI / CARB formaldehyde emission standards (40 CFR Part 770)
 *   - CPSC General Product Safety (CPSA 15 U.S.C. 2051; FHSA)
 *   - California Proposition 65 (informational only -- not a federal import requirement)
 *
 * Detection: HTS 9401-9406, composite wood HTS 4410/4411/4412, furniture text.
 * Last rule-set verified: 2025-08-01.
 */

import type { RiskCategory, CoverageItem } from '../../types';
import type { RegulatoryModule, ModuleInput, ModuleResult, DocSpec, DynamicQuestion } from './index';

// ── Detection helpers ─────────────────────────────────────────────────────────

const FURNITURE_HTS_PREFIXES = [
  '9401', '9402', '9403', '9404', '9405', '9406',
  '4410', '4411', '4412',
];

const FURNITURE_TEXT_RE =
  /\b(furniture|chair|sofa|couch|table|desk|cabinet|shelf|bookcase|wardrobe|dresser|bed\s*frame|mattress|pillow|cushion|composite\s*wood|particleboard|MDF|fiberboard|plywood|laminate)\b/i;

// ── Source citations ──────────────────────────────────────────────────────────

const EPA_TSCA_TITLE_VI_SOURCE = {
  agency: 'EPA',
  name: '40 CFR Part 770 -- Formaldehyde Standards for Composite Wood Products (TSCA Title VI)',
  title: '40 CFR Part 770 (TSCA Title VI); CARB ATCM Phase 2',
  cfr_citation: '40 CFR Part 770',
  last_verified_at: '2025-08-01',
  url: 'https://www.epa.gov/formaldehyde/formaldehyde-emission-standards-composite-wood-products',
  why_relevant: 'Composite wood products (hardwood plywood, particleboard, MDF) and finished goods containing them must meet EPA TSCA Title VI formaldehyde emission standards and carry a Third-Party Certifier (TPC) certification.',
};

const CPSC_SOURCE = {
  agency: 'CPSC',
  name: 'Consumer Product Safety Act (CPSA) -- 15 U.S.C. 2051',
  title: '15 U.S.C. 2051 et seq.; Federal Hazardous Substances Act',
  cfr_citation: '15 U.S.C. 2051',
  last_verified_at: '2025-08-01',
  url: 'https://www.cpsc.gov',
  why_relevant: 'Furniture and household articles must not present an unreasonable risk of injury under CPSC jurisdiction. Specific tip-over hazard standards (ASTM F2057, ASTM F3096) apply to clothing storage and bedroom furniture.',
};

const CA_PROP65_SOURCE = {
  agency: 'California OEHHA',
  name: 'California Proposition 65 (Safe Drinking Water and Toxic Enforcement Act of 1986)',
  title: 'California Health and Safety Code Section 25249.5 et seq.',
  last_verified_at: '2025-08-01',
  url: 'https://oehha.ca.gov/proposition-65',
  why_relevant: 'California Proposition 65 may require warning labels on furniture if it contains listed chemicals (e.g., formaldehyde, lead, cadmium) above safe harbor thresholds. This is a California state requirement, not a federal import requirement.',
};

// ── Module ────────────────────────────────────────────────────────────────────

export const furnitureModule: RegulatoryModule = {
  id: 'furniture',
  name: 'Furniture & Composite Wood Products',

  detects(input) {
    const h = input.htsDigits;
    return (
      (h.length >= 4 && FURNITURE_HTS_PREFIXES.some((p) => h.startsWith(p))) ||
      FURNITURE_TEXT_RE.test(input.productText)
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
      key: 'contains_composite_wood',
      module: 'furniture',
      question: 'Does the product contain composite wood panels (particleboard, MDF/medium-density fiberboard, hardwood plywood, or thin-wood veneer panels)?',
      options: [
        { value: 'yes',     label: 'Yes' },
        { value: 'no',      label: 'No' },
        { value: 'unknown', label: 'Unknown' },
      ],
      helpText: 'Composite wood products include particleboard, medium-density fiberboard (MDF), hardwood plywood, and thin-wood veneer panels. Products containing these materials must meet EPA TSCA Title VI formaldehyde emission standards.',
    });

    questions.push({
      key: 'has_upholstery',
      module: 'furniture',
      question: 'Does the product contain upholstery or foam padding?',
      options: [
        { value: 'yes',     label: 'Yes' },
        { value: 'no',      label: 'No' },
        { value: 'unknown', label: 'Unknown' },
      ],
      helpText: 'Upholstered furniture with foam padding may be subject to CPSC flammability and chemical content requirements.',
    });

    const containsCompositeWood = knownFacts['contains_composite_wood'];

    // ── Finding: EPA TSCA Title VI / CARB ────────────────────────────────────

    if (containsCompositeWood === 'yes') {
      findings.push({
        id: 'epa_tsca_title_vi',
        category: 'EPA TSCA Title VI -- Composite Wood Formaldehyde Standards (40 CFR Part 770)',
        level: 'High',
        explanation: 'Composite wood products (hardwood plywood, particleboard, MDF) and finished goods containing them must comply with EPA TSCA Title VI formaldehyde emission standards (40 CFR Part 770) and be certified by a TSCA Title VI Third-Party Certifier (TPC). Products not meeting these standards cannot be imported for sale in the U.S. The California Air Resources Board (CARB) ATCM Phase 2 is the predecessor standard and remains referenced.',
        action: 'Obtain the TSCA Title VI certification from the composite wood panel manufacturer or from the finished goods manufacturer. The certification number from an EPA-accredited TPC must be available. Labels must state TSCA Title VI compliance.',
        verification_status: 'verified_applicable',
        applicability_conditions: 'Product contains hardwood plywood, particleboard, or MDF panels -- confirmed by respondent.',
        source: EPA_TSCA_TITLE_VI_SOURCE,
      });

      coverageDomains.push({
        domain: 'EPA TSCA Title VI -- Composite Wood Formaldehyde (40 CFR Part 770)',
        domain_key: 'epa_tsca_title_vi',
        category: 'product_regulation',
        status: 'verified_applicable',
        finding_id: 'epa_tsca_title_vi',
        note: 'TPC certification and TSCA Title VI compliant labeling required.',
        official_url: EPA_TSCA_TITLE_VI_SOURCE.url,
      });

      docSpecs.push({
        document: 'TSCA Title VI Third-Party Certifier (TPC) certificate',
        owner: 'supplier',
        responsible_party: 'supplier',
        reason: 'Finished goods containing composite wood panels must be certified by an EPA-accredited Third-Party Certifier (TPC) confirming compliance with EPA TSCA Title VI formaldehyde emission standards (40 CFR Part 770).',
        doc_status: 'required_to_clear',
        condition: 'Product contains composite wood panels subject to EPA TSCA Title VI (40 CFR Part 770).',
        finding_id: 'epa_tsca_title_vi',
      });

      docSpecs.push({
        document: 'TSCA Title VI compliance label / documentation',
        owner: 'supplier',
        responsible_party: 'supplier',
        reason: 'Products containing TSCA Title VI-regulated composite wood panels must be labeled with TSCA Title VI compliance information as required by 40 CFR Part 770.',
        doc_status: 'required_to_clear',
        condition: 'Product contains composite wood panels.',
        finding_id: 'epa_tsca_title_vi',
      });

    } else if (containsCompositeWood === 'no') {
      findings.push({
        id: 'epa_tsca_title_vi',
        category: 'EPA TSCA Title VI -- Composite Wood Formaldehyde Standards (40 CFR Part 770)',
        level: 'N/A',
        explanation: 'EPA TSCA Title VI formaldehyde emission standards apply to composite wood products and finished goods containing them. This product has been confirmed as not containing composite wood panels.',
        action: 'No TSCA Title VI action required.',
        verification_status: 'not_applicable',
        source: EPA_TSCA_TITLE_VI_SOURCE,
      });

      coverageDomains.push({
        domain: 'EPA TSCA Title VI -- Composite Wood Formaldehyde (40 CFR Part 770)',
        domain_key: 'epa_tsca_title_vi',
        category: 'product_regulation',
        status: 'not_applicable',
        finding_id: 'epa_tsca_title_vi',
        note: 'Confirmed no composite wood panels; TSCA Title VI does not apply.',
      });

    } else {
      // unknown
      findings.push({
        id: 'epa_tsca_title_vi',
        category: 'EPA TSCA Title VI -- Composite Wood Formaldehyde Standards (40 CFR Part 770)',
        level: 'High',
        explanation: 'EPA TSCA Title VI formaldehyde emission standards apply to composite wood products and finished goods containing them. Whether this product contains composite wood panels has not been confirmed.',
        action: 'Confirm with the manufacturer whether the product contains particleboard, MDF, or hardwood plywood. If it does, obtain TSCA Title VI certification from an EPA-accredited Third-Party Certifier before importing.',
        verification_status: 'insufficient_info',
        missing_info: 'Whether the product contains composite wood panels (particleboard, MDF, or hardwood plywood) -- these are subject to EPA TSCA Title VI formaldehyde emission standards.',
        source: EPA_TSCA_TITLE_VI_SOURCE,
      });

      coverageDomains.push({
        domain: 'EPA TSCA Title VI -- Composite Wood Formaldehyde (40 CFR Part 770)',
        domain_key: 'epa_tsca_title_vi',
        category: 'product_regulation',
        status: 'insufficient_info',
        finding_id: 'epa_tsca_title_vi',
        missing_facts: ['whether the product contains composite wood panels (particleboard, MDF, or hardwood plywood)'],
        official_url: EPA_TSCA_TITLE_VI_SOURCE.url,
      });
    }

    // ── Finding: CPSC General Product Safety ─────────────────────────────────

    findings.push({
      id: 'cpsc_general_safety',
      category: 'CPSC General Product Safety (CPSA 15 U.S.C. 2051; FHSA)',
      level: 'Medium',
      explanation: 'Furniture and household articles must not present unreasonable risk of injury under the Consumer Product Safety Act (15 U.S.C. 2051 et seq.) and the Federal Hazardous Substances Act. CPSC has issued specific voluntary standards (ASTM F2057 for clothing storage units; ASTM F3096 for bedroom storage furniture) addressing tip-over hazards. Recall risk if product poses unreasonable hazard.',
      action: 'Confirm the product meets applicable CPSC requirements and relevant ASTM voluntary standards. For clothing storage units and bedroom furniture, test to ASTM F2057 or ASTM F3096 tip-over resistance standards. Retain test reports and maintain compliance documentation.',
      verification_status: 'official_unconfirmed',
      applicability_conditions: 'All furniture and household articles sold in the U.S.; specific voluntary standards depend on furniture type.',
      source: CPSC_SOURCE,
    });

    coverageDomains.push({
      domain: 'CPSC General Product Safety (CPSA 15 U.S.C. 2051)',
      domain_key: 'cpsc_furniture',
      category: 'product_regulation',
      status: 'official_unconfirmed',
      finding_id: 'cpsc_general_safety',
      note: 'Furniture must not present unreasonable injury risk; tip-over standards apply to storage furniture.',
      official_url: CPSC_SOURCE.url,
    });

    // ── Finding: California Proposition 65 (informational) ───────────────────

    findings.push({
      id: 'ca_prop65',
      category: 'California Proposition 65 (Informational -- Not a Federal Import Requirement)',
      level: 'Low',
      explanation: 'California Proposition 65 (Safe Drinking Water and Toxic Enforcement Act of 1986) may require warning labels on furniture if it contains chemicals listed by California OEHHA at levels exceeding safe harbor thresholds (e.g., formaldehyde, lead, cadmium). This is a California state requirement, not a federal import requirement. ClearPort does not verify Proposition 65 compliance -- consult a compliance specialist for products sold in California.',
      action: 'If the product will be sold in California, consult a Proposition 65 compliance specialist to assess whether warning labels are required. Obtain test data from the manufacturer for listed chemicals.',
      verification_status: 'no_verified_source',
      missing_info: 'Not supported by ClearPort yet -- Proposition 65 compliance requires chemical testing against OEHHA listed substances and safe harbor thresholds, which cannot be assessed from product text and HTS code alone.',
      source: CA_PROP65_SOURCE,
    });

    coverageDomains.push({
      domain: 'California Proposition 65 (State Requirement)',
      domain_key: 'ca_prop65',
      category: 'product_regulation',
      status: 'source_unavailable',
      finding_id: 'ca_prop65',
      note: 'ClearPort does not assess Prop 65 compliance -- consult a specialist for California sales.',
      official_url: CA_PROP65_SOURCE.url,
    });

    return { findings, coverageDomains, docSpecs, questions };
  },
};

/**
 * Chemicals regulatory module.
 *
 * Covers:
 *   - EPA FIFRA Registration (7 U.S.C. 136a; 40 CFR Part 152) -- pesticides/disinfectants
 *   - EPA TSCA Import Certification (TSCA Section 13; 19 CFR 12.118-12.127)
 *   - DOT Hazardous Materials Regulations (49 CFR Parts 171-180)
 *
 * Detection: HTS chapters 28-38, pesticide HTS 3808, chemical text.
 * Last rule-set verified: 2025-08-01.
 */

import type { RiskCategory, CoverageItem } from '../../types';
import type { RegulatoryModule, ModuleInput, ModuleResult, DocSpec, DynamicQuestion } from './index';

// ── Detection helpers ─────────────────────────────────────────────────────────

const CHEMICAL_TEXT_RE =
  /\b(chemical|disinfectant|pesticide|herbicide|insecticide|fungicide|cleaner|detergent|solvent|paint|varnish|lacquer|coating|lubricant|grease|adhesive|sealant|caulk|epoxy|bleach|acid|alkali|corrosive|aerosol)\b/i;

function isChemicalHts(htsDigits: string): boolean {
  if (htsDigits.length < 4) return false;
  const chapter = parseInt(htsDigits.slice(0, 2), 10);
  if (chapter >= 28 && chapter <= 38) return true;
  // HTS 3808 -- pesticides and disinfectants (already included in 28-38 range,
  // but called out explicitly in the spec for clarity)
  if (htsDigits.startsWith('3808')) return true;
  return false;
}

// ── Source citations ──────────────────────────────────────────────────────────

const EPA_FIFRA_SOURCE = {
  agency: 'EPA',
  name: '7 U.S.C. 136a (FIFRA); 40 CFR Part 152 -- Pesticide Registration',
  title: '7 U.S.C. 136a (FIFRA); 40 CFR Part 152',
  cfr_citation: '40 CFR Part 152',
  last_verified_at: '2025-08-01',
  url: 'https://www.epa.gov/pesticide-registration',
  why_relevant: 'Products making pesticidal or antimicrobial claims (including disinfectants and sanitizers) must be registered with EPA under FIFRA before they can be imported for distribution in the U.S.',
};

const EPA_TSCA_SOURCE = {
  agency: 'EPA',
  name: 'TSCA Section 13; 19 CFR 12.118-12.127 -- Chemical Import Certification',
  title: 'TSCA Section 13; 19 CFR 12.118-12.127',
  cfr_citation: '19 CFR 12.118-12.127',
  last_verified_at: '2025-08-01',
  url: 'https://www.epa.gov/tsca-import-export-requirements/importing-chemical-substances-and-mixtures',
  why_relevant: 'Chemical substances imported into the U.S. may require an EPA TSCA import certification on CBP Form 7501 stating either TSCA compliance or non-applicability.',
};

const DOT_HAZMAT_SOURCE = {
  agency: 'DOT/PHMSA',
  name: '49 CFR Parts 171-180 -- Hazardous Materials Regulations',
  title: '49 CFR Parts 171-180',
  cfr_citation: '49 CFR Parts 171-180',
  last_verified_at: '2025-08-01',
  url: 'https://www.phmsa.dot.gov/hazmat',
  why_relevant: 'Flammable, corrosive, toxic, or otherwise hazardous chemicals must be classified, packaged, labeled, marked, and accompanied by hazmat shipping papers under DOT Hazardous Materials Regulations.',
};

// ── Module ────────────────────────────────────────────────────────────────────

export const chemicalsModule: RegulatoryModule = {
  id: 'chemicals',
  name: 'Chemicals, Pesticides & Hazardous Materials',

  detects(input) {
    return (
      isChemicalHts(input.htsDigits) ||
      CHEMICAL_TEXT_RE.test(input.productText)
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
      key: 'is_pesticide_or_disinfectant',
      module: 'chemicals',
      question: 'Does this product make pesticidal or antimicrobial claims (kills bacteria, viruses, insects, weeds, mold)?',
      options: [
        { value: 'yes',     label: 'Yes' },
        { value: 'no',      label: 'No' },
        { value: 'unknown', label: 'Unknown' },
      ],
      helpText: 'Products that claim to kill, repel, or control pests, bacteria, viruses, mold, or other organisms are regulated as pesticides or antimicrobials under EPA FIFRA regardless of their physical form.',
    });

    questions.push({
      key: 'contains_hazmat',
      module: 'chemicals',
      question: 'Does this product contain hazardous materials (flammable, corrosive, toxic, oxidizing)?',
      options: [
        { value: 'yes',     label: 'Yes' },
        { value: 'no',      label: 'No' },
        { value: 'unknown', label: 'Unknown' },
      ],
      helpText: 'Hazardous materials include substances classified as flammable liquids or solids, corrosives, toxic materials, oxidizers, or compressed gases under 49 CFR Part 173.',
    });

    const isPesticide = knownFacts['is_pesticide_or_disinfectant'];
    const containsHazmat = knownFacts['contains_hazmat'];

    // ── Finding: EPA FIFRA Registration ──────────────────────────────────────

    if (isPesticide === 'yes') {
      findings.push({
        id: 'epa_fifra',
        category: 'EPA FIFRA Registration (7 U.S.C. 136a; 40 CFR Part 152)',
        level: 'High',
        explanation: 'Products making pesticidal or antimicrobial claims (including disinfectants, sanitizers, insecticides, herbicides, and fungicides) must be registered with EPA under FIFRA (7 U.S.C. 136a). The EPA registration number must appear on the product label. Only EPA-registered formulations may be imported for distribution.',
        action: 'Confirm the product\'s EPA registration number. The registration holder must be identified on the label. Import of unregistered pesticides requires an EPA import tolerance or notice of arrival (FIFRA Section 17(c)).',
        verification_status: 'verified_applicable',
        applicability_conditions: 'Product makes pesticidal or antimicrobial claims -- confirmed by respondent.',
        source: EPA_FIFRA_SOURCE,
      });

      coverageDomains.push({
        domain: 'EPA FIFRA Pesticide Registration (7 U.S.C. 136a)',
        domain_key: 'epa_fifra_pesticide',
        category: 'product_regulation',
        status: 'verified_applicable',
        finding_id: 'epa_fifra',
        note: 'EPA registration number required on product label.',
        official_url: EPA_FIFRA_SOURCE.url,
      });

      docSpecs.push({
        document: 'EPA FIFRA registration label copy',
        owner: 'supplier',
        responsible_party: 'supplier',
        reason: 'The product label must bear the EPA registration number and match the registered formulation. A copy of the EPA-registered label must be available to support import.',
        doc_status: 'required_to_clear',
        condition: 'Product makes pesticidal or antimicrobial claims and requires EPA FIFRA registration.',
        finding_id: 'epa_fifra',
      });

    } else if (isPesticide === 'no') {
      findings.push({
        id: 'epa_fifra',
        category: 'EPA FIFRA Registration (7 U.S.C. 136a)',
        level: 'N/A',
        explanation: 'EPA FIFRA registration applies only to products making pesticidal or antimicrobial claims. This product has been confirmed as not making such claims; FIFRA does not apply.',
        action: 'No EPA FIFRA registration action required.',
        verification_status: 'not_applicable',
        source: EPA_FIFRA_SOURCE,
      });

      coverageDomains.push({
        domain: 'EPA FIFRA Pesticide Registration (7 U.S.C. 136a)',
        domain_key: 'epa_fifra_pesticide',
        category: 'product_regulation',
        status: 'not_applicable',
        finding_id: 'epa_fifra',
        note: 'Confirmed no pesticidal or antimicrobial claims; FIFRA does not apply.',
      });

    } else {
      // unknown
      findings.push({
        id: 'epa_fifra',
        category: 'EPA FIFRA Registration (7 U.S.C. 136a)',
        level: 'High',
        explanation: 'Products making pesticidal or antimicrobial claims must be EPA-registered under FIFRA before import. Whether this product makes such claims has not been confirmed.',
        action: 'Confirm whether the product label or marketing materials include any claim to kill, repel, or control bacteria, viruses, mold, insects, weeds, or other organisms. If yes, an EPA registration number is required.',
        verification_status: 'insufficient_info',
        missing_info: 'Whether the product makes pesticidal, antimicrobial, or disinfectant claims (products claiming to kill bacteria, viruses, or pests require EPA FIFRA registration).',
        source: EPA_FIFRA_SOURCE,
      });

      coverageDomains.push({
        domain: 'EPA FIFRA Pesticide Registration (7 U.S.C. 136a)',
        domain_key: 'epa_fifra_pesticide',
        category: 'product_regulation',
        status: 'insufficient_info',
        finding_id: 'epa_fifra',
        missing_facts: ['whether the product makes pesticidal or antimicrobial claims'],
        official_url: EPA_FIFRA_SOURCE.url,
      });
    }

    // ── Finding: EPA TSCA Import Certification ────────────────────────────────

    findings.push({
      id: 'epa_tsca',
      category: 'EPA TSCA Import Certification (TSCA Section 13; 19 CFR 12.118-12.127)',
      level: 'Medium',
      explanation: 'Chemical substances imported into the U.S. may require an EPA TSCA import certification (TSCA Section 13; 19 CFR Part 12.118-12.127). The importer or customs broker must certify on CBP Form 7501 that the product either complies with TSCA or is not subject to TSCA.',
      action: 'Your customs broker will include a TSCA certification statement on CBP Form 7501. The certification is either \'positive\' (TSCA-compliant) or \'negative\' (TSCA does not apply). Confirm the correct certification with your broker and chemical manufacturer.',
      verification_status: 'official_unconfirmed',
      applicability_conditions: 'Chemical substances and mixtures subject to TSCA -- exact applicability depends on substance identity and TSCA inventory status.',
      source: EPA_TSCA_SOURCE,
    });

    coverageDomains.push({
      domain: 'EPA TSCA Import Certification (TSCA Section 13)',
      domain_key: 'epa_tsca',
      category: 'product_regulation',
      status: 'official_unconfirmed',
      finding_id: 'epa_tsca',
      note: 'TSCA certification on CBP Form 7501 required for chemical imports; confirm positive vs. negative certification.',
      official_url: EPA_TSCA_SOURCE.url,
    });

    docSpecs.push({
      document: 'EPA TSCA certification (on CBP Form 7501)',
      owner: 'importer_broker',
      responsible_party: 'customs_broker',
      reason: 'The importer or customs broker must include a TSCA certification statement on CBP Form 7501 for chemical imports, certifying either TSCA compliance or non-applicability (TSCA Section 13; 19 CFR 12.118-12.127).',
      doc_status: 'required_to_clear',
      finding_id: 'epa_tsca',
    });

    docSpecs.push({
      document: 'Safety Data Sheet (SDS) (29 CFR 1910.1200)',
      owner: 'supplier',
      responsible_party: 'supplier',
      reason: 'Safety Data Sheets are usually requested by CBP and may be required under OSHA Hazard Communication Standard (29 CFR 1910.1200) for chemical products. The SDS supports TSCA certification and hazmat classification.',
      doc_status: 'usually_requested',
      finding_id: 'epa_tsca',
    });

    // ── Finding: DOT Hazardous Materials ─────────────────────────────────────

    if (containsHazmat === 'yes') {
      findings.push({
        id: 'dot_hazmat_chemical',
        category: 'DOT Hazardous Materials Regulations (49 CFR Parts 171-180)',
        level: 'High',
        explanation: 'Hazardous materials (flammable, corrosive, toxic, oxidizing substances) are regulated under the Hazardous Materials Regulations (HMR, 49 CFR Parts 171-180). Shipments must be properly classified, packaged, labeled, marked, and accompanied by a hazmat shipping paper.',
        action: 'Ensure the shipment is classified under the proper DOT hazard class (49 CFR Part 172 Hazardous Materials Table). Packaging must meet specification requirements. Shipping papers (49 CFR 172.200) must accompany the shipment. Carrier must be certified for hazmat transport.',
        verification_status: 'verified_applicable',
        applicability_conditions: 'Product contains hazardous materials -- confirmed by respondent.',
        source: DOT_HAZMAT_SOURCE,
      });

      coverageDomains.push({
        domain: 'DOT Hazardous Materials Regulations (49 CFR Parts 171-180)',
        domain_key: 'dot_hazmat',
        category: 'product_regulation',
        status: 'verified_applicable',
        finding_id: 'dot_hazmat_chemical',
        note: 'Hazmat classification, packaging, labeling, and shipping papers required.',
        official_url: DOT_HAZMAT_SOURCE.url,
      });

      docSpecs.push({
        document: 'Hazmat shipping papers (49 CFR 172.200)',
        owner: 'importer_broker',
        responsible_party: 'customs_broker',
        reason: 'DOT HMR requires hazmat shipping papers to accompany all hazardous materials shipments. Papers must include proper shipping name, hazard class, UN identification number, and quantity.',
        doc_status: 'required_if',
        condition: 'Product contains hazardous materials classified under 49 CFR Parts 171-180.',
        finding_id: 'dot_hazmat_chemical',
      });

    } else if (containsHazmat === 'no') {
      findings.push({
        id: 'dot_hazmat_chemical',
        category: 'DOT Hazardous Materials Regulations (49 CFR Parts 171-180)',
        level: 'N/A',
        explanation: 'DOT Hazardous Materials Regulations apply only to shipments containing hazardous materials. This product has been confirmed as not containing hazardous materials.',
        action: 'No DOT hazmat shipping requirements apply.',
        verification_status: 'not_applicable',
        source: DOT_HAZMAT_SOURCE,
      });

      coverageDomains.push({
        domain: 'DOT Hazardous Materials Regulations (49 CFR Parts 171-180)',
        domain_key: 'dot_hazmat',
        category: 'product_regulation',
        status: 'not_applicable',
        finding_id: 'dot_hazmat_chemical',
        note: 'Confirmed no hazardous materials; DOT HMR does not apply.',
      });

    } else {
      // unknown
      findings.push({
        id: 'dot_hazmat_chemical',
        category: 'DOT Hazardous Materials Regulations (49 CFR Parts 171-180)',
        level: 'Medium',
        explanation: 'DOT Hazardous Materials Regulations apply to flammable, corrosive, toxic, and oxidizing substances. Whether this product contains hazardous materials has not been confirmed.',
        action: 'Review the Safety Data Sheet (SDS) for the product to determine whether it contains hazardous materials as defined in 49 CFR Part 173. If hazardous materials are present, ensure proper DOT classification, packaging, labeling, and shipping papers.',
        verification_status: 'insufficient_info',
        missing_info: 'Whether the product contains hazardous materials (flammable, corrosive, toxic, or oxidizing substances) classified under 49 CFR Parts 171-180.',
        source: DOT_HAZMAT_SOURCE,
      });

      coverageDomains.push({
        domain: 'DOT Hazardous Materials Regulations (49 CFR Parts 171-180)',
        domain_key: 'dot_hazmat',
        category: 'product_regulation',
        status: 'insufficient_info',
        finding_id: 'dot_hazmat_chemical',
        missing_facts: ['whether the product contains hazardous materials (flammable, corrosive, toxic, oxidizing)'],
        official_url: DOT_HAZMAT_SOURCE.url,
      });

      docSpecs.push({
        document: 'Hazmat shipping papers (49 CFR 172.200)',
        owner: 'importer_broker',
        responsible_party: 'customs_broker',
        reason: 'Required if the product is classified as a hazardous material under 49 CFR Parts 171-180; cannot be determined until hazmat status is confirmed.',
        doc_status: 'required_if',
        condition: 'Product contains hazardous materials classified under 49 CFR Parts 171-180.',
        finding_id: 'dot_hazmat_chemical',
      });
    }

    return { findings, coverageDomains, docSpecs, questions };
  },
};

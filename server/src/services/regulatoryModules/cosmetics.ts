/**
 * Cosmetics regulatory module.
 *
 * Covers:
 *   - FDA MoCRA facility registration and product listing (21 U.S.C. 364 et seq.)
 *   - FDA cosmetic labeling (21 CFR Part 701)
 *   - FDA OTC drug requirements (sunscreen, acne, antidandruff) (21 CFR Parts 330-358)
 *
 * Detection mirrors categoryDetector.ts 'cosmetics' logic.
 * Last rule-set verified: 2025-08-01.
 */

import type { RiskCategory, CoverageItem } from '../../types';
import type { RegulatoryModule, ModuleInput, ModuleResult, DocSpec, DynamicQuestion } from './index';

// ── Detection helpers ─────────────────────────────────────────────────────────

const COSMETICS_HTS_PREFIXES = ['3303', '3304', '3305', '3306', '3307'];

const COSMETICS_TEXT_RE =
  /\b(cosmetic|skincare|moisturizer|lotion|cream|serum|toner|sunscreen|SPF|foundation|lipstick|mascara|eyeliner|blush|concealer|shampoo|conditioner|hair\s*dye|hair\s*color|nail\s*polish|perfume|cologne|deodorant|antiperspirant|body\s*wash|face\s*wash)\b/i;

// ── Module ────────────────────────────────────────────────────────────────────

export const cosmeticsModule: RegulatoryModule = {
  id: 'cosmetics',
  name: 'Cosmetics / Personal Care Products',

  detects(input) {
    const h = input.htsDigits;
    return (
      input.attrs.is_cosmetic === true ||
      COSMETICS_HTS_PREFIXES.some((p) => h.startsWith(p)) ||
      COSMETICS_TEXT_RE.test(input.productText)
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
      key: 'contains_otc_ingredient',
      module: 'cosmetics',
      question: 'Does this product contain any active drug ingredients (e.g., sunscreen SPF active ingredients like avobenzone/oxybenzone, acne treatment benzoyl peroxide, antidandruff zinc pyrithione)?',
      options: [
        { value: 'yes_sunscreen',   label: 'Yes -- sunscreen/UV filter active ingredients (e.g., avobenzone, oxybenzone, zinc oxide)' },
        { value: 'yes_acne',        label: 'Yes -- acne treatment active (e.g., benzoyl peroxide, salicylic acid)' },
        { value: 'yes_antidandruff', label: 'Yes -- antidandruff active (e.g., zinc pyrithione, selenium sulfide)' },
        { value: 'yes_other_drug',  label: 'Yes -- other active drug ingredient' },
        { value: 'no',              label: 'No active drug ingredients' },
        { value: 'unknown',         label: 'Unknown' },
      ],
      helpText: 'Products with active drug ingredients are regulated as both cosmetics and OTC drugs by FDA and require additional compliance steps.',
    });

    // ── Derived facts ─────────────────────────────────────────────────────────

    const otcIngredient = knownFacts['contains_otc_ingredient'];

    const isOtc =
      otcIngredient === 'yes_sunscreen' ||
      otcIngredient === 'yes_acne' ||
      otcIngredient === 'yes_antidandruff' ||
      otcIngredient === 'yes_other_drug';

    const otcUnknown = !otcIngredient || otcIngredient === 'unknown';
    const otcNo      = otcIngredient === 'no';

    // ── FDA MoCRA Facility Registration and Product Listing ───────────────────

    findings.push({
      id: 'fda_cosmetic_mocra',
      category: 'FDA MoCRA -- Facility Registration and Product Listing (21 U.S.C. 364)',
      level: 'High',
      explanation: 'Under the Modernization of Cosmetics Regulation Act (MoCRA, enacted Dec. 29, 2022, 21 U.S.C. 364 et seq.), any person who owns or operates a facility that manufactures or processes cosmetics for distribution in the U.S. must register the facility with FDA (Section 607). Products must be listed with FDA (Section 607). Responsible persons must ensure safety substantiation.',
      action: 'Confirm with the manufacturer that the production facility is registered with FDA and that all product lines are listed at FDA\'s cosmetic registration portal (https://cos.fda.gov/). Retain safety substantiation records.',
      verification_status: 'verified_applicable',
      applicability_conditions: 'Any cosmetic product manufactured or processed for distribution in the United States.',
      source: {
        agency: 'FDA',
        name: '21 U.S.C. 364 et seq. (MoCRA); 21 CFR Part 710 -- Voluntary Registration of Cosmetic Product Establishments',
        title: 'Modernization of Cosmetics Regulation Act of 2022 (MoCRA)',
        cfr_citation: '21 CFR Part 710',
        last_verified_at: '2025-08-01',
        url: 'https://www.fda.gov/cosmetics/cosmetics-laws-regulations/modernization-cosmetics-regulation-act-2022-mocra',
        why_relevant: 'MoCRA imposes mandatory facility registration and product listing requirements on all cosmetics distributed in the U.S., effective December 29, 2023.',
      },
    });

    docSpecs.push({
      document: 'FDA cosmetic facility registration confirmation',
      owner: 'supplier',
      responsible_party: 'supplier',
      reason: 'MoCRA Section 607 requires the facility that manufactures or processes the cosmetic to be registered with FDA before distribution in the United States.',
      doc_status: 'before_sale',
      finding_id: 'fda_cosmetic_mocra',
    });

    docSpecs.push({
      document: 'Cosmetic product listing confirmation (FDA MoCRA)',
      owner: 'importer_broker',
      responsible_party: 'importer',
      reason: 'MoCRA Section 607 requires the responsible person (U.S. importer or domestic distributor) to submit product listings to FDA.',
      doc_status: 'before_sale',
      finding_id: 'fda_cosmetic_mocra',
    });

    coverageDomains.push({
      domain: 'FDA MoCRA -- Cosmetic Facility Registration and Product Listing',
      domain_key: 'fda_cosmetic',
      category: 'product_regulation',
      status: 'verified_applicable',
      finding_id: 'fda_cosmetic_mocra',
      note: 'MoCRA facility registration and product listing apply to all cosmetics distributed in the United States.',
    });

    // ── FDA Cosmetic Labeling (21 CFR Part 701) ───────────────────────────────

    findings.push({
      id: 'fda_cosmetic_labeling',
      category: 'FDA Cosmetic Labeling (21 CFR Part 701)',
      level: 'High',
      explanation: 'Cosmetics imported for sale in the U.S. must bear labels with the product\'s identity, net quantity of contents, name and place of business of the responsible person (U.S. entity), and ingredient declaration in descending order of predominance (21 CFR Part 701). Labeling must be in English.',
      action: 'Review all product labels for compliance with 21 CFR Part 701. Ensure the U.S. responsible person (importer or distributor) is identified on the label and that the ingredient list is in descending order of concentration.',
      verification_status: 'verified_applicable',
      applicability_conditions: 'All cosmetic products imported for sale in the United States.',
      source: {
        agency: 'FDA',
        name: '21 CFR Part 701 -- Cosmetic Labeling',
        title: 'FDA Cosmetic Labeling Regulations',
        cfr_citation: '21 CFR Part 701',
        last_verified_at: '2025-08-01',
        url: 'https://www.fda.gov/cosmetics/cosmetics-labeling/cosmetics-labeling-regulations',
        why_relevant: '21 CFR Part 701 sets mandatory labeling requirements for all cosmetics sold in the United States, including ingredient declaration and responsible person identification.',
      },
    });

    docSpecs.push({
      document: 'Ingredient declaration / safety substantiation',
      owner: 'supplier',
      responsible_party: 'supplier',
      reason: '21 CFR Part 701 requires an ingredient declaration in descending order of predominance. MoCRA additionally requires the responsible person to maintain safety substantiation records.',
      doc_status: 'before_sale',
      finding_id: 'fda_cosmetic_labeling',
    });

    // ── FDA OTC Drug Requirements ─────────────────────────────────────────────

    const otc_source = {
      agency: 'FDA',
      name: '21 CFR Parts 330-358 -- OTC Drug Products',
      title: 'FDA OTC Drug Monograph Requirements',
      cfr_citation: '21 CFR Parts 330-358',
      last_verified_at: '2025-08-01',
      url: 'https://www.fda.gov/drugs/development-approval-process-drugs/over-counter-otc-monographs',
      why_relevant: 'Cosmetic products that contain active drug ingredients (e.g., sunscreen UV filters, acne treatments) are regulated as both cosmetics and OTC drugs and must comply with the applicable FDA OTC monograph.',
    };

    if (isOtc) {
      let otcCategoryLabel = 'OTC Drug Active Ingredient';
      if (otcIngredient === 'yes_sunscreen')    otcCategoryLabel = 'OTC Sunscreen Drug Active';
      if (otcIngredient === 'yes_acne')         otcCategoryLabel = 'OTC Acne Drug Active';
      if (otcIngredient === 'yes_antidandruff') otcCategoryLabel = 'OTC Antidandruff Drug Active';

      findings.push({
        id: 'fda_otc_drug',
        category: `FDA OTC Drug Requirements -- ${otcCategoryLabel} (21 CFR 330-358)`,
        level: 'Critical',
        explanation: 'Products with drug active ingredients (e.g., sunscreen UV filters, benzoyl peroxide, zinc pyrithione) are regulated as OTC drugs by FDA, not just cosmetics. OTC drugs must comply with an applicable FDA monograph (21 CFR Parts 330-358) or hold an approved NDA/ANDA. OTC drugs are subject to FDA prior notice (21 CFR Part 1, Subpart I) as food/drug imports.',
        action: 'Confirm the product complies with the applicable FDA OTC drug monograph (e.g., 21 CFR 352 for sunscreen). The responsible person must be identified on the label. Contact FDA if a monograph does not cover all ingredients.',
        verification_status: 'verified_applicable',
        applicability_conditions: `Product contains OTC drug active ingredient (contains_otc_ingredient = ${otcIngredient}).`,
        source: otc_source,
      });

      docSpecs.push({
        document: 'OTC drug labeling / monograph compliance documentation',
        owner: 'supplier',
        responsible_party: 'supplier',
        reason: 'FDA OTC monograph compliance documentation is required to confirm the product meets the applicable monograph conditions and active ingredient specifications.',
        doc_status: 'before_sale',
        condition: 'product contains active drug ingredient',
        finding_id: 'fda_otc_drug',
      });

      coverageDomains.push({
        domain: 'FDA OTC Drug Regulation (21 CFR Parts 330-358)',
        domain_key: 'fda_otc_drug',
        category: 'product_regulation',
        status: 'verified_applicable',
        finding_id: 'fda_otc_drug',
        note: 'Product contains OTC drug active ingredient; FDA OTC monograph compliance is required in addition to cosmetic regulations.',
      });
    } else if (otcNo) {
      findings.push({
        id: 'fda_otc_drug',
        category: 'FDA OTC Drug Requirements (21 CFR 330-358)',
        level: 'N/A',
        explanation: 'No active drug ingredients have been reported for this product. FDA OTC drug monograph requirements do not apply.',
        action: 'No OTC drug compliance action is required.',
        verification_status: 'not_applicable',
        source: otc_source,
      });

      coverageDomains.push({
        domain: 'FDA OTC Drug Regulation (21 CFR Parts 330-358)',
        domain_key: 'fda_otc_drug',
        category: 'product_regulation',
        status: 'not_applicable',
        note: 'No OTC drug active ingredients reported; OTC drug requirements do not apply.',
      });
    } else {
      // unknown
      findings.push({
        id: 'fda_otc_drug',
        category: 'FDA OTC Drug Requirements (21 CFR 330-358)',
        level: 'Medium',
        explanation: 'If this product contains active drug ingredients (such as sunscreen UV filters, acne treatments, or antidandruff agents), it is regulated as an OTC drug by FDA in addition to being a cosmetic. Whether active drug ingredients are present is unknown.',
        action: 'Review the full ingredient list with the supplier to determine whether any active drug ingredients are present. If yes, confirm compliance with the applicable FDA OTC monograph.',
        verification_status: 'insufficient_info',
        missing_info: 'Whether the product contains any active drug ingredients (sunscreen SPF filters, acne treatments, antidandruff agents).',
        source: otc_source,
      });

      coverageDomains.push({
        domain: 'FDA OTC Drug Regulation (21 CFR Parts 330-358)',
        domain_key: 'fda_otc_drug',
        category: 'product_regulation',
        status: 'insufficient_info',
        note: 'Cannot determine OTC drug applicability without knowing whether active drug ingredients are present.',
        missing_facts: ['contains_otc_ingredient'],
      });
    }

    return { findings, coverageDomains, docSpecs, questions };
  },
};

/**
 * Textiles regulatory module.
 *
 * Covers:
 *   - FTC Textile Fiber Products Identification Act (TFPIA) (15 U.S.C. 70b / 16 CFR 303)
 *   - FTC Care Labeling Rule (16 CFR 423)
 *   - FTC Wool Products Labeling Act (16 CFR 300)
 *
 * Detection mirrors categoryDetector.ts 'textiles' logic.
 * Last rule-set verified: 2025-08-01.
 */

import type { RiskCategory, CoverageItem } from '../../types';
import type { RegulatoryModule, ModuleInput, ModuleResult, DocSpec, DynamicQuestion } from './index';

// ── Detection helpers ─────────────────────────────────────────────────────────

// HTS chapters 50-63 (textiles and textile articles)
function isTextileChapter(h: string): boolean {
  if (h.length < 2) return false;
  const chapter = parseInt(h.slice(0, 2), 10);
  return chapter >= 50 && chapter <= 63;
}

// HTS 6101-6117, 6201-6217 = knit/woven wearing apparel (chapters 61-62)
// HTS 6301-6308 = other made-up textile articles (chapter 63)
function isApparelHts(h: string): boolean {
  if (h.length < 2) return false;
  const chapter = parseInt(h.slice(0, 2), 10);
  return chapter >= 61 && chapter <= 63;
}

// HTS 6401-6403 = footwear (rubber/plastic or with textile uppers)
const FOOTWEAR_HTS_PREFIXES = ['6401', '6402', '6403'];

const TEXTILES_TEXT_RE =
  /\b(fabric|textile|apparel|garment|clothing|shirt|pants|dress|jacket|coat|sweater|hat|cap|glove|sock|underwear|footwear|shoe|boot|sandal|fiber|yarn|knit|woven|cotton|wool|silk|polyester|nylon|linen|denim)\b/i;

// 16 CFR Part 423 (Care Labeling Rule) covers "textile wearing apparel" — it
// explicitly exempts accessories such as gloves, hats, belts, and scarves per
// FTC guidance. Only garments worn on the body for coverage are included here.
const APPAREL_TEXT_RE =
  /\b(apparel|garment|clothing|shirt|pants|dress|jacket|coat|sweater|sock|underwear)\b/i;

const WOOL_TEXT_RE = /\bwool\b|cashmere|merino|alpaca|mohair/i;

// ── Module ────────────────────────────────────────────────────────────────────

export const textilesModule: RegulatoryModule = {
  id: 'textiles',
  name: 'Textiles / Apparel',

  detects(input) {
    const h = input.htsDigits;
    return (
      input.attrs.is_textile === true ||
      isTextileChapter(h) ||
      FOOTWEAR_HTS_PREFIXES.some((p) => h.startsWith(p)) ||
      TEXTILES_TEXT_RE.test(input.productText)
    );
  },

  evaluate(input: ModuleInput): ModuleResult {
    const { htsDigits: h, productText } = input;

    const findings: RiskCategory[] = [];
    const coverageDomains: CoverageItem[] = [];
    const docSpecs: DocSpec[] = [];
    const questions: DynamicQuestion[] = [];

    // No dynamic questions for textiles -- HTS and product text provide sufficient signal.

    // ── Derived facts ─────────────────────────────────────────────────────────

    const isApparel     = isApparelHts(h) || APPAREL_TEXT_RE.test(productText);
    const isWool        = WOOL_TEXT_RE.test(productText);
    const isFootwearOnly =
      FOOTWEAR_HTS_PREFIXES.some((p) => h.startsWith(p)) &&
      !isTextileChapter(h) &&
      !TEXTILES_TEXT_RE.test(productText.replace(/footwear|shoe|boot|sandal/gi, ''));

    // ── FTC TFPIA Labeling ────────────────────────────────────────────────────

    const tfpia_source = {
      agency: 'FTC',
      name: '16 CFR Part 303 -- Rules and Regulations Under the Textile Fiber Products Identification Act',
      title: 'TFPIA -- Fiber Content and Country of Origin Labeling',
      cfr_citation: '16 CFR Part 303',
      last_verified_at: '2025-08-01',
      url: 'https://www.ftc.gov/business-guidance/resources/threading-your-way-through-labeling-requirements-textile-wool-fur-acts',
      why_relevant: 'The TFPIA requires that textile fiber products bear labels disclosing fiber content, country of origin, and manufacturer identity before they are sold in the United States.',
    };

    if (!isFootwearOnly) {
      findings.push({
        id: 'ftc_textile_labeling',
        category: 'FTC TFPIA -- Fiber Content Labeling (16 CFR 303)',
        level: 'High',
        explanation: 'Textile fiber products sold in the U.S. must bear a label disclosing the generic names and percentages of fibers used in the product, the country of origin, and the manufacturer/dealer identity (15 U.S.C. 70b; 16 CFR Part 303). Labels must be in English.',
        action: 'Instruct the supplier to attach compliant fiber content labels before export. Labels must list fiber by generic name (e.g., Cotton 60%, Polyester 40%) and identify the country of origin.',
        verification_status: 'verified_applicable',
        applicability_conditions: 'HTS chapters 50-63 or product text indicates textile fiber product.',
        source: tfpia_source,
      });

      docSpecs.push({
        document: 'Fiber content label (TFPIA -- 16 CFR 303)',
        owner: 'supplier',
        responsible_party: 'supplier',
        reason: 'The TFPIA requires fiber content, country of origin, and manufacturer identity labels to be attached before the product is sold in the United States.',
        doc_status: 'before_sale',
        finding_id: 'ftc_textile_labeling',
      });

      coverageDomains.push({
        domain: 'FTC TFPIA -- Fiber Content Labeling',
        domain_key: 'ftc_textile_labeling',
        category: 'product_regulation',
        status: 'verified_applicable',
        finding_id: 'ftc_textile_labeling',
        note: 'TFPIA fiber content and country of origin labeling applies to this textile product.',
      });
    } else {
      // Footwear with no textile content detected in text -- TFPIA may not apply to all-rubber/plastic footwear
      findings.push({
        id: 'ftc_textile_labeling',
        category: 'FTC TFPIA -- Fiber Content Labeling (16 CFR 303)',
        level: 'Low',
        explanation: 'The TFPIA applies to textile fiber products. Footwear made entirely of rubber or plastic is not subject to TFPIA. If this footwear contains textile components (e.g., fabric lining, textile upper), those portions are subject to TFPIA labeling.',
        action: 'Confirm with the supplier whether the footwear contains any textile components. If yes, ensure fiber content and country of origin labeling is applied to those textile portions.',
        verification_status: 'official_unconfirmed',
        applicability_conditions: 'Footwear HTS 6401-6403; TFPIA applies only to textile portions, not all-rubber/plastic footwear.',
        source: tfpia_source,
      });

      coverageDomains.push({
        domain: 'FTC TFPIA -- Fiber Content Labeling',
        domain_key: 'ftc_textile_labeling',
        category: 'product_regulation',
        status: 'official_unconfirmed',
        finding_id: 'ftc_textile_labeling',
        note: 'TFPIA applies to textile portions of footwear; confirm whether textile components are present.',
        missing_facts: ['textile_content_in_footwear'],
      });
    }

    // ── FTC Care Labeling (16 CFR 423) ────────────────────────────────────────

    const care_source = {
      agency: 'FTC',
      name: '16 CFR Part 423 -- Care Labeling of Textile Wearing Apparel and Certain Piece Goods',
      title: 'FTC Care Labeling Rule',
      cfr_citation: '16 CFR Part 423',
      last_verified_at: '2025-08-01',
      url: 'https://www.ftc.gov/legal-library/browse/rules/care-labeling-rule',
      why_relevant: 'The FTC Care Labeling Rule requires care instructions on wearing apparel and piece goods before sale. Labels must remain legible for the useful life of the garment.',
    };

    if (isApparel) {
      findings.push({
        id: 'ftc_care_labeling',
        category: 'FTC Care Labeling Rule (16 CFR 423)',
        level: 'High',
        explanation: 'Wearing apparel and certain piece goods must bear care instruction labels (16 CFR Part 423, Textile/Apparel Care Labeling Rule) before sale or in connection with sale. Labels must be attached to the product and remain legible for the useful life of the product.',
        action: 'Instruct the supplier to permanently attach care labels that specify cleaning, drying, ironing, bleaching, and warning instructions before the goods are exported.',
        verification_status: 'verified_applicable',
        applicability_conditions: 'HTS chapters 61-63 or product text indicates wearing apparel.',
        source: care_source,
      });

      docSpecs.push({
        document: 'Care instruction label (16 CFR 423)',
        owner: 'supplier',
        responsible_party: 'supplier',
        reason: 'The FTC Care Labeling Rule requires permanently attached care instructions on wearing apparel before sale in the United States.',
        doc_status: 'before_sale',
        finding_id: 'ftc_care_labeling',
      });

      coverageDomains.push({
        domain: 'FTC Care Labeling Rule (16 CFR 423)',
        domain_key: 'ftc_care_labeling',
        category: 'product_regulation',
        status: 'verified_applicable',
        finding_id: 'ftc_care_labeling',
        note: 'Care labeling required for wearing apparel.',
      });
    } else {
      findings.push({
        id: 'ftc_care_labeling',
        category: 'FTC Care Labeling Rule (16 CFR 423)',
        level: 'N/A',
        explanation: 'The FTC Care Labeling Rule applies to wearing apparel and certain piece goods. This product does not appear to be wearing apparel based on the HTS code and product description provided.',
        action: 'No care labeling is required for non-apparel textile products (e.g., industrial fabric, raw yarn).',
        verification_status: 'not_applicable',
        source: care_source,
      });

      coverageDomains.push({
        domain: 'FTC Care Labeling Rule (16 CFR 423)',
        domain_key: 'ftc_care_labeling',
        category: 'product_regulation',
        status: 'not_applicable',
        note: 'Care labeling does not apply to non-apparel textile products.',
      });
    }

    // ── FTC Wool Products Labeling Act (16 CFR 300) ───────────────────────────

    if (isWool) {
      findings.push({
        id: 'ftc_wool_labeling',
        category: 'FTC Wool Products Labeling Act (16 CFR 300)',
        level: 'Medium',
        explanation: 'Products containing wool must also comply with the Wool Products Labeling Act (WPL) (15 U.S.C. 68; 16 CFR Part 300), which requires disclosure of wool content, including virgin/recycled wool percentage. Confirm product content with the supplier.',
        action: 'Instruct the supplier to provide the exact wool fiber content breakdown (virgin wool, recycled wool, other fibers). Labels must state the wool percentage by generic fiber name.',
        verification_status: 'official_unconfirmed',
        applicability_conditions: 'Product text references wool, cashmere, merino, alpaca, or mohair.',
        source: {
          agency: 'FTC',
          name: '16 CFR Part 300 -- Rules and Regulations Under the Wool Products Labeling Act',
          title: 'FTC Wool Products Labeling Act (WPL)',
          cfr_citation: '16 CFR Part 300',
          last_verified_at: '2025-08-01',
          url: 'https://www.ftc.gov/business-guidance/resources/threading-your-way-through-labeling-requirements-textile-wool-fur-acts',
          why_relevant: 'The WPL requires accurate disclosure of wool and specialty fiber content, including whether wool is virgin or recycled.',
        },
      });

      coverageDomains.push({
        domain: 'FTC Wool Products Labeling Act (16 CFR 300)',
        domain_key: 'ftc_wool_labeling',
        category: 'product_regulation',
        status: 'official_unconfirmed',
        finding_id: 'ftc_wool_labeling',
        note: 'Wool content detected; WPL labeling requirements apply if product contains wool fibers.',
        missing_facts: ['wool_content_percentage'],
      });
    }

    return { findings, coverageDomains, docSpecs, questions };
  },
};

/**
 * Batteries regulatory module.
 *
 * Covers:
 *   - PHMSA UN 38.3 testing requirement (49 CFR 173.185)
 *   - DOT hazardous materials transport classification (UN 3480 / 3481 / 3090 / 3091)
 *   - IATA state-of-charge requirement for air transport
 *
 * Detection mirrors categoryDetector.ts 'batteries' logic.
 * Last rule-set verified: 2025-08-01.
 */

import type { RiskCategory, CoverageItem } from '../../types';
import type { RegulatoryModule, ModuleInput, ModuleResult, DocSpec, DynamicQuestion } from './index';

// ── Helpers ───────────────────────────────────────────────────────────────────

const BATTERIES_HTS_PREFIXES = ['8506', '8507'];

const BATTERIES_TEXT_RE =
  /\b(lithium|li-ion|li-?poly|battery|batteries|accumulator|rechargeable\s*cell|lead[- ]?acid|nickel[- ]?metal|NiMH)\b/i;

type BatteryType = 'lithium_ion' | 'lithium_metal' | 'lead_acid' | 'other_chemistry' | 'unknown' | undefined;
type BatteryConfig = 'standalone_loose' | 'in_equipment' | 'with_equipment' | 'unknown' | undefined;

function isLithium(batteryType: BatteryType): boolean {
  return batteryType === 'lithium_ion' || batteryType === 'lithium_metal';
}

const PHMSA_SOURCE_BASE = {
  agency: 'DOT/PHMSA',
  name: '49 CFR Part 173 — Shippers — General Requirements for Shipments and Packagings',
  cfr_citation: '49 CFR 173.185',
  last_verified_at: '2025-08-01',
  url: 'https://www.phmsa.dot.gov/hazmat/lithium-batteries',
  why_relevant: 'PHMSA regulations govern the domestic and international transport of lithium batteries as hazardous materials, including testing requirements and packaging specifications.',
};

const IATA_SOURCE = {
  agency: 'IATA',
  name: 'IATA Dangerous Goods Regulations (IATA DGR)',
  title: 'IATA DGR — Lithium Battery State of Charge Requirement',
  cfr_citation: '49 CFR 173.185(c)(4)',
  last_verified_at: '2025-08-01',
  url: 'https://www.iata.org/en/programs/cargo/dgr/',
  why_relevant: 'IATA DGR mandates that lithium-ion batteries shipped by air must not exceed 30% state of charge unless an exception applies.',
};

// ── Module ────────────────────────────────────────────────────────────────────

export const batteriesModule: RegulatoryModule = {
  id: 'batteries',
  name: 'Batteries & Cells (Lithium / Hazmat)',

  detects(input) {
    const h = input.htsDigits;
    const txt = input.productText.toLowerCase();
    return (
      !!input.attrs.has_battery ||
      (h.length >= 4 && BATTERIES_HTS_PREFIXES.some((p) => h.startsWith(p))) ||
      BATTERIES_TEXT_RE.test(txt)
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
      key: 'battery_type',
      module: 'batteries',
      question: 'What type of battery is this?',
      options: [
        { value: 'lithium_ion',     label: 'Li-ion / Li-polymer (rechargeable)' },
        { value: 'lithium_metal',   label: 'Primary lithium / non-rechargeable (lithium metal)' },
        { value: 'lead_acid',       label: 'Lead-acid' },
        { value: 'other_chemistry', label: 'Other chemistry (NiMH, alkaline, NiCd, etc.)' },
        { value: 'unknown',         label: 'Unknown' },
      ],
      helpText: 'Lithium batteries (both rechargeable and primary) are regulated as Class 9 hazardous materials under 49 CFR 173.185.',
    });

    questions.push({
      key: 'battery_configuration',
      module: 'batteries',
      question: 'How is the battery being shipped?',
      options: [
        { value: 'standalone_loose', label: 'Standalone loose cells or batteries (UN 3480 / UN 3090)' },
        { value: 'in_equipment',     label: 'Installed inside equipment (UN 3481 / UN 3091)' },
        { value: 'with_equipment',   label: 'Packed with (but not installed in) equipment (UN 3481 / UN 3091)' },
        { value: 'unknown',          label: 'Unknown' },
      ],
    });

    questions.push({
      key: 'battery_wh',
      module: 'batteries',
      question: 'Approximate watt-hour (Wh) rating per cell or battery pack?',
      options: [
        { value: 'under_2wh',        label: 'Under 2 Wh per cell' },
        { value: '2_to_20wh',        label: '2 – 20 Wh per cell' },
        { value: '20_to_100wh',      label: '20 – 100 Wh per cell' },
        { value: 'over_100wh',       label: 'Over 100 Wh per cell' },
        { value: 'over_300wh_pack',  label: 'Over 300 Wh per battery pack' },
        { value: 'unknown',          label: 'Unknown' },
      ],
      helpText: 'Watt-hour rating determines shipping quantity limits and packaging requirements under 49 CFR 173.185 and IATA DGR.',
    });

    const batteryType = knownFacts['battery_type'] as BatteryType;
    const batteryConfig = knownFacts['battery_configuration'] as BatteryConfig;

    // ── UN 38.3 Testing ───────────────────────────────────────────────────────

    if (batteryType === 'lithium_ion' || batteryType === 'lithium_metal') {
      findings.push({
        id: 'phmsa_un383',
        category: 'UN 38.3 Lithium Battery Testing',
        level: 'High',
        explanation: 'Lithium cells and batteries must pass UN 38.3 testing before transport. UN 38.3 specifies altitude simulation, thermal, vibration, shock, external short circuit, impact/crush, overcharge, and forced discharge tests. A test summary must be available throughout the supply chain.',
        action: 'Obtain the UN 38.3 test summary from the cell or battery manufacturer. This document must be available upon request during transport and should identify the test laboratory, cell/battery model, and pass results for all required test types.',
        verification_status: 'verified_applicable',
        applicability_conditions: 'Battery type confirmed as lithium-ion or lithium metal (primary).',
        source: { ...PHMSA_SOURCE_BASE, title: 'UN 38.3 Lithium Battery Testing Requirement', cfr_citation: '49 CFR 173.185(a)(1)' },
      });

      docSpecs.push({
        document: 'UN 38.3 test summary',
        owner: 'supplier',
        responsible_party: 'supplier',
        reason: 'Lithium cells and batteries must have passed UN 38.3 testing; the test summary must accompany the shipment and be available for inspection by authorities and carriers.',
        doc_status: 'required_to_clear',
        finding_id: 'phmsa_un383',
      });

      coverageDomains.push({
        domain: 'PHMSA — UN 38.3 Lithium Battery Testing',
        domain_key: 'phmsa_un383',
        category: 'product_regulation',
        status: 'verified_applicable',
        finding_id: 'phmsa_un383',
        note: 'UN 38.3 test summary required; obtain from manufacturer.',
        official_url: 'https://www.phmsa.dot.gov/hazmat/lithium-batteries',
      });

    } else if (batteryType === 'lead_acid' || batteryType === 'other_chemistry') {
      findings.push({
        id: 'phmsa_un383',
        category: 'UN 38.3 Lithium Battery Testing',
        level: 'N/A',
        explanation: 'UN 38.3 testing applies exclusively to lithium cells and batteries. Lead-acid and other battery chemistries are regulated under separate PHMSA rules but are not subject to UN 38.3.',
        action: 'No UN 38.3 test summary is required for this battery chemistry.',
        verification_status: 'not_applicable',
        source: { ...PHMSA_SOURCE_BASE, title: 'UN 38.3 — Not Applicable (Non-Lithium Chemistry)' },
      });

      coverageDomains.push({
        domain: 'PHMSA — UN 38.3 Lithium Battery Testing',
        domain_key: 'phmsa_un383',
        category: 'product_regulation',
        status: 'not_applicable',
        note: 'UN 38.3 does not apply to non-lithium battery chemistries.',
      });

    } else {
      // unknown chemistry
      findings.push({
        id: 'phmsa_un383',
        category: 'UN 38.3 Lithium Battery Testing',
        level: 'Medium',
        explanation: 'UN 38.3 testing applies to all lithium cells and batteries. The battery chemistry has not been confirmed, so it cannot be determined whether UN 38.3 testing is required.',
        action: 'Confirm the battery chemistry. If the battery is lithium-ion or lithium metal, obtain the UN 38.3 test summary from the manufacturer.',
        verification_status: 'insufficient_info',
        missing_info: 'Battery chemistry (lithium-ion, lithium metal, lead-acid, or other).',
        source: { ...PHMSA_SOURCE_BASE, title: 'UN 38.3 — Chemistry Confirmation Required' },
      });

      coverageDomains.push({
        domain: 'PHMSA — UN 38.3 Lithium Battery Testing',
        domain_key: 'phmsa_un383',
        category: 'product_regulation',
        status: 'insufficient_info',
        missing_facts: ['battery chemistry (lithium-ion, lithium metal, lead-acid, or other)'],
      });
    }

    // ── DOT Transport Classification ──────────────────────────────────────────

    if (batteryType === 'lithium_ion') {
      if (batteryConfig === 'standalone_loose') {
        findings.push({
          id: 'phmsa_dot_class',
          category: 'DOT Hazmat Classification — UN 3480 (Lithium-Ion Batteries)',
          level: 'High',
          explanation: 'Standalone loose lithium-ion cells and batteries are Class 9 hazardous materials classified as UN 3480 under 49 CFR 173.185. They are subject to the full requirements of that section, including packaging, marking, labeling, and shipping paper requirements.',
          action: 'Classify the shipment as UN 3480, Class 9, and comply with all requirements under 49 CFR 173.185 including quantity limits per package, packaging specifications, marking and labeling, and training of hazmat employees.',
          verification_status: 'verified_applicable',
          applicability_conditions: 'Lithium-ion battery; shipped as standalone loose cells/batteries (not installed in or packed with equipment).',
          source: { ...PHMSA_SOURCE_BASE, title: 'UN 3480 — Lithium-Ion Batteries, Standalone' },
        });

      } else if (batteryConfig === 'in_equipment') {
        findings.push({
          id: 'phmsa_dot_class',
          category: 'DOT Hazmat Classification — UN 3481 (Li-Ion in Equipment)',
          level: 'High',
          explanation: 'Lithium-ion batteries installed inside equipment are classified as UN 3481, Class 9. Reduced packaging and documentation requirements apply under 49 CFR 173.185(c) for batteries shipped in equipment compared to standalone cells.',
          action: 'Classify the shipment as UN 3481, Class 9, and comply with the reduced requirements under 49 CFR 173.185(c), including package quantity limits, marking, and the lithium battery mark. Ensure the battery meets the state-of-charge limit if shipped by air.',
          verification_status: 'verified_applicable',
          applicability_conditions: 'Lithium-ion battery installed inside equipment (UN 3481 in-equipment configuration).',
          source: { ...PHMSA_SOURCE_BASE, title: 'UN 3481 — Lithium-Ion Batteries in Equipment', cfr_citation: '49 CFR 173.185(c)' },
        });

      } else if (batteryConfig === 'with_equipment') {
        findings.push({
          id: 'phmsa_dot_class',
          category: 'DOT Hazmat Classification — UN 3481 (Li-Ion Packed with Equipment)',
          level: 'High',
          explanation: 'Lithium-ion batteries packed alongside but not installed in equipment are classified as UN 3481, Class 9. Requirements under 49 CFR 173.185(b) apply, including limits on the number of batteries per package and marking requirements.',
          action: 'Classify the shipment as UN 3481, Class 9, and comply with 49 CFR 173.185(b) for batteries packed with equipment, including per-package battery quantity limits, the lithium battery mark, and shipping paper requirements.',
          verification_status: 'verified_applicable',
          applicability_conditions: 'Lithium-ion battery packed with equipment but not installed inside it.',
          source: { ...PHMSA_SOURCE_BASE, title: 'UN 3481 — Lithium-Ion Batteries Packed with Equipment', cfr_citation: '49 CFR 173.185(b)' },
        });

      } else {
        // lithium_ion, unknown configuration
        findings.push({
          id: 'phmsa_dot_class',
          category: 'DOT Hazmat Classification — Lithium-Ion Battery (UN 3480 / 3481)',
          level: 'High',
          explanation: 'Lithium-ion batteries are Class 9 hazardous materials under 49 CFR 173.185. The exact UN number and packaging requirements depend on the shipping configuration: standalone (UN 3480), in equipment (UN 3481), or packed with equipment (UN 3481).',
          action: 'Confirm how the battery will be shipped to determine the correct UN number and compliance requirements under 49 CFR 173.185.',
          verification_status: 'insufficient_info',
          missing_info: 'Shipping configuration (standalone loose, installed in equipment, or packed with equipment) is required to assign the correct UN number and packaging requirements.',
          source: { ...PHMSA_SOURCE_BASE, title: 'UN 3480/3481 — Lithium-Ion Battery Transport Classification' },
        });
      }

    } else if (batteryType === 'lithium_metal') {
      const unNumber = batteryConfig === 'in_equipment' || batteryConfig === 'with_equipment'
        ? 'UN 3091'
        : batteryConfig === 'standalone_loose'
        ? 'UN 3090'
        : 'UN 3090 or UN 3091';

      findings.push({
        id: 'phmsa_dot_class',
        category: `DOT Hazmat Classification — ${unNumber} (Lithium Metal Battery)`,
        level: 'High',
        explanation: `Primary (non-rechargeable) lithium metal batteries are Class 9 hazardous materials classified as ${unNumber} under 49 CFR 173.185. Standalone lithium metal cells are UN 3090; lithium metal batteries in or packed with equipment are UN 3091.`,
        action: `Classify the shipment as ${unNumber}, Class 9, and comply with all applicable requirements under 49 CFR 173.185 for lithium metal batteries, including packaging, marking, labeling, quantity limits, and shipping documentation.`,
        verification_status: 'verified_applicable',
        applicability_conditions: 'Battery type confirmed as primary lithium metal (non-rechargeable).',
        source: { ...PHMSA_SOURCE_BASE, title: `${unNumber} — Lithium Metal Battery Transport Classification` },
      });

    } else if (!batteryType || batteryType === 'unknown') {
      findings.push({
        id: 'phmsa_dot_class',
        category: 'DOT Hazmat Classification — Lithium Battery (Pending Chemistry)',
        level: 'Medium',
        explanation: 'The DOT hazardous materials classification for batteries depends on the battery chemistry and shipping configuration. Lithium batteries are Class 9 hazmat; non-lithium chemistries may be subject to different or no hazmat requirements.',
        action: 'Confirm battery chemistry and shipping configuration to determine the correct DOT hazmat classification and whether 49 CFR 173.185 applies.',
        verification_status: 'insufficient_info',
        missing_info: 'Battery chemistry and shipping configuration (standalone, in equipment, or packed with equipment) are both required.',
        source: { ...PHMSA_SOURCE_BASE, title: 'DOT Hazmat Classification — Chemistry and Configuration Required' },
      });

    } else {
      // lead_acid or other_chemistry — still emit a coverage item
      findings.push({
        id: 'phmsa_dot_class',
        category: 'DOT Hazmat Classification — Non-Lithium Battery',
        level: 'Low',
        explanation: 'Non-lithium batteries such as lead-acid are regulated as hazardous materials under separate PHMSA rules (e.g., 49 CFR 173.159 for lead-acid) but are not subject to the lithium-specific requirements of 49 CFR 173.185.',
        action: 'Review applicable PHMSA/DOT regulations for the specific battery chemistry. For lead-acid batteries, consult 49 CFR 173.159.',
        verification_status: 'official_unconfirmed',
        source: {
          ...PHMSA_SOURCE_BASE,
          cfr_citation: '49 CFR 173.159',
          title: 'DOT Hazmat — Non-Lithium Battery Chemistry',
          why_relevant: 'Non-lithium batteries have separate DOT hazmat classification requirements.',
        },
      });
    }

    // Emit coverage domain for DOT classification
    const dotFinding = findings.find((f) => f.id === 'phmsa_dot_class');
    coverageDomains.push({
      domain: 'DOT/PHMSA — Hazmat Transport Classification',
      domain_key: 'phmsa_dot_class',
      category: 'product_regulation',
      status: dotFinding?.verification_status === 'verified_applicable'
        ? 'verified_applicable'
        : dotFinding?.verification_status === 'not_applicable'
        ? 'not_applicable'
        : dotFinding?.verification_status === 'insufficient_info'
        ? 'insufficient_info'
        : 'official_unconfirmed',
      finding_id: 'phmsa_dot_class',
      note: dotFinding?.category ?? 'DOT hazmat classification pending chemistry confirmation.',
      official_url: 'https://www.phmsa.dot.gov/hazmat/lithium-batteries',
    });

    // Emit DOT doc specs for lithium batteries only
    if (isLithium(batteryType)) {
      docSpecs.push({
        document: 'Safety Data Sheet (SDS)',
        owner: 'supplier',
        responsible_party: 'supplier',
        reason: 'An SDS is required for lithium batteries transported as Class 9 hazardous materials under 49 CFR 173.185.',
        doc_status: 'required_to_clear',
        finding_id: 'phmsa_dot_class',
      });

      docSpecs.push({
        document: 'Lithium battery shipping declaration / hazmat shipping paper (49 CFR 173.185)',
        owner: 'importer_broker',
        responsible_party: 'customs_broker',
        reason: 'Hazmat shipping papers identifying the UN number, proper shipping name, hazard class, and packing group are required for all lithium battery shipments under 49 CFR 173.185.',
        doc_status: 'required_to_clear',
        finding_id: 'phmsa_dot_class',
      });
    }

    // ── IATA State of Charge (air transport) ──────────────────────────────────

    if (isLithium(batteryType)) {
      findings.push({
        id: 'phmsa_soc_air',
        category: 'IATA DGR — State of Charge for Air Transport',
        level: 'Medium',
        explanation: 'IATA Dangerous Goods Regulations require lithium-ion batteries to be shipped at a state of charge not exceeding 30% when transported as loose cells or batteries by air. This requirement aims to reduce the risk of thermal runaway events during air cargo operations.',
        action: 'Verify current IATA DGR requirements with your freight forwarder. If shipping loose lithium batteries by air, ensure the state of charge does not exceed 30% unless an applicable IATA DGR exception applies (e.g., prototype or low-production batteries under Special Provision A88).',
        verification_status: 'official_unconfirmed',
        applicability_conditions: 'Lithium battery (ion or metal) shipped by air; state-of-charge limit applies primarily to loose cells and batteries.',
        source: IATA_SOURCE,
      });

    } else if (batteryType === 'lead_acid' || batteryType === 'other_chemistry') {
      findings.push({
        id: 'phmsa_soc_air',
        category: 'IATA DGR — State of Charge for Air Transport',
        level: 'N/A',
        explanation: 'The IATA state-of-charge requirement applies only to lithium batteries. Non-lithium battery chemistries are not subject to this restriction.',
        action: 'No state-of-charge action required for non-lithium batteries.',
        verification_status: 'not_applicable',
        source: IATA_SOURCE,
      });

    } else {
      // unknown chemistry
      findings.push({
        id: 'phmsa_soc_air',
        category: 'IATA DGR — State of Charge for Air Transport',
        level: 'Low',
        explanation: 'The IATA 30% state-of-charge requirement applies to lithium batteries transported by air. Battery chemistry has not been confirmed, so applicability cannot be determined.',
        action: 'Confirm battery chemistry. If lithium, verify state-of-charge compliance with your freight forwarder before air shipment.',
        verification_status: 'insufficient_info',
        missing_info: 'Battery chemistry confirmation required to determine whether IATA state-of-charge rules apply.',
        source: IATA_SOURCE,
      });
    }

    return { findings, coverageDomains, docSpecs, questions };
  },
};

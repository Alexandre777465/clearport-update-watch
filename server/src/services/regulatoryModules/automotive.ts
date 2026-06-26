/**
 * Automotive regulatory module.
 *
 * Covers:
 *   - NHTSA / FMVSS safety standards (49 CFR Part 571)
 *   - EPA motor vehicle emissions / Clean Air Act Section 203
 *
 * Detection mirrors categoryDetector.ts 'automotive' logic.
 * Last rule-set verified: 2025-08-01.
 */

import type { RiskCategory, CoverageItem } from '../../types';
import type { RegulatoryModule, ModuleInput, ModuleResult, DocSpec, DynamicQuestion } from './index';

// ── Helper ────────────────────────────────────────────────────────────────────

const AUTOMOTIVE_HTS_PREFIXES = [
  '8701','8702','8703','8704','8705','8706','8707','8708',
  '8711','8712','8713','8714','8715','8716',
  '8407','8408','8409','8483',
];

const AUTOMOTIVE_TEXT_RE =
  /\b(brake|bumper|axle|suspension|driveshaft|crankshaft|camshaft|piston|transmission|clutch|differential|motor\s*vehicle|automotive|automobile|passenger\s*vehicle|truck\s*part|vehicle\s*part|wheel\s*hub|steering|muffler|exhaust|radiator|shock\s*absorber|spark\s*plug|fuel\s*injector|catalytic\s*converter)\b/i;

const EMISSION_HTS_PREFIXES = ['842139', '9026'];
const EMISSION_TEXT_RE = /\b(catalytic\s*converter|emission\s*control|oxygen\s*sensor)\b/i;

function isEmissionPart(hts: string, txt: string): boolean {
  return EMISSION_HTS_PREFIXES.some((p) => hts.startsWith(p)) || EMISSION_TEXT_RE.test(txt);
}

function isBrakePart(hts: string, txt: string): boolean {
  return hts.startsWith('870870') || /\bbrake\b/i.test(txt);
}

function isSuspensionPart(hts: string): boolean {
  return hts.startsWith('870880');
}

// ── Module ────────────────────────────────────────────────────────────────────

export const automotiveModule: RegulatoryModule = {
  id: 'automotive',
  name: 'Automotive / Motor Vehicle Parts',

  detects(input) {
    const h = input.htsDigits;
    const txt = input.productText.toLowerCase();
    return (
      (h.length >= 4 && AUTOMOTIVE_HTS_PREFIXES.some((p) => h.startsWith(p))) ||
      AUTOMOTIVE_TEXT_RE.test(txt)
    );
  },

  evaluate(input: ModuleInput): ModuleResult {
    const { htsDigits: h, productText, knownFacts } = input;
    const txt = productText.toLowerCase();

    const findings: RiskCategory[] = [];
    const coverageDomains: CoverageItem[] = [];
    const docSpecs: DocSpec[] = [];
    const questions: DynamicQuestion[] = [];

    // ── Dynamic questions ─────────────────────────────────────────────────────

    questions.push({
      key: 'vehicle_type',
      module: 'automotive',
      question: 'What type of vehicle does this part fit?',
      options: [
        { value: 'passenger_vehicle', label: 'Passenger car / light truck' },
        { value: 'heavy_commercial',  label: 'Medium/heavy truck / bus' },
        { value: 'non_road',          label: 'Non-road equipment / agricultural' },
        { value: 'unknown',           label: 'Unknown' },
      ],
    });

    if (isBrakePart(h, txt)) {
      questions.push({
        key: 'brake_system_type',
        module: 'automotive',
        question: 'What brake system type is used?',
        options: [
          { value: 'hydraulic', label: 'Hydraulic' },
          { value: 'air',       label: 'Air' },
          { value: 'unknown',   label: 'Unknown' },
        ],
      });
    }

    const vehicleType = knownFacts['vehicle_type'];
    if (vehicleType && vehicleType !== 'unknown') {
      questions.push({
        key: 'is_fmvss_applicable_item',
        module: 'automotive',
        question: 'Is this a component specifically regulated under Federal Motor Vehicle Safety Standards (FMVSS)?',
        options: [
          { value: 'yes',     label: 'Yes' },
          { value: 'no',      label: 'No' },
          { value: 'unknown', label: 'Unknown / not sure' },
        ],
        helpText: 'FMVSS applies to motor vehicle equipment intended for use on public roads in the United States.',
      });
    }

    // ── NHTSA / FMVSS findings ─────────────────────────────────────────────────

    const brakeSystemType   = knownFacts['brake_system_type'];
    const fmvssApplicable   = knownFacts['is_fmvss_applicable_item'];

    const nhtsa_source_base = {
      agency: 'NHTSA',
      name: '49 CFR Part 571 — Federal Motor Vehicle Safety Standards',
      cfr_citation: '49 CFR Part 571',
      last_verified_at: '2025-08-01',
      url: 'https://www.nhtsa.gov/laws-regulations/fmvss',
      why_relevant: 'FMVSS prescribes minimum performance standards for motor vehicle equipment sold or imported into the United States.',
    };

    if (vehicleType === 'non_road') {
      // FMVSS definitively does not apply to non-road equipment
      findings.push({
        id: 'nhtsa_fmvss',
        category: 'NHTSA / FMVSS',
        level: 'N/A',
        explanation: 'Federal Motor Vehicle Safety Standards apply only to motor vehicles and equipment designed for use on public roads. Non-road and agricultural equipment is not subject to FMVSS.',
        action: 'No FMVSS compliance action is required for non-road equipment.',
        verification_status: 'not_applicable',
        source: { ...nhtsa_source_base, title: 'FMVSS — Not Applicable (Non-Road Equipment)' },
      });

      coverageDomains.push({
        domain: 'NHTSA / FMVSS Safety Standards',
        domain_key: 'nhtsa_fmvss',
        category: 'product_regulation',
        status: 'not_applicable',
        note: 'FMVSS does not apply to non-road or agricultural equipment.',
      });

    } else if (!vehicleType || vehicleType === 'unknown') {
      // Cannot determine without knowing vehicle type
      findings.push({
        id: 'nhtsa_fmvss',
        category: 'NHTSA / FMVSS',
        level: 'Medium',
        explanation: 'Federal Motor Vehicle Safety Standards (49 CFR Part 571) require that motor vehicle parts meet specific performance requirements before they are sold or imported for use on U.S. public roads. Applicability depends on the intended vehicle type.',
        action: 'Clarify the vehicle type this part is intended for to determine whether FMVSS compliance is required.',
        verification_status: 'insufficient_info',
        missing_info: 'Vehicle type (passenger car/light truck, heavy commercial, or non-road equipment) is required to assess FMVSS applicability.',
        source: { ...nhtsa_source_base, title: 'FMVSS — Vehicle Type Unknown' },
      });

      coverageDomains.push({
        domain: 'NHTSA / FMVSS Safety Standards',
        domain_key: 'nhtsa_fmvss',
        category: 'product_regulation',
        status: 'insufficient_info',
        missing_facts: ['vehicle_type'],
      });

    } else if (vehicleType === 'passenger_vehicle' && isBrakePart(h, txt)) {
      // FMVSS 135 — Passenger Car Brake Systems
      findings.push({
        id: 'nhtsa_fmvss_135',
        category: 'NHTSA / FMVSS 135 — Passenger Car Brake Systems',
        level: 'High',
        explanation: 'FMVSS 135 (49 CFR 571.135) sets performance requirements for the hydraulic and electric brake systems of passenger cars and light trucks. Manufacturers must self-certify that the component meets the standard before importation.',
        action: 'Obtain the FMVSS 135 self-certification label from the manufacturer confirming compliance. File the NHTSA HS-7 Declaration with CBP at entry.',
        verification_status: 'verified_applicable',
        applicability_conditions: 'Brake component intended for passenger car or light truck; HTS 8708.30 or product text indicates brake part.',
        source: { ...nhtsa_source_base, title: 'FMVSS 135 — Passenger Car Brake Systems', cfr_citation: '49 CFR 571.135' },
      });

      docSpecs.push({
        document: 'FMVSS 135 self-certification label',
        owner: 'supplier',
        responsible_party: 'supplier',
        reason: 'Manufacturer self-certifies compliance with FMVSS 135 before the component enters commerce.',
        doc_status: 'required_to_clear',
        finding_id: 'nhtsa_fmvss_135',
      });

      docSpecs.push({
        document: 'NHTSA HS-7 Declaration',
        owner: 'importer_broker',
        responsible_party: 'customs_broker',
        reason: 'CBP requires the HS-7 form at entry to declare FMVSS compliance or non-applicability for motor vehicle equipment.',
        doc_status: 'required_to_clear',
        finding_id: 'nhtsa_fmvss_135',
        condition: 'Filed at time of customs entry for motor vehicle parts subject to FMVSS.',
      });

      coverageDomains.push({
        domain: 'NHTSA / FMVSS 135 — Passenger Car Brake Systems',
        domain_key: 'nhtsa_fmvss',
        category: 'product_regulation',
        status: 'verified_applicable',
        finding_id: 'nhtsa_fmvss_135',
        note: 'FMVSS 135 applies; self-certification label and HS-7 are required.',
        official_url: 'https://www.nhtsa.gov/laws-regulations/fmvss',
      });

    } else if (vehicleType === 'heavy_commercial' && brakeSystemType === 'air') {
      // FMVSS 121 — Air Brake Systems
      findings.push({
        id: 'nhtsa_fmvss_121',
        category: 'NHTSA / FMVSS 121 — Air Brake Systems',
        level: 'High',
        explanation: 'FMVSS 121 (49 CFR 571.121) governs the performance of air brake systems on trucks, buses, and trailers with a GVWR exceeding 10,000 lb. Components must meet the standard and carry the manufacturer\'s self-certification.',
        action: 'Obtain the FMVSS 121 self-certification label from the manufacturer. File the NHTSA HS-7 Declaration with CBP at entry.',
        verification_status: 'verified_applicable',
        applicability_conditions: 'Air brake component for heavy commercial vehicle (truck/bus); vehicle_type = heavy_commercial and brake_system_type = air.',
        source: { ...nhtsa_source_base, title: 'FMVSS 121 — Air Brake Systems', cfr_citation: '49 CFR 571.121' },
      });

      docSpecs.push({
        document: 'FMVSS 121 self-certification label',
        owner: 'supplier',
        responsible_party: 'supplier',
        reason: 'Manufacturer self-certifies compliance with FMVSS 121 for air brake components.',
        doc_status: 'required_to_clear',
        finding_id: 'nhtsa_fmvss_121',
      });

      docSpecs.push({
        document: 'NHTSA HS-7 Declaration',
        owner: 'importer_broker',
        responsible_party: 'customs_broker',
        reason: 'CBP requires the HS-7 form at entry for motor vehicle equipment subject to FMVSS.',
        doc_status: 'required_to_clear',
        finding_id: 'nhtsa_fmvss_121',
        condition: 'Filed at time of customs entry for air brake components on commercial vehicles.',
      });

      coverageDomains.push({
        domain: 'NHTSA / FMVSS 121 — Air Brake Systems',
        domain_key: 'nhtsa_fmvss',
        category: 'product_regulation',
        status: 'verified_applicable',
        finding_id: 'nhtsa_fmvss_121',
        note: 'FMVSS 121 applies; self-certification label and HS-7 are required.',
        official_url: 'https://www.nhtsa.gov/laws-regulations/fmvss',
      });

    } else if (vehicleType === 'passenger_vehicle' && isSuspensionPart(h)) {
      // FMVSS 126 — Electronic Stability Control (suspension HTS 8708.80)
      findings.push({
        id: 'nhtsa_fmvss_126',
        category: 'NHTSA / FMVSS 126 — Electronic Stability Control',
        level: 'Medium',
        explanation: 'FMVSS 126 (49 CFR 571.126) mandates electronic stability control (ESC) systems on passenger cars. Suspension components for passenger vehicles may affect ESC system performance and could require evaluation against this standard.',
        action: 'Verify with the manufacturer whether this suspension component interacts with or is certified under FMVSS 126. Obtain documentation confirming ESC compliance if applicable.',
        verification_status: 'official_unconfirmed',
        applicability_conditions: 'Suspension component (HTS 8708.80) for passenger car or light truck; full applicability depends on whether the part is part of the ESC system.',
        source: { ...nhtsa_source_base, title: 'FMVSS 126 — Electronic Stability Control', cfr_citation: '49 CFR 571.126' },
      });

      coverageDomains.push({
        domain: 'NHTSA / FMVSS 126 — Electronic Stability Control',
        domain_key: 'nhtsa_fmvss',
        category: 'product_regulation',
        status: 'official_unconfirmed',
        finding_id: 'nhtsa_fmvss_126',
        note: 'Suspension components for passenger vehicles may be subject to FMVSS 126; further review needed.',
        official_url: 'https://www.nhtsa.gov/laws-regulations/fmvss',
      });

    } else {
      // passenger_vehicle or heavy_commercial, brake part but brake type unknown, or general case
      const fmvssLevelMsg =
        fmvssApplicable === 'yes'
          ? 'The product has been identified as an FMVSS-regulated item. Specific standard applicability must be confirmed.'
          : fmvssApplicable === 'no'
          ? 'The importer has indicated this part is not subject to FMVSS; verify with legal counsel if uncertain.'
          : 'Whether this component is specifically regulated under FMVSS cannot be determined without more product detail.';

      findings.push({
        id: 'nhtsa_fmvss',
        category: 'NHTSA / FMVSS',
        level: 'Medium',
        explanation: `Federal Motor Vehicle Safety Standards (49 CFR Part 571) apply to motor vehicle parts intended for use on U.S. public roads. ${fmvssLevelMsg}`,
        action: 'Confirm whether this part is subject to a specific FMVSS standard and obtain the corresponding self-certification documentation from the supplier.',
        verification_status: 'official_unconfirmed',
        missing_info: fmvssApplicable === 'unknown' || !fmvssApplicable
          ? 'Specific FMVSS standard applicability and brake/suspension system type.'
          : undefined,
        source: { ...nhtsa_source_base, title: 'FMVSS — General Applicability Review' },
      });

      coverageDomains.push({
        domain: 'NHTSA / FMVSS Safety Standards',
        domain_key: 'nhtsa_fmvss',
        category: 'product_regulation',
        status: 'official_unconfirmed',
        note: 'FMVSS applicability to this specific part requires further review.',
      });
    }

    // ── EPA Motor Vehicle Emissions ────────────────────────────────────────────

    if (isEmissionPart(h, txt)) {
      findings.push({
        id: 'epa_mvpc',
        category: 'EPA — Clean Air Act Motor Vehicle Part Controls',
        level: 'Medium',
        explanation: 'Motor vehicle parts that affect emissions — including catalytic converters and oxygen sensors — are subject to the tampering prohibitions in Clean Air Act Section 203 (42 U.S.C. 7522) and EPA regulations at 40 CFR Part 85. Importing or selling defeat devices or non-conforming replacement emission parts is prohibited.',
        action: 'Confirm with the manufacturer that the component complies with applicable EPA emission standards and is not a defeat device. Retain OEM or CARB-equivalent certification where applicable.',
        verification_status: 'official_unconfirmed',
        applicability_conditions: 'HTS 8421.39 (catalytic converters) or 9026.xx (sensors), or product text references catalytic converter, emission control, or oxygen sensor.',
        source: {
          agency: 'EPA',
          name: '40 CFR Part 85 — Control of Air Pollution from Motor Vehicles',
          title: 'Clean Air Act Section 203 — Prohibition on Tampering',
          cfr_citation: '40 CFR Part 85',
          last_verified_at: '2025-08-01',
          url: 'https://www.epa.gov/importing-vehicles-and-engines/importation-motor-vehicles-and-motor-vehicle-engines',
          why_relevant: 'Emission-related motor vehicle parts must not defeat or reduce the effectiveness of the vehicle\'s emission control system.',
        },
      });

      coverageDomains.push({
        domain: 'EPA — Vehicle Emissions / Clean Air Act',
        domain_key: 'epa_vehicle_emissions',
        category: 'product_regulation',
        status: 'official_unconfirmed',
        finding_id: 'epa_mvpc',
        note: 'Catalytic converter / emission control part may be subject to CAA Section 203 restrictions.',
        official_url: 'https://www.epa.gov/importing-vehicles-and-engines/importation-motor-vehicles-and-motor-vehicle-engines',
      });

    } else {
      coverageDomains.push({
        domain: 'EPA — Vehicle Emissions / Clean Air Act',
        domain_key: 'epa_vehicle_emissions',
        category: 'product_regulation',
        status: 'not_applicable',
        note: 'No catalytic converter or emission control component detected.',
      });
    }

    return { findings, coverageDomains, docSpecs, questions };
  },
};

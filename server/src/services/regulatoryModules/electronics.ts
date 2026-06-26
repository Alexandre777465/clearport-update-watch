/**
 * Electronics regulatory module.
 *
 * Covers:
 *   - FCC Part 15 Subpart B — Unintentional Radiators (SDoC)
 *   - FCC Equipment Authorization — Intentional Transmitters (FCC ID)
 *
 * Detection mirrors categoryDetector.ts 'electronics' logic.
 * Last rule-set verified: 2025-08-01.
 */

import type { RiskCategory, CoverageItem } from '../../types';
import type { RegulatoryModule, ModuleInput, ModuleResult, DocSpec, DynamicQuestion } from './index';

// ── Helpers ───────────────────────────────────────────────────────────────────

const ELECTRONICS_HTS_PREFIXES = [
  '8471','8472','8517','8518','8519','8520','8521','8522','8523',
  '8524','8525','8526','8527','8528','8529','8530','8531','8532',
  '8533','8534','8535','8536','8537','8538','8539','8540','8541',
  '8542','8543','8544','8545','8546','8547','8548',
  '9009','9013',
];

const ELECTRONICS_TEXT_RE =
  /\b(electronic|wireless|bluetooth|wi-?fi|radio|transmitter|receiver|antenna|modem|router|speaker|headphone|earphone|microphone|amplifier|television|monitor|display|computer|laptop|tablet|phone|charger|power\s*supply|LED|printed\s*circuit|circuit\s*board|PCB|semiconductor)\b/i;

const FCC_SOURCE = {
  agency: 'FCC',
  name: '47 CFR Part 15 — Radio Frequency Devices',
  cfr_citation: '47 CFR Part 15',
  last_verified_at: '2025-08-01',
  url: 'https://www.fcc.gov/oet/ea/fccid',
  why_relevant: 'FCC Part 15 regulates the importation and marketing of electronic devices that emit or receive radio-frequency energy, covering both unintentional and intentional radiators.',
};

// ── Module ────────────────────────────────────────────────────────────────────

export const electronicsModule: RegulatoryModule = {
  id: 'electronics',
  name: 'Electronics & Wireless Devices',

  detects(input) {
    const h = input.htsDigits;
    const txt = input.productText.toLowerCase();
    return (
      !!input.attrs.is_electronic ||
      (h.length >= 4 && ELECTRONICS_HTS_PREFIXES.some((p) => h.startsWith(p))) ||
      ELECTRONICS_TEXT_RE.test(txt)
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
      key: 'has_wireless_tx',
      module: 'electronics',
      question: 'Does this product contain a wireless transmitter (Wi-Fi, Bluetooth, cellular, Zigbee, NFC, or RFID active transmitter)?',
      options: [
        { value: 'yes',     label: 'Yes' },
        { value: 'no',      label: 'No' },
        { value: 'unknown', label: 'Unknown / not sure' },
      ],
      helpText: 'Intentional transmitters require an FCC Equipment Authorization (FCC ID) in addition to Part 15 compliance.',
    });

    questions.push({
      key: 'product_function',
      module: 'electronics',
      question: 'What is the primary function of this electronic device?',
      options: [
        { value: 'audio_speaker',          label: 'Audio speaker' },
        { value: 'headphones_earbuds',     label: 'Headphones / earbuds' },
        { value: 'tv_monitor',             label: 'TV / monitor / display' },
        { value: 'computer_laptop_tablet', label: 'Computer / laptop / tablet' },
        { value: 'phone_tablet',           label: 'Phone / tablet' },
        { value: 'router_modem',           label: 'Router / modem / networking equipment' },
        { value: 'other_no_radio',         label: 'Other electronic device (no radio)' },
        { value: 'unknown',                label: 'Unknown' },
      ],
    });

    const hasWireless = knownFacts['has_wireless_tx'];

    // ── FCC Part 15 Subpart B — Unintentional Radiator (SDoC) ────────────────

    if (hasWireless === 'yes') {
      // When the device also has an intentional transmitter, Part 15 Subpart B
      // SDoC is typically rolled into the equipment authorization process.
      // Flag as insufficient_info for standalone Part 15 analysis.
      findings.push({
        id: 'fcc_part15_sdoc',
        category: 'FCC Part 15 Subpart B — Unintentional Radiator',
        level: 'Medium',
        explanation: 'Electronic devices that generate or use timing signals above 1.705 MHz are subject to FCC Part 15 Subpart B (47 CFR Part 15). Because this device also contains an intentional transmitter, Part 15 Subpart B compliance is typically addressed as part of the FCC Equipment Authorization process rather than a standalone SDoC.',
        action: 'Verify that the FCC Equipment Authorization (FCC ID grant) covers Part 15 Subpart B compliance for the unintentional emissions of this device, in addition to the intentional transmitter authorization.',
        verification_status: 'insufficient_info',
        missing_info: 'Confirmation that the FCC ID grant covers Part 15 Subpart B unintentional radiator compliance in addition to intentional transmitter authorization.',
        source: { ...FCC_SOURCE, title: '47 CFR Part 15 Subpart B — Unintentional Radiators' },
      });

      coverageDomains.push({
        domain: 'FCC Part 15 Subpart B — Unintentional Radiator (SDoC)',
        domain_key: 'fcc_part15',
        category: 'product_regulation',
        status: 'insufficient_info',
        finding_id: 'fcc_part15_sdoc',
        note: 'Part 15 Subpart B compliance should be confirmed within the FCC Equipment Authorization process.',
        missing_facts: ['confirmation that FCC ID grant covers Part 15 Subpart B'],
      });

    } else {
      // No wireless transmitter — standard SDoC applies
      const status: RiskCategory['verification_status'] =
        hasWireless === 'no' ? 'official_unconfirmed' : 'official_unconfirmed';

      findings.push({
        id: 'fcc_part15_sdoc',
        category: 'FCC Part 15 Subpart B — Unintentional Radiator',
        level: 'Medium',
        explanation: 'Electronic devices that generate or use timing signals above 1.705 MHz are subject to FCC Part 15 Subpart B (47 CFR Part 15). The manufacturer or importer must issue a Supplier\'s Declaration of Conformity (SDoC) before marketing the product in the United States.',
        action: 'Obtain the FCC Part 15 Subpart B SDoC from the manufacturer. The SDoC must be retained and made available for inspection; it does not need to be filed with the FCC. Ensure the SDoC references the responsible party, the device model, and the applicable FCC technical standards.',
        verification_status: status,
        applicability_conditions: 'All digital electronic devices with a clock frequency above 1.705 MHz marketed in the United States.',
        source: { ...FCC_SOURCE, title: '47 CFR Part 15 Subpart B — Unintentional Radiators' },
      });

      coverageDomains.push({
        domain: 'FCC Part 15 Subpart B — Unintentional Radiator (SDoC)',
        domain_key: 'fcc_part15',
        category: 'product_regulation',
        status: 'official_unconfirmed',
        finding_id: 'fcc_part15_sdoc',
        note: 'SDoC required before marketing; clock frequency confirmation needed to fully verify.',
        official_url: 'https://www.fcc.gov/oet/ea/fccid',
      });

      docSpecs.push({
        document: 'FCC Supplier\'s Declaration of Conformity (SDoC) — Part 15 Subpart B',
        owner: 'supplier',
        responsible_party: 'supplier',
        reason: 'Manufacturer or importer must retain the SDoC confirming compliance with FCC Part 15 Subpart B before marketing the device in the United States.',
        doc_status: 'before_sale',
        finding_id: 'fcc_part15_sdoc',
      });
    }

    // ── FCC Equipment Authorization — Intentional Transmitters ───────────────

    if (hasWireless === 'yes') {
      findings.push({
        id: 'fcc_equipment_authorization',
        category: 'FCC Equipment Authorization — Intentional Transmitter (FCC ID)',
        level: 'High',
        explanation: 'Intentional transmitters — devices that intentionally generate and emit radio-frequency energy, such as Wi-Fi, Bluetooth, and cellular radios — require FCC Equipment Authorization before they may be imported or marketed in the United States. Most devices require an FCC ID (Certification) granted by an FCC-recognized Telecommunications Certification Body under 47 CFR Part 2 Subpart J.',
        action: 'Verify the FCC ID (granted by a Telecommunications Certification Body) is visibly present on the device label. Confirm the FCC grant is current and covers the device as imported, including all radio frequency bands used. The FCC grant must be in effect at the time of importation.',
        verification_status: 'verified_applicable',
        applicability_conditions: 'Device contains a Wi-Fi, Bluetooth, cellular, Zigbee, NFC, or other intentional RF transmitter — confirmed by respondent.',
        source: { ...FCC_SOURCE, title: '47 CFR Part 2 Subpart J and Part 15 Subpart C — Equipment Authorization', cfr_citation: '47 CFR Part 2.803 and Part 15 Subpart C' },
      });

      docSpecs.push({
        document: 'FCC equipment authorization grant (FCC ID)',
        owner: 'supplier',
        responsible_party: 'supplier',
        reason: 'FCC ID granted by a Telecommunications Certification Body is required before an intentional transmitter may be imported or marketed in the U.S.',
        doc_status: 'before_sale',
        finding_id: 'fcc_equipment_authorization',
      });

      coverageDomains.push({
        domain: 'FCC Equipment Authorization — Intentional Transmitter',
        domain_key: 'fcc_equipment_auth',
        category: 'product_regulation',
        status: 'verified_applicable',
        finding_id: 'fcc_equipment_authorization',
        note: 'FCC ID required; verify label and current grant status.',
        official_url: 'https://www.fcc.gov/oet/ea/fccid',
      });

      // Also emit the SDoC doc for the intentional transmitter path
      docSpecs.push({
        document: 'FCC Supplier\'s Declaration of Conformity (SDoC) — Part 15 Subpart B',
        owner: 'supplier',
        responsible_party: 'supplier',
        reason: 'SDoC for unintentional emissions should be retained in addition to the FCC ID grant.',
        doc_status: 'before_sale',
        finding_id: 'fcc_part15_sdoc',
      });

    } else if (hasWireless === 'no') {
      findings.push({
        id: 'fcc_equipment_authorization',
        category: 'FCC Equipment Authorization — Intentional Transmitter (FCC ID)',
        level: 'N/A',
        explanation: 'FCC Equipment Authorization (FCC ID) is required only for devices containing an intentional RF transmitter. This device has been confirmed to contain no wireless transmitter, so FCC ID is not required.',
        action: 'No FCC Equipment Authorization action required.',
        verification_status: 'not_applicable',
        source: { ...FCC_SOURCE, title: '47 CFR Part 2 Subpart J — Equipment Authorization' },
      });

      coverageDomains.push({
        domain: 'FCC Equipment Authorization — Intentional Transmitter',
        domain_key: 'fcc_equipment_auth',
        category: 'product_regulation',
        status: 'not_applicable',
        note: 'No wireless transmitter confirmed; FCC ID not required.',
      });

    } else {
      // has_wireless_tx unknown
      findings.push({
        id: 'fcc_equipment_authorization',
        category: 'FCC Equipment Authorization — Intentional Transmitter (FCC ID)',
        level: 'High',
        explanation: 'Intentional transmitters require FCC Equipment Authorization before importation or marketing in the United States. Whether this device contains a wireless transmitter has not been confirmed, so the requirement cannot be assessed.',
        action: 'Determine whether this device contains a Wi-Fi, Bluetooth, cellular, NFC, or other intentional RF transmitter. If it does, obtain the FCC ID from the manufacturer before importing.',
        verification_status: 'insufficient_info',
        missing_info: 'Whether the device contains a wireless transmitter (Wi-Fi, Bluetooth, cellular, NFC).',
        source: { ...FCC_SOURCE, title: '47 CFR Part 2 Subpart J — Equipment Authorization' },
      });

      coverageDomains.push({
        domain: 'FCC Equipment Authorization — Intentional Transmitter',
        domain_key: 'fcc_equipment_auth',
        category: 'product_regulation',
        status: 'insufficient_info',
        missing_facts: ['whether the device contains a wireless transmitter (Wi-Fi, Bluetooth, cellular, NFC)'],
      });
    }

    return { findings, coverageDomains, docSpecs, questions };
  },
};

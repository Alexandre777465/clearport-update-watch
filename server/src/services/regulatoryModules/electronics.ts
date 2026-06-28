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

    // ── FCC findings — consolidated per transmitter answer ───────────────────
    //
    // Design rule: produce ONE consistent FCC conclusion, not a conflicting pair.
    //
    // When wireless = 'yes' (intentional transmitter confirmed):
    //   • One Equipment Authorization finding (verified_applicable, High)
    //   • Part 15 Subpart B compliance is noted WITHIN that finding as already
    //     covered by the FCC ID grant — no separate conflicting insufficient_info
    //     finding is emitted for the SDoC.
    //   • One combined docSpec: FCC ID grant + Part 15 Subpart B test report.
    //
    // When wireless = 'no':
    //   • FCC Equipment Authorization N/A.
    //   • Separate SDoC finding for unintentional emissions.
    //   • One docSpec: SDoC only.
    //
    // When wireless unknown:
    //   • Both paths are uncertain → one finding: insufficient_info.
    //   • No docSpec emitted (can't confirm required).

    if (hasWireless === 'yes') {
      // Intentional transmitter confirmed — Equipment Authorization by Certification required.
      // Part 15 Subpart B unintentional-radiator compliance is addressed within the
      // FCC ID grant process; a separate SDoC is retained but is NOT a separate
      // CBP customs-clearance document.
      findings.push({
        id: 'fcc_equipment_authorization',
        category: 'FCC Equipment Authorization — Intentional Transmitter (FCC ID)',
        level: 'High',
        explanation:
          'This device contains an intentional RF transmitter (Bluetooth or other wireless radio). It must hold an FCC Equipment Authorization by Certification — an FCC ID granted by an FCC-recognized Telecommunications Certification Body — before it may be imported or marketed in the United States (47 CFR Part 2.803, Part 15 Subpart C). The FCC ID must appear visibly on the device label and match the approved radio module or finished device. Part 15 Subpart B unintentional-radiator compliance (47 CFR Part 15 Subpart B) is evaluated as part of the Certification process; no separate Supplier\'s Declaration of Conformity is required in addition to the FCC ID grant.',
        action:
          'Obtain the FCC ID number from the manufacturer and confirm it is printed on the device label. Verify the FCC grant is current (grantee database: fccid.io or apps.fcc.gov/oetcf/eas) and covers the radio module(s) installed. Confirm the grant covers the frequency bands and power levels as imported. Retain the FCC ID grant and test report.',
        verification_status: 'verified_applicable',
        applicability_conditions:
          'Device contains an intentional RF transmitter (Bluetooth, Wi-Fi, cellular, NFC, Zigbee, or similar) — confirmed by respondent.',
        missing_info: 'FCC ID number and FCC grant details (grantee, radio module covered, band/power confirmation).',
        source: {
          ...FCC_SOURCE,
          title: '47 CFR Part 2 Subpart J; Part 15 Subpart C — Equipment Authorization by Certification',
          cfr_citation: '47 CFR Part 2.803; 47 CFR Part 15 Subpart C',
        },
      });

      // Single consolidated docSpec — FCC ID grant is the primary document.
      docSpecs.push({
        document: 'FCC equipment authorization grant (FCC ID) and Part 15 Subpart B/C test report',
        owner: 'supplier',
        responsible_party: 'supplier',
        reason:
          'FCC ID granted by a Telecommunications Certification Body is required before an intentional transmitter may be imported or marketed in the U.S. The grant covers both the intentional transmitter (Part 15 Subpart C / Part 2) and unintentional radiator (Part 15 Subpart B) compliance.',
        doc_status: 'before_sale',
        finding_id: 'fcc_equipment_authorization',
      });

      coverageDomains.push({
        domain: 'FCC Equipment Authorization — Intentional Transmitter (FCC ID)',
        domain_key: 'fcc_equipment_auth',
        category: 'product_regulation',
        status: 'verified_applicable',
        finding_id: 'fcc_equipment_authorization',
        note: 'FCC ID required (Bluetooth confirmed); verify label and current grant status.',
        missing_facts: ['FCC ID number and current grant confirmation'],
        official_url: 'https://www.fcc.gov/oet/ea/fccid',
      });

      // Part 15 Subpart B coverage is bundled with the Equipment Authorization
      // — no separate conflicting finding or domain entry.
      coverageDomains.push({
        domain: 'FCC Part 15 Subpart B — Unintentional Radiator',
        domain_key: 'fcc_part15',
        category: 'product_regulation',
        status: 'verified_applicable',
        finding_id: 'fcc_equipment_authorization',
        note: 'Part 15 Subpart B compliance is evaluated and covered within the FCC Equipment Authorization (Certification) process.',
        official_url: 'https://www.fcc.gov/oet/ea/fccid',
      });

    } else if (hasWireless === 'no') {
      // No intentional transmitter — only unintentional radiator rules apply.
      findings.push({
        id: 'fcc_equipment_authorization',
        category: 'FCC Equipment Authorization — Intentional Transmitter (FCC ID)',
        level: 'N/A',
        explanation:
          'FCC Equipment Authorization (FCC ID) is required only for devices containing an intentional RF transmitter. This device has been confirmed to contain no wireless transmitter; FCC ID is not required.',
        action: 'No FCC Equipment Authorization action required.',
        verification_status: 'not_applicable',
        source: { ...FCC_SOURCE, title: '47 CFR Part 2 Subpart J — Equipment Authorization' },
      });

      findings.push({
        id: 'fcc_part15_sdoc',
        category: 'FCC Part 15 Subpart B — Unintentional Radiator (SDoC)',
        level: 'Medium',
        explanation:
          'Digital electronic devices generating or using timing signals above 1.705 MHz are subject to FCC Part 15 Subpart B (47 CFR Part 15). The responsible party (manufacturer or importer) must issue a Supplier\'s Declaration of Conformity (SDoC) before marketing in the United States. The SDoC must be retained and made available for inspection; it is not filed with the FCC.',
        action:
          'Obtain the FCC Part 15 Subpart B SDoC from the manufacturer. Confirm the SDoC references the responsible party, device model, and applicable FCC technical standards.',
        verification_status: 'official_unconfirmed',
        applicability_conditions: 'Digital electronic device with a clock frequency above 1.705 MHz; no intentional transmitter.',
        source: { ...FCC_SOURCE, title: '47 CFR Part 15 Subpart B — Unintentional Radiators (SDoC)' },
      });

      docSpecs.push({
        document: 'FCC Supplier\'s Declaration of Conformity (SDoC) — Part 15 Subpart B',
        owner: 'supplier',
        responsible_party: 'supplier',
        reason:
          'Manufacturer or importer must retain the SDoC confirming FCC Part 15 Subpart B compliance before marketing. No intentional transmitter means no FCC ID is required.',
        doc_status: 'before_sale',
        finding_id: 'fcc_part15_sdoc',
      });

      coverageDomains.push({
        domain: 'FCC Equipment Authorization — Intentional Transmitter',
        domain_key: 'fcc_equipment_auth',
        category: 'product_regulation',
        status: 'not_applicable',
        note: 'No wireless transmitter confirmed; FCC ID not required.',
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

    } else {
      // has_wireless_tx unknown — cannot confirm either path
      findings.push({
        id: 'fcc_equipment_authorization',
        category: 'FCC Equipment Authorization — Intentional Transmitter (FCC ID)',
        level: 'High',
        explanation:
          'Intentional transmitters require FCC Equipment Authorization (FCC ID) before importation or marketing in the United States. Whether this device contains a wireless transmitter has not been confirmed, so the requirement cannot be assessed. If the device has Bluetooth, Wi-Fi, or any other intentional RF transmitter, an FCC ID is mandatory.',
        action:
          'Determine whether this device contains a wireless transmitter (Bluetooth, Wi-Fi, cellular, NFC, or similar). If it does, obtain the FCC ID from the manufacturer before importing.',
        verification_status: 'insufficient_info',
        missing_info: 'Whether the device contains an intentional wireless transmitter.',
        source: { ...FCC_SOURCE, title: '47 CFR Part 2 Subpart J — Equipment Authorization' },
      });

      coverageDomains.push({
        domain: 'FCC Equipment Authorization — Intentional Transmitter',
        domain_key: 'fcc_equipment_auth',
        category: 'product_regulation',
        status: 'insufficient_info',
        missing_facts: ['whether the device contains a wireless transmitter (Bluetooth, Wi-Fi, cellular, NFC)'],
      });

      coverageDomains.push({
        domain: 'FCC Part 15 Subpart B — Unintentional Radiator',
        domain_key: 'fcc_part15',
        category: 'product_regulation',
        status: 'insufficient_info',
        missing_facts: ['wireless transmitter status needed to determine FCC authorization path'],
      });
    }

    return { findings, coverageDomains, docSpecs, questions };
  },
};

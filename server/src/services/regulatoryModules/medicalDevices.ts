/**
 * Medical Devices regulatory module.
 *
 * Covers:
 *   - FDA Establishment Registration and Device Listing (21 CFR Part 807; 21 U.S.C. 360)
 *   - FDA Premarket Clearance/Approval -- 510(k) (21 CFR Part 807 Subpart E) /
 *     PMA (21 CFR Part 814) -- class-conditional
 *   - FDA Quality System Regulation (21 CFR Part 820) -- partially implemented
 *
 * Detection: HTS 9018-9022, medical device text.
 * Last rule-set verified: 2025-08-01.
 */

import type { RiskCategory, CoverageItem } from '../../types';
import type { RegulatoryModule, ModuleInput, ModuleResult, DocSpec, DynamicQuestion } from './index';

// ── Detection helpers ─────────────────────────────────────────────────────────

const MEDICAL_DEVICE_HTS_PREFIXES = ['9018', '9019', '9020', '9021', '9022'];

const MEDICAL_DEVICE_TEXT_RE =
  /\b(medical\s*device|surgical|diagnostic|therapeutic|implant|prosthetic|orthopedic|hearing\s*aid|blood\s*pressure|glucose\s*monitor|pulse\s*oximeter|stethoscope|syringe|catheter|scalpel|bandage|wound\s*care|contact\s*lens|dental\s*implant|pacemaker)\b/i;

// ── Source citations ──────────────────────────────────────────────────────────

const FDA_REGISTRATION_SOURCE = {
  agency: 'FDA',
  name: '21 CFR Part 807 -- Establishment Registration and Device Listing',
  title: '21 CFR Part 807; 21 U.S.C. 360',
  cfr_citation: '21 CFR Part 807',
  last_verified_at: '2025-08-01',
  url: 'https://www.fda.gov/medical-devices/device-registration-and-listing',
  why_relevant: 'All medical device manufacturers distributing devices in the U.S. must register their establishment and list their devices with FDA annually.',
};

const FDA_510K_SOURCE = {
  agency: 'FDA',
  name: '21 CFR Part 807 Subpart E -- Premarket Notification (510(k))',
  title: '21 CFR Part 807 Subpart E; 21 U.S.C. 360e',
  cfr_citation: '21 CFR Part 807 Subpart E',
  last_verified_at: '2025-08-01',
  url: 'https://www.fda.gov/medical-devices/premarket-submissions-selecting-and-preparing-correct-submission/premarket-notification-510k',
  why_relevant: 'Class II medical devices generally require FDA 510(k) premarket notification clearance before importation and distribution in the U.S.',
};

const FDA_PMA_SOURCE = {
  agency: 'FDA',
  name: '21 CFR Part 814 -- Premarket Approval (PMA)',
  title: '21 CFR Part 814',
  cfr_citation: '21 CFR Part 814',
  last_verified_at: '2025-08-01',
  url: 'https://www.fda.gov/medical-devices/premarket-submissions-selecting-and-preparing-correct-submission/premarket-approval-pma',
  why_relevant: 'Class III medical devices require FDA Premarket Approval (PMA) -- the most stringent device review pathway -- before they can be marketed in the U.S.',
};

const FDA_QSR_SOURCE = {
  agency: 'FDA',
  name: '21 CFR Part 820 -- Quality System Regulation',
  title: '21 CFR Part 820',
  cfr_citation: '21 CFR Part 820',
  last_verified_at: '2025-08-01',
  url: 'https://www.fda.gov/medical-devices/postmarket-requirements-devices/quality-system-qs-regulationmedical-device-good-manufacturing-practices',
  why_relevant: 'Medical device manufacturers are required to comply with FDA Quality System Regulation governing design, manufacturing, packaging, labeling, storage, installation, and servicing of finished devices.',
};

// ── Module ────────────────────────────────────────────────────────────────────

export const medicalDevicesModule: RegulatoryModule = {
  id: 'medical_devices',
  name: 'Medical Devices',

  detects(input) {
    const h = input.htsDigits;
    return (
      (h.length >= 4 && MEDICAL_DEVICE_HTS_PREFIXES.some((p) => h.startsWith(p))) ||
      MEDICAL_DEVICE_TEXT_RE.test(input.productText)
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
      key: 'fda_device_class',
      module: 'medical_devices',
      question: 'What is the FDA device classification for this product?',
      options: [
        { value: 'class_1', label: 'Class I -- general controls only' },
        { value: 'class_2', label: 'Class II -- requires 510(k) clearance' },
        { value: 'class_3', label: 'Class III -- requires PMA' },
        { value: 'unknown', label: 'Unknown' },
      ],
      helpText: 'FDA device classification determines the level of premarket review required. Class I devices are lowest risk; Class III are highest risk. You can look up classification at https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfpcd/classification.cfm',
    });

    const deviceClass = knownFacts['fda_device_class'];

    // ── Finding: FDA Establishment Registration and Device Listing ────────────

    findings.push({
      id: 'fda_device_registration',
      category: 'FDA Medical Device Establishment Registration and Listing (21 CFR Part 807)',
      level: 'High',
      explanation: 'Medical devices distributed in the U.S. require FDA establishment registration and device listing (21 U.S.C. 360; 21 CFR Part 807). The U.S. importer or agent must ensure the foreign manufacturer is registered with FDA and all device models are listed. Failure to register is a prohibited act under the FD&C Act.',
      action: 'Confirm the manufacturer is registered with FDA and the device is listed at FDA\'s FURLS database (https://www.fda.gov/medical-devices/device-registration-and-listing). Registration must be renewed annually.',
      verification_status: 'verified_applicable',
      applicability_conditions: 'All medical devices distributed in the U.S. -- registration and listing is required regardless of device class.',
      source: FDA_REGISTRATION_SOURCE,
    });

    coverageDomains.push({
      domain: 'FDA Medical Device Registration and Listing (21 CFR Part 807)',
      domain_key: 'fda_medical_device',
      category: 'product_regulation',
      status: 'verified_applicable',
      finding_id: 'fda_device_registration',
      note: 'Annual FDA establishment registration and device listing required.',
      official_url: FDA_REGISTRATION_SOURCE.url,
    });

    docSpecs.push({
      document: 'FDA establishment registration confirmation',
      owner: 'supplier',
      responsible_party: 'supplier',
      reason: 'Foreign device manufacturer must be registered with FDA (21 CFR Part 807) before devices can be imported for distribution in the U.S. Registration must be renewed annually.',
      doc_status: 'before_sale',
      finding_id: 'fda_device_registration',
    });

    docSpecs.push({
      document: 'Device labeling (FDA-compliant)',
      owner: 'supplier',
      responsible_party: 'supplier',
      reason: 'Medical device labeling must comply with FDA requirements under 21 CFR Part 801, including intended use, directions for use, and device identification. Non-compliant labeling is grounds for import refusal.',
      doc_status: 'required_to_clear',
      finding_id: 'fda_device_registration',
    });

    // ── Finding: Premarket Clearance / Approval (510(k) / PMA) ───────────────

    if (deviceClass === 'class_2') {
      findings.push({
        id: 'fda_device_premarket',
        category: 'FDA 510(k) Premarket Notification -- Class II Device',
        level: 'High',
        explanation: 'Class II medical devices generally require FDA 510(k) premarket notification (21 U.S.C. 360e; 21 CFR Part 807 Subpart E). The device must receive FDA clearance before it can be legally imported for distribution in the U.S. Clearance number must be obtained and retained.',
        action: 'Obtain the 510(k) clearance letter from the manufacturer confirming FDA clearance. The 510(k) number (K-number) should be referenced in import documentation. Verify the cleared indications of use match the device as imported.',
        verification_status: 'verified_applicable',
        applicability_conditions: 'Device is classified as Class II by FDA -- confirmed by respondent.',
        source: FDA_510K_SOURCE,
      });

      docSpecs.push({
        document: 'FDA 510(k) clearance letter or PMA approval',
        owner: 'supplier',
        responsible_party: 'supplier',
        reason: 'Class II devices require a valid FDA 510(k) clearance number before importation or distribution in the U.S.',
        doc_status: 'required_to_clear',
        condition: 'Device is Class II (510(k)) or Class III (PMA).',
        finding_id: 'fda_device_premarket',
      });

    } else if (deviceClass === 'class_3') {
      findings.push({
        id: 'fda_device_premarket',
        category: 'FDA Premarket Approval (PMA) -- Class III Device',
        level: 'High',
        explanation: 'Class III medical devices require FDA Premarket Approval (PMA) (21 CFR Part 814) -- the most stringent device review pathway. The device cannot be marketed in the U.S. without an approved PMA.',
        action: 'Obtain the PMA approval letter from the manufacturer. Confirm the PMA number and approval date. Any modifications to a PMA-approved device may require a PMA supplement. Verify the device as imported matches the approved PMA specifications.',
        verification_status: 'verified_applicable',
        applicability_conditions: 'Device is classified as Class III by FDA -- confirmed by respondent.',
        source: FDA_PMA_SOURCE,
      });

      docSpecs.push({
        document: 'FDA 510(k) clearance letter or PMA approval',
        owner: 'supplier',
        responsible_party: 'supplier',
        reason: 'Class III devices require an approved FDA PMA before importation or distribution in the U.S.',
        doc_status: 'required_to_clear',
        condition: 'Device is Class II (510(k)) or Class III (PMA).',
        finding_id: 'fda_device_premarket',
      });

    } else if (deviceClass === 'class_1') {
      findings.push({
        id: 'fda_device_premarket',
        category: 'FDA Premarket Notification -- Class I Device',
        level: 'N/A',
        explanation: 'Most Class I devices are exempt from premarket notification (21 CFR Part 862-892 exemption listings). Confirm specific device exemption status with FDA\'s product code database.',
        action: 'Verify the specific device is listed in the applicable exemption regulation for its product code. Some Class I devices retain a 510(k) requirement. Check FDA\'s device classification database.',
        verification_status: 'not_applicable',
        applicability_conditions: 'Class I device confirmed by respondent; 510(k) exemption still requires verification per specific product code.',
        source: FDA_510K_SOURCE,
      });

    } else {
      // unknown
      findings.push({
        id: 'fda_device_premarket',
        category: 'FDA Premarket Clearance or Approval (510(k) / PMA)',
        level: 'High',
        explanation: 'FDA device classification (Class I, II, or III) determines whether 510(k) premarket notification or PMA approval is required before importation. Class II devices generally require 510(k); Class III require PMA. The device class has not been provided.',
        action: 'Determine the FDA device classification using the FDA product classification database (https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfpcd/classification.cfm). Provide the class to determine premarket submission requirements.',
        verification_status: 'insufficient_info',
        missing_info: 'FDA device classification (Class I, II, or III) is required to determine premarket clearance requirements.',
        source: FDA_510K_SOURCE,
      });

      docSpecs.push({
        document: 'FDA 510(k) clearance letter or PMA approval',
        owner: 'supplier',
        responsible_party: 'supplier',
        reason: 'Required for Class II (510(k)) and Class III (PMA) devices before importation; cannot be determined until device class is confirmed.',
        doc_status: 'required_if',
        condition: 'Device is Class II (510(k)) or Class III (PMA).',
        finding_id: 'fda_device_premarket',
      });
    }

    coverageDomains.push({
      domain: 'FDA Premarket Clearance / Approval (510(k) / PMA)',
      domain_key: 'fda_device_premarket',
      category: 'product_regulation',
      status:
        deviceClass === 'class_2' ? 'verified_applicable'
        : deviceClass === 'class_3' ? 'verified_applicable'
        : deviceClass === 'class_1' ? 'not_applicable'
        : 'insufficient_info',
      finding_id: 'fda_device_premarket',
      note:
        deviceClass === 'class_2' ? '510(k) clearance number required.'
        : deviceClass === 'class_3' ? 'PMA approval required.'
        : deviceClass === 'class_1' ? 'Class I -- most devices exempt from 510(k); confirm specific product code.'
        : 'Device class not provided; premarket submission requirement cannot be determined.',
      missing_facts: deviceClass === 'unknown' || deviceClass === undefined
        ? ['FDA device classification (Class I, II, or III)']
        : undefined,
      official_url: deviceClass === 'class_3' ? FDA_PMA_SOURCE.url : FDA_510K_SOURCE.url,
    });

    // ── Finding: FDA Quality System Regulation (partially implemented) ─────────

    findings.push({
      id: 'fda_device_qsr',
      category: 'FDA Quality System Regulation (21 CFR Part 820 / QMSR)',
      level: 'Medium',
      explanation: 'Device manufacturers must comply with FDA Quality System Regulation (21 CFR Part 820, now transitioning to ISO 13485-based QMSR). ClearPort does not yet verify QSR compliance from submitted facts -- confirm with the manufacturer.',
      action: 'Request confirmation from the manufacturer that their facility is operating under a compliant QMS (21 CFR Part 820 or the forthcoming QMSR). For imported devices, FDA may inspect the foreign manufacturer\'s QMS.',
      verification_status: 'no_verified_source',
      missing_info: 'Not supported by ClearPort yet -- QSR compliance requires audit records or ISO 13485 certification from the manufacturer, which cannot be assessed from product text and HTS code alone.',
      source: FDA_QSR_SOURCE,
    });

    coverageDomains.push({
      domain: 'FDA Quality System Regulation (21 CFR Part 820)',
      domain_key: 'fda_device_qsr',
      category: 'product_regulation',
      status: 'source_unavailable',
      finding_id: 'fda_device_qsr',
      note: 'ClearPort does not yet assess QSR compliance -- confirm with manufacturer.',
      official_url: FDA_QSR_SOURCE.url,
    });

    return { findings, coverageDomains, docSpecs, questions };
  },
};

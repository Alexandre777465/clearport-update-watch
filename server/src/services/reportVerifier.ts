/**
 * Independent autonomous verification gate.
 *
 * Operates on the completed draft scan produced by finalizeScan before it is
 * stored or displayed. Returns either the original scan (if all checks pass)
 * or a corrected scan with unsupported claims downgraded or removed.
 *
 * Architecture rules:
 *   - Pure function: no I/O, no model calls, no database access.
 *   - Issues are corrected silently server-side; the customer never sees issue
 *     codes, severity labels, or technical detail strings.
 *   - An issue in one section does not block accurate sections.
 *   - Every correction is conservative (downgrade / remove / correct), never inventive.
 *
 * Checks (A–M):
 *   A  Unsourced mandatory   — verified_applicable without a source
 *   B  Voluntary not mandatory — standards-body-only source cannot create a
 *                                mandatory federal obligation
 *   C  not_applicable → no required document
 *   D  Required document must trace to a verified finding
 *   E  No duplicate documents in checklist
 *   F  No duplicate obligation records
 *   G  Transport-mode document mismatch
 *   H  Coverage-finding contradiction (coverage says N/A, finding says verified)
 *   I  Missing-facts must be genuinely unresolved (not already-resolved facts)
 *   J  Tariff rate-impact consistency — strips dollar amounts that lack a rate
 *   K  All applicable tariffs in coverage matrix — adds missing entries
 *   L  Registry scope validation — citation must cover this product per rule record
 *        L0  RULE_NOT_IN_REGISTRY — no registry record for the finding id
 *        L1  RULE_EXPIRED — rule has expired for the import date
 *        L2  CITATION_SCOPE_MISMATCH — product outside HTS chapter / keywords
 *        L3  SCOPE_CONDITION_UNMET — factual condition definitively not met
 *        L4  CLARIFICATION_REQUIRED — material fact unknown; cannot approve
 *   M  Per-finding amount consistency — rate × customs value must equal stated amount
 */

import type { ScanResult } from './riskScanner';
import type { CoverageItem, VerificationStatus, ClarificationQuestion } from '../types';
import { deduplicateObligations } from './obligationEngine';
import {
  OFFICIAL_RULE_REGISTRY,
  buildFindingIndex,
  type OfficialRuleRecord,
  type ScopeConditions,
} from '../data/officialRuleRegistry';

// ── Agency classification ─────────────────────────────────────────────────────

const FEDERAL_AGENCIES = new Set([
  'CBP', 'U.S. Customs and Border Protection',
  'CPSC', 'Consumer Product Safety Commission',
  'FDA', 'Food and Drug Administration',
  'FCC', 'Federal Communications Commission',
  'DOT', 'Department of Transportation',
  'PHMSA', 'DOT/PHMSA', 'Pipeline and Hazardous Materials Safety Administration',
  'EPA', 'Environmental Protection Agency',
  'USDA', 'U.S. Department of Agriculture',
  'OSHA', 'Occupational Safety and Health Administration',
  'FTC', 'Federal Trade Commission',
  'USITC', 'U.S. International Trade Commission',
  'USTR', 'Office of the United States Trade Representative',
  'Coast Guard', 'U.S. Coast Guard',
  'NHTSA', 'National Highway Traffic Safety Administration',
  'ATF', 'Bureau of Alcohol, Tobacco, Firearms and Explosives',
  'BIS', 'Bureau of Industry and Security',
]);

const VOLUNTARY_BODIES = new Set([
  'ASTM International', 'ASTM',
  'UL', 'Underwriters Laboratories',
  'ISO', 'International Organization for Standardization',
  'NOCSAE',
  'UIAA',
  'ANSI', 'American National Standards Institute',
  'NEMA',
  'IEC', 'International Electrotechnical Commission',
  'CEN', 'EN',
  'NSF', 'NSF International',
  'SAE', 'SAE International',
]);

// Domain keys that map to tariff payment-table entries.
const TARIFF_DOMAIN_KEYS = new Set([
  'mfn_duty', 'section_301', 'section_122_surcharge',
  'section_232_auto', 'section_232',
]);

// Risk-category IDs whose financial_impact must be backed by a verified_rate_pct.
const TARIFF_FINDING_IDS = new Set([
  'hts_duty', 'hts_section301', 'section_122_surcharge',
  'section_232_auto', 'section_232', 'mpf', 'hmf',
]);

// Tariff findings for which the amount formula is simply rate × value / 100.
// MPF is excluded because it has min/max bounds (non-linear formula).
const SIMPLE_RATE_FINDING_IDS = new Set([
  'hts_duty', 'hts_section301', 'section_122_surcharge', 'hmf',
  'section_232_auto', 'section_232',
]);

// Maps a finding id to its canonical coverage-matrix domain key.
const FINDING_TO_DOMAIN: Record<string, string> = {
  hts_duty: 'mfn_duty',
  hts_section301: 'section_301',
  section_122_surcharge: 'section_122_surcharge',
  section_232_auto: 'section_232_auto',
};

function isVoluntaryBodyOnly(agency: string | undefined): boolean {
  if (!agency) return false;
  return VOLUNTARY_BODIES.has(agency) && !FEDERAL_AGENCIES.has(agency);
}

// ── Scope condition checking ───────────────────────────────────────────────────

type ScopeCheckResult =
  | { verdict: 'pass' }
  | { verdict: 'fail'; isStructural: boolean }
  | { verdict: 'clarify'; factKey: string };

function checkScope(
  cond: ScopeConditions,
  facts: ProductFacts,
  transportMode: string | null,
): ScopeCheckResult {
  // HTS chapter (first 2 digits)
  if (cond.hts_chapters && cond.hts_chapters.length > 0) {
    if (!facts.htsDigits) return { verdict: 'clarify', factKey: 'hts_code' };
    const ch = parseInt(facts.htsDigits.slice(0, 2), 10);
    if (!cond.hts_chapters.includes(ch)) return { verdict: 'fail', isStructural: true };
  }

  // HTS heading (first 4 digits, as string)
  if (cond.hts_headings && cond.hts_headings.length > 0) {
    if (!facts.htsDigits) return { verdict: 'clarify', factKey: 'hts_code' };
    const hd = facts.htsDigits.slice(0, 4);
    if (!cond.hts_headings.includes(hd)) return { verdict: 'fail', isStructural: true };
  }

  // Product text: at least one of these must appear
  if (cond.keywords_any_of && cond.keywords_any_of.length > 0) {
    if (!facts.productText) return { verdict: 'clarify', factKey: 'product_description' };
    const txt = facts.productText.toLowerCase();
    if (!cond.keywords_any_of.some((k) => txt.includes(k.toLowerCase()))) {
      return { verdict: 'fail', isStructural: true };
    }
  }

  // Product text: ALL of these must appear
  if (cond.keywords_required && cond.keywords_required.length > 0) {
    if (!facts.productText) return { verdict: 'clarify', factKey: 'product_description' };
    const txt = facts.productText.toLowerCase();
    if (!cond.keywords_required.every((k) => txt.includes(k.toLowerCase()))) {
      return { verdict: 'fail', isStructural: true };
    }
  }

  // Product text: NONE of these may appear (only check when productText is known)
  if (cond.keywords_excluded && cond.keywords_excluded.length > 0 && facts.productText) {
    const txt = facts.productText.toLowerCase();
    if (cond.keywords_excluded.some((k) => txt.includes(k.toLowerCase()))) {
      return { verdict: 'fail', isStructural: false };
    }
  }

  // Age restriction
  if (cond.applicable_age === 'children_only') {
    const isKids = facts.attrs?.is_children;
    if (isKids === false) return { verdict: 'fail', isStructural: false };
    if (isKids === undefined) return { verdict: 'clarify', factKey: 'is_children' };
  }

  // Battery requirement
  if (cond.battery_required === true) {
    const hasBattery = facts.attrs?.has_battery;
    if (hasBattery === false) return { verdict: 'fail', isStructural: false };
    if (hasBattery === undefined) return { verdict: 'clarify', factKey: 'has_battery' };
  }

  // Electronics requirement
  if (cond.electronic_required === true) {
    const isElectronic = facts.attrs?.is_electronic;
    if (isElectronic === false) return { verdict: 'fail', isStructural: false };
    if (isElectronic === undefined) return { verdict: 'clarify', factKey: 'is_electronic' };
  }

  // Origin country restriction (case-insensitive substring match)
  if (cond.origin_countries && cond.origin_countries.length > 0) {
    if (!facts.originCountry) return { verdict: 'clarify', factKey: 'origin_country' };
    const lo = facts.originCountry.toLowerCase();
    if (!cond.origin_countries.some((c) => lo.includes(c.toLowerCase()) || c.toLowerCase() === lo)) {
      return { verdict: 'fail', isStructural: false };
    }
  }

  // Transport mode restriction
  if (cond.transport_modes && cond.transport_modes.length > 0) {
    if (!transportMode) return { verdict: 'clarify', factKey: 'transport_mode' };
    if (!cond.transport_modes.includes(transportMode as 'ocean' | 'air' | 'truck' | 'rail')) {
      return { verdict: 'fail', isStructural: false };
    }
  }

  // Import date range (use today as estimate when not supplied)
  const importDate = facts.importDate ?? new Date().toISOString().slice(0, 10);
  if (cond.min_import_date && importDate < cond.min_import_date) return { verdict: 'fail', isStructural: false };
  if (cond.max_import_date && importDate > cond.max_import_date) return { verdict: 'fail', isStructural: false };

  // Boolean attribute checks (attrs_required)
  if (cond.attrs_required) {
    for (const [key, expectedVal] of Object.entries(cond.attrs_required) as Array<[string, boolean]>) {
      const actualVal = (facts.attrs as any)?.[key];
      if (actualVal === undefined) return { verdict: 'clarify', factKey: key };
      if (actualVal !== expectedVal) return { verdict: 'fail', isStructural: false };
    }
  }

  // Structured-answer checks (knownFacts_required)
  if (cond.knownFacts_required && cond.knownFacts_required.length > 0) {
    for (const { key, values } of cond.knownFacts_required) {
      const actual = facts.knownFacts?.[key];
      if (actual === undefined) return { verdict: 'clarify', factKey: key };
      if (!values.includes(actual)) return { verdict: 'fail', isStructural: false };
    }
  }

  return { verdict: 'pass' };
}

// ── Clarification question templates ─────────────────────────────────────────

interface ClarificationTemplate {
  missingInfo: string;
  whyItMatters: (ruleName: string) => string;
  options?: Array<{ value: string; label: string }>;
}

const CLARIFICATION_TEMPLATES: Record<string, ClarificationTemplate> = {
  hts_code: {
    missingInfo: 'HTS classification code',
    whyItMatters: (r) => `${r} applies only to specific HTS chapters — the rule may not apply to this product's classification`,
    options: undefined,
  },
  product_description: {
    missingInfo: 'Product description',
    whyItMatters: (r) => `${r} requires a product description to confirm whether the scope keywords apply`,
    options: undefined,
  },
  origin_country: {
    missingInfo: 'Country of origin',
    whyItMatters: (r) => `${r} applies only to goods from specific countries — origin must be confirmed`,
    options: undefined,
  },
  transport_mode: {
    missingInfo: 'Shipment transport mode (ocean, air, truck, or rail)',
    whyItMatters: (r) => `${r} applies only to specific transport modes — the fee or requirement may not apply depending on how the goods travel`,
    options: [
      { value: 'ocean', label: 'Ocean freight (ship)' },
      { value: 'air', label: 'Air freight' },
      { value: 'truck', label: 'Truck (ground/road)' },
      { value: 'rail', label: 'Rail' },
    ],
  },
  is_children: {
    missingInfo: "Whether product is intended for children under 12",
    whyItMatters: (r) => `${r} is a mandatory requirement only for children's products — it does not apply to adult products`,
    options: [
      { value: 'true', label: 'Yes — designed or primarily marketed for children under 12' },
      { value: 'false', label: 'No — adult or general-population product' },
    ],
  },
  has_battery: {
    missingInfo: 'Whether product contains a battery',
    whyItMatters: (r) => `${r} applies to products with batteries — special transport classification and documentation is required`,
    options: [
      { value: 'true', label: 'Yes — contains a battery' },
      { value: 'false', label: 'No — no battery' },
    ],
  },
  is_electronic: {
    missingInfo: 'Whether product is an electronic device',
    whyItMatters: (r) => `${r} applies to electronic devices that emit radio frequency energy — FCC authorization may be required`,
    options: [
      { value: 'true', label: 'Yes — electronic device or RF emitter' },
      { value: 'false', label: 'No — not an electronic device' },
    ],
  },
  is_cosmetic: {
    missingInfo: 'Whether product is a cosmetic or personal care product',
    whyItMatters: (r) => `${r} applies to cosmetics and personal care products under the Modernization of Cosmetics Regulation Act`,
    options: [
      { value: 'true', label: 'Yes — cosmetic, beauty, or personal care product' },
      { value: 'false', label: 'No — not a cosmetic product' },
    ],
  },
  is_food_contact: {
    missingInfo: 'Whether product contacts food or is a food product',
    whyItMatters: (r) => `${r} requires FDA Prior Notice for all food, beverage, and dietary supplement imports`,
    options: [
      { value: 'true', label: 'Yes — food, beverage, or food-contact product' },
      { value: 'false', label: 'No — not a food or food-contact item' },
    ],
  },
  is_supplement: {
    missingInfo: 'Whether product is a dietary supplement',
    whyItMatters: (r) => `${r} applies to dietary supplements, which require specific FDA labeling and may require Prior Notice`,
    options: [
      { value: 'true', label: 'Yes — dietary supplement, vitamin, or functional food' },
      { value: 'false', label: 'No — not a dietary supplement' },
    ],
  },
  is_textile: {
    missingInfo: 'Whether product is a textile or apparel item',
    whyItMatters: (r) => `${r} requires fiber content disclosure and country-of-origin labeling for textile and apparel products`,
    options: [
      { value: 'true', label: 'Yes — textile, fabric, or apparel item' },
      { value: 'false', label: 'No — not a textile product' },
    ],
  },
  battery_type: {
    missingInfo: 'Battery chemistry type (lithium-ion, lithium metal, or other)',
    whyItMatters: (r) => `${r} applies specifically to lithium-ion and lithium metal batteries — alkaline and other battery types are not covered`,
    options: [
      { value: 'lithium_ion', label: 'Lithium-ion (Li-ion) — rechargeable, most consumer electronics' },
      { value: 'lithium_metal', label: 'Lithium metal — non-rechargeable primary cells' },
      { value: 'alkaline', label: 'Alkaline or other non-lithium battery' },
      { value: 'no_battery', label: 'No battery' },
    ],
  },
  has_wireless_tx: {
    missingInfo: 'Whether product contains a wireless transmitter',
    whyItMatters: (r) => `${r} requires FCC equipment authorization before marketing or import of intentional RF transmitters (Wi-Fi, Bluetooth, cellular, Zigbee, etc.)`,
    options: [
      { value: 'yes', label: 'Yes — contains a wireless transmitter' },
      { value: 'no', label: 'No — no wireless transmitter (receiver-only or no RF)' },
    ],
  },
  is_pesticide: {
    missingInfo: 'Whether product is a pesticide, disinfectant, or antimicrobial',
    whyItMatters: (r) => `${r} requires EPA FIFRA registration before import or sale of pesticide products`,
    options: [
      { value: 'yes', label: 'Yes — pesticide, disinfectant, or antimicrobial product' },
      { value: 'no', label: 'No — not a pesticide product' },
    ],
  },
  is_chemical_substance: {
    missingInfo: 'Whether product is a new chemical substance subject to TSCA',
    whyItMatters: (r) => `${r} requires EPA notification for new chemical substances before manufacture or import`,
    options: [
      { value: 'yes', label: 'Yes — new chemical substance or mixture subject to TSCA' },
      { value: 'no', label: 'No — not a TSCA-covered chemical substance' },
    ],
  },
  contains_hazmat: {
    missingInfo: 'Whether shipment contains DOT-classified hazardous materials',
    whyItMatters: (r) => `${r} requires DOT hazmat classification, packaging, marking, and shipping documentation`,
    options: [
      { value: 'yes', label: 'Yes — contains hazardous materials' },
      { value: 'no', label: 'No — no hazardous materials' },
    ],
  },
  contains_otc_ingredient: {
    missingInfo: 'Whether product contains an FDA OTC drug-active ingredient',
    whyItMatters: (r) => `${r} applies when a cosmetic product contains an OTC drug-active ingredient such as SPF sunscreen, acne treatment, or antidandruff agent`,
    options: [
      { value: 'yes_sunscreen', label: 'Yes — SPF/sunscreen ingredient (avobenzone, titanium dioxide, etc.)' },
      { value: 'yes_acne', label: 'Yes — acne treatment (benzoyl peroxide, salicylic acid)' },
      { value: 'yes_antidandruff', label: 'Yes — antidandruff active (zinc pyrithione, selenium sulfide)' },
      { value: 'no', label: 'No — no OTC drug-active ingredient' },
    ],
  },
  is_meat_or_poultry: {
    missingInfo: 'Whether product is a meat, poultry, or egg product',
    whyItMatters: (r) => `${r} requires USDA FSIS inspection for meat, poultry, and egg products entering the U.S.`,
    options: [
      { value: 'yes_meat', label: 'Yes — meat product (beef, pork, lamb, etc.)' },
      { value: 'yes_poultry', label: 'Yes — poultry product (chicken, turkey, duck)' },
      { value: 'yes_egg', label: 'Yes — egg or processed egg product' },
      { value: 'no', label: 'No — not meat, poultry, or egg' },
    ],
  },
  contains_composite_wood: {
    missingInfo: 'Whether product contains composite wood components (hardwood plywood, particleboard, or MDF)',
    whyItMatters: (r) => `${r} limits formaldehyde emissions from composite wood products and requires product testing and labeling`,
    options: [
      { value: 'yes', label: 'Yes — contains composite wood (hardwood plywood, particleboard, MDF, or laminated product veneer)' },
      { value: 'no', label: 'No — solid wood only, metal, plastic, or no wood components' },
    ],
  },
};

function buildClarificationQuestion(
  factKey: string,
  rule: OfficialRuleRecord,
  categoryName: string,
  findingId: string,
): ClarificationQuestion {
  const tmpl = CLARIFICATION_TEMPLATES[factKey];
  const ruleName = rule.legal_citation ?? rule.rule_id;
  return {
    fact_key: factKey,
    missing_info: tmpl?.missingInfo ?? `Unknown fact: ${factKey}`,
    why_it_matters: tmpl ? tmpl.whyItMatters(ruleName) : `${ruleName} requires this information to determine applicability`,
    affects_finding_id: findingId,
    affects_category: categoryName,
    options: tmpl?.options,
  };
}

// ── Financial-impact text parsing ─────────────────────────────────────────────

/**
 * Extract the claimed fee amount and customs value from a financial_impact string.
 * Expected format: "~?$<amount> on a $<value> shipment ..."
 * Returns null when the format does not match.
 */
function parseFinancialImpact(text: string): { amount: number; value: number } | null {
  const m = text.match(
    /~?\$([0-9,]+(?:\.[0-9]{1,2})?)\s+on\s+a\s+\$([0-9,]+(?:\.[0-9]{1,2})?)\s+shipment/,
  );
  if (!m) return null;
  return {
    amount: parseFloat(m[1].replace(/,/g, '')),
    value: parseFloat(m[2].replace(/,/g, '')),
  };
}

// ── Public types ──────────────────────────────────────────────────────────────

export interface VerifierIssue {
  /** Machine-readable code — never shown to the user. */
  code: string;
  /**
   * What correction was applied:
   *   downgrade — status lowered (e.g. verified_applicable → official_unconfirmed)
   *   remove    — record or document deleted
   *   correct   — data corrected (amount stripped, missing entry added)
   */
  severity: 'downgrade' | 'remove' | 'correct';
  /** The finding id, domain key, document name, or obligation id that was corrected. */
  affected_id: string;
  /** Human-readable internal detail — server log only, never exposed to the user. */
  detail: string;
}

export interface VerificationResult {
  /** True when zero corrections were required. */
  passed: boolean;
  /** The scan to store and display (possibly corrected). */
  report: ScanResult;
  /** Internal audit trail. Never forwarded to the client. */
  issues: VerifierIssue[];
}

/** Product facts the verifier uses for scope validation (check L). */
export interface ProductFacts {
  /** Numeric HTS digits only, e.g. '4203218060'. */
  htsDigits?: string;
  /** Combined product name + description for keyword matching. */
  productText?: string;
  /** Origin country, e.g. 'China', 'CN', 'Mexico'. Case-insensitive substring matched. */
  originCountry?: string;
  /** ISO date of import, e.g. '2026-06-30'. Defaults to today if absent. */
  importDate?: string;
  attrs?: {
    is_children?: boolean;
    has_battery?: boolean;
    is_electronic?: boolean;
    is_textile?: boolean;
    is_cosmetic?: boolean;
    is_food_contact?: boolean;
    is_supplement?: boolean;
  };
  /** Structured clarification answers provided by the user (key → selected value). */
  knownFacts?: Record<string, string>;
}

export interface VerifyContext {
  transportMode?: 'ocean' | 'air' | 'truck' | 'rail' | null;
  /** Product facts used by the registry scope validator (check L). */
  productFacts?: ProductFacts;
  /**
   * Override the default official-rule registry for testing.
   * When absent, OFFICIAL_RULE_REGISTRY is used.
   */
  ruleRegistry?: OfficialRuleRecord[];
}

// ── Main verifier ─────────────────────────────────────────────────────────────

/**
 * Run all integrity checks on a finalized draft scan.
 *
 * Returns the (possibly corrected) scan plus an internal audit trail.
 * The caller must never forward `issues` to the client.
 */
export function verifyScan(
  scan: ScanResult,
  ctx?: VerifyContext,
): VerificationResult {
  const issues: VerifierIssue[] = [];
  const mode = ctx?.transportMode ?? null;
  const facts = ctx?.productFacts;

  // Build finding-id index from the registry (or injected override for tests).
  const registry = ctx?.ruleRegistry ?? OFFICIAL_RULE_REGISTRY;
  const ruleIndex = buildFindingIndex(registry);

  // Work on shallow-copied arrays so the original scan object is not mutated.
  let categories = [...scan.risk_categories];
  let checklist = [...scan.document_checklist];
  let obligations = [...(scan.obligations ?? [])];
  let missingFacts = [...(scan.missing_facts ?? [])];
  let coverageMatrix = [...(scan.coverage_matrix ?? [])];
  const clarificationQuestions: ClarificationQuestion[] = [...(scan.clarification_questions ?? [])];

  // ── A: Unsourced mandatory ────────────────────────────────────────────────
  // verified_applicable without an official source is an unsupported claim.
  categories = categories.map((cat) => {
    if (cat.verification_status === 'verified_applicable' && !cat.source) {
      issues.push({
        code: 'UNSOURCED_MANDATORY',
        severity: 'downgrade',
        affected_id: cat.id ?? cat.category,
        detail: `"${cat.category}" is verified_applicable with no source — downgraded to official_unconfirmed`,
      });
      return { ...cat, verification_status: 'official_unconfirmed' as VerificationStatus };
    }
    return cat;
  });

  // ── B: Voluntary standards body ≠ mandatory federal obligation ────────────
  categories = categories.map((cat) => {
    if (
      cat.verification_status === 'verified_applicable' &&
      isVoluntaryBodyOnly(cat.source?.agency)
    ) {
      issues.push({
        code: 'VOLUNTARY_NOT_MANDATORY',
        severity: 'downgrade',
        affected_id: cat.id ?? cat.category,
        detail: `"${cat.category}" sourced from voluntary body "${cat.source?.agency}" — cannot establish mandatory obligation; downgraded`,
      });
      return { ...cat, verification_status: 'official_unconfirmed' as VerificationStatus };
    }
    return cat;
  });

  // ── C: not_applicable finding → no required document ─────────────────────
  const notApplicableIds = new Set(
    categories
      .filter((c) => c.verification_status === 'not_applicable')
      .map((c) => c.id)
      .filter(Boolean) as string[],
  );
  checklist = checklist.map((doc) => {
    if (doc.required && doc.finding_id && notApplicableIds.has(doc.finding_id)) {
      issues.push({
        code: 'NOT_APPLICABLE_REQUIRED_DOC',
        severity: 'downgrade',
        affected_id: doc.document,
        detail: `"${doc.document}" required but traces to not_applicable finding "${doc.finding_id}" — downgraded`,
      });
      return { ...doc, required: false, status: 'needs_confirmation' as const };
    }
    return doc;
  });

  // ── D: Required document must trace to a verified finding ─────────────────
  // Rebuild verified set from the corrected categories (post-A and post-B).
  const verifiedIds = new Set(
    categories
      .filter((c) => c.verification_status === 'verified_applicable')
      .map((c) => c.id)
      .filter(Boolean) as string[],
  );
  checklist = checklist.map((doc) => {
    if (doc.required && doc.finding_id && !verifiedIds.has(doc.finding_id)) {
      issues.push({
        code: 'REQUIRED_DOC_NO_BACKING',
        severity: 'downgrade',
        affected_id: doc.document,
        detail: `"${doc.document}" is required but finding "${doc.finding_id}" is not verified_applicable — downgraded`,
      });
      return { ...doc, required: false, status: 'needs_confirmation' as const };
    }
    return doc;
  });

  // ── E: No duplicate documents ─────────────────────────────────────────────
  {
    const seen = new Set<string>();
    checklist = checklist.filter((doc) => {
      const key = doc.document.toLowerCase().trim();
      if (seen.has(key)) {
        issues.push({
          code: 'DUPLICATE_DOCUMENT',
          severity: 'remove',
          affected_id: doc.document,
          detail: `Duplicate document "${doc.document}" removed`,
        });
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  // ── F: No duplicate obligations ───────────────────────────────────────────
  {
    const deduped = deduplicateObligations(obligations);
    if (deduped.length < obligations.length) {
      issues.push({
        code: 'DUPLICATE_OBLIGATIONS',
        severity: 'remove',
        affected_id: 'obligations',
        detail: `${obligations.length - deduped.length} duplicate obligation(s) removed by canonical key`,
      });
      obligations = deduped;
    }
  }

  // ── G: Transport-mode document mismatch ───────────────────────────────────
  if (mode) {
    checklist = checklist.filter((doc) => {
      if (doc.transport_modes && !doc.transport_modes.includes(mode)) {
        issues.push({
          code: 'TRANSPORT_MODE_MISMATCH',
          severity: 'remove',
          affected_id: doc.document,
          detail: `"${doc.document}" requires ${doc.transport_modes.join('/')} but shipment mode is ${mode}`,
        });
        return false;
      }
      return true;
    });
  }

  // ── H: Coverage-finding contradiction ────────────────────────────────────
  {
    const notApplicableDomainFindingIds = new Set(
      (scan.coverage_matrix ?? [])
        .filter((c) => c.status === 'not_applicable' || c.status === 'no_applicable_rule')
        .map((c) => c.finding_id)
        .filter(Boolean) as string[],
    );

    categories = categories.map((cat) => {
      if (
        cat.id &&
        notApplicableDomainFindingIds.has(cat.id) &&
        cat.verification_status === 'verified_applicable'
      ) {
        issues.push({
          code: 'COVERAGE_FINDING_CONTRADICTION',
          severity: 'downgrade',
          affected_id: cat.id,
          detail: `Coverage matrix says not_applicable but finding "${cat.id}" is verified_applicable — downgraded`,
        });
        return {
          ...cat,
          verification_status: 'official_unconfirmed' as VerificationStatus,
        };
      }
      return cat;
    });
  }

  // ── I: Missing-facts must be genuinely unresolved ─────────────────────────
  {
    const resolvedMissingInfo = new Set(
      categories
        .filter(
          (c) =>
            c.verification_status === 'verified_applicable' ||
            c.verification_status === 'not_applicable',
        )
        .map((c) => c.missing_info)
        .filter(Boolean) as string[],
    );

    missingFacts = missingFacts.filter((f) => {
      if (resolvedMissingInfo.has(f)) {
        issues.push({
          code: 'RESOLVED_MISSING_FACT',
          severity: 'remove',
          affected_id: f.slice(0, 80),
          detail: `Missing fact removed — corresponds to a resolved finding`,
        });
        return false;
      }
      return true;
    });
  }

  // ── J: Tariff rate-impact consistency (BLOCKING) ──────────────────────────
  // A tariff finding with a dollar financial_impact claim but no verified_rate_pct
  // has no mathematical basis for the stated amount.  Strip the dollar text so
  // the user sees "rate not confirmed" rather than an invented figure.
  categories = categories.map((cat) => {
    if (
      cat.id &&
      TARIFF_FINDING_IDS.has(cat.id) &&
      cat.verification_status === 'verified_applicable' &&
      cat.financial_impact &&
      cat.verified_rate_pct == null
    ) {
      issues.push({
        code: 'FINANCIAL_IMPACT_NO_RATE',
        severity: 'correct',
        affected_id: cat.id,
        detail: `Tariff "${cat.id}" states a dollar amount but verified_rate_pct is null — financial_impact stripped`,
      });
      return { ...cat, financial_impact: undefined };
    }
    return cat;
  });

  // ── K: All applicable tariffs in coverage matrix (BLOCKING) ──────────────
  // Each verified tariff finding must appear in the payment table.
  // If the domain key is missing, add a corrective coverage_matrix entry so
  // the tariff is visible in the cost summary.
  {
    const covFindingIds = new Set(
      coverageMatrix.map((c) => c.finding_id).filter(Boolean) as string[],
    );
    const covDomainKeys = new Set(coverageMatrix.map((c) => c.domain_key));

    for (const cat of categories) {
      if (
        cat.id &&
        TARIFF_FINDING_IDS.has(cat.id) &&
        cat.verification_status === 'verified_applicable' &&
        !covFindingIds.has(cat.id)
      ) {
        const domainKey = FINDING_TO_DOMAIN[cat.id];
        if (domainKey && !covDomainKeys.has(domainKey)) {
          const corrective: CoverageItem = {
            domain: cat.category,
            domain_key: domainKey,
            category: 'tariff',
            status: 'verified_applicable',
            finding_id: cat.id,
          };
          coverageMatrix = [...coverageMatrix, corrective];
          covDomainKeys.add(domainKey);
          covFindingIds.add(cat.id);

          issues.push({
            code: 'TARIFF_NOT_IN_PAYMENT_TABLE',
            severity: 'correct',
            affected_id: cat.id,
            detail: `Tariff "${cat.id}" verified but absent from coverage matrix — corrective entry added for domain "${domainKey}"`,
          });
        }
      }
    }
  }

  // ── L: Registry scope validation ─────────────────────────────────────────
  // For each remaining verified_applicable finding, look up the finding id
  // in the official-rule registry and verify:
  //   L0  RULE_NOT_IN_REGISTRY — no registry record exists for this finding
  //   L1  RULE_EXPIRED — rule expired before the import date
  //   L2  CITATION_SCOPE_MISMATCH — product outside HTS chapter / keyword scope
  //   L3  SCOPE_CONDITION_UNMET — factual condition definitively not met
  //   L4  CLARIFICATION_REQUIRED — material fact unknown; cannot approve finding
  //
  // Registry check (L0) always runs when productFacts is provided.
  // Scope checks (L1–L4) also require productFacts.
  if (facts) {
    categories = categories.map((cat) => {
      if (cat.verification_status !== 'verified_applicable' || !cat.id) return cat;

      // L0: Registry coverage — every verified finding must have a registry record.
      const rule = ruleIndex.get(cat.id);
      if (!rule) {
        issues.push({
          code: 'RULE_NOT_IN_REGISTRY',
          severity: 'downgrade',
          affected_id: cat.id,
          detail: `No official-rule registry entry for finding "${cat.id}" — cannot independently validate the legal claim; downgraded to official_unconfirmed`,
        });
        return { ...cat, verification_status: 'official_unconfirmed' as VerificationStatus };
      }

      // L1: Expiry check — rule has a hard expiry date set at the record level.
      if (rule.expiry_date) {
        const importDate = facts.importDate ?? new Date().toISOString().slice(0, 10);
        if (importDate > rule.expiry_date) {
          issues.push({
            code: 'RULE_EXPIRED',
            severity: 'downgrade',
            affected_id: cat.id,
            detail: `Rule "${rule.rule_id}" expired ${rule.expiry_date} — finding for "${cat.category}" downgraded`,
          });
          return { ...cat, verification_status: 'official_unconfirmed' as VerificationStatus };
        }
      }

      // L2–L4: Scope conditions — HTS chapter, keywords, age, battery, origin, mode, dates,
      //         boolean attrs, and structured-answer (knownFacts) checks.
      const scopeResult = checkScope(rule.scope_conditions, facts, mode);

      if (scopeResult.verdict === 'fail') {
        const code = scopeResult.isStructural ? 'CITATION_SCOPE_MISMATCH' : 'SCOPE_CONDITION_UNMET';
        issues.push({
          code,
          severity: 'downgrade',
          affected_id: cat.id,
          detail: `Rule "${rule.rule_id}" scope conditions not met for "${cat.category}" — downgraded to official_unconfirmed`,
        });
        return { ...cat, verification_status: 'official_unconfirmed' as VerificationStatus };
      }

      if (scopeResult.verdict === 'clarify') {
        // Material fact unknown — cannot approve finding; downgrade and ask the user.
        issues.push({
          code: 'CLARIFICATION_REQUIRED',
          severity: 'downgrade',
          affected_id: cat.id,
          detail: `Fact "${scopeResult.factKey}" is unknown — cannot confirm scope for "${cat.category}" (rule "${rule.rule_id}"); downgraded and clarification question generated`,
        });
        // Build and collect the structured question (deduplicate by fact_key + finding_id).
        const alreadyAsked = clarificationQuestions.some(
          (q) => q.fact_key === scopeResult.factKey && q.affects_finding_id === cat.id,
        );
        if (!alreadyAsked) {
          clarificationQuestions.push(
            buildClarificationQuestion(scopeResult.factKey, rule, cat.category, cat.id),
          );
        }
        return { ...cat, verification_status: 'official_unconfirmed' as VerificationStatus };
      }

      return cat;
    });
  }

  // ── M: Per-finding amount consistency ─────────────────────────────────────
  // For simple rate×value fees (not MPF which has min/max bounds): verify that
  // the dollar amount stated in financial_impact equals rate × customs_value / 100.
  // Tolerance: $1.00 to absorb Math.round() truncation differences.
  // Corrective action: strip the incorrect dollar amount.
  categories = categories.map((cat) => {
    if (
      cat.id &&
      SIMPLE_RATE_FINDING_IDS.has(cat.id) &&
      cat.verification_status === 'verified_applicable' &&
      cat.verified_rate_pct != null &&
      cat.financial_impact
    ) {
      const parsed = parseFinancialImpact(cat.financial_impact);
      if (parsed) {
        const expected = Math.round((parsed.value * cat.verified_rate_pct) / 100);
        const actual = Math.round(parsed.amount);
        if (Math.abs(actual - expected) > 1) {
          issues.push({
            code: 'TOTAL_AMOUNT_MISMATCH',
            severity: 'correct',
            affected_id: cat.id,
            detail: `"${cat.id}" states $${actual} but ${cat.verified_rate_pct}% × $${parsed.value} = $${expected} — financial_impact stripped`,
          });
          return { ...cat, financial_impact: undefined };
        }
      }
    }
    return cat;
  });

  return {
    passed: issues.length === 0,
    report: {
      ...scan,
      risk_categories: categories,
      document_checklist: checklist,
      missing_facts: missingFacts,
      obligations,
      coverage_matrix: coverageMatrix,
      clarification_questions: clarificationQuestions.length > 0 ? clarificationQuestions : undefined,
    },
    issues,
  };
}
